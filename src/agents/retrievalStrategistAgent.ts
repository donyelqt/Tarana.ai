import { findAndScoreActivities } from "@/app/api/gemini/itinerary-generator/lib/activitySearch";
import type { WeatherCondition } from "@/app/api/gemini/itinerary-generator/types/types";
import { updateSession, appendError, type RequestSession, type RetrievalResult, type RankedActivity } from "@/lib/agentic/sessionStore";

export interface RetrievalStrategistDeps {
  geminiModel: unknown;
}

export class RetrievalStrategistAgent {
  constructor(private readonly deps: RetrievalStrategistDeps) {}

  async execute(session: RequestSession): Promise<RequestSession> {
    try {
      this.ensureModel();

      const weatherType = this.resolveWeatherCondition(session);
      const sampleItinerary = await findAndScoreActivities(
        session.prompt,
        session.preferences.interests,
        weatherType,
        session.preferences.durationDays,
        this.deps.geminiModel
      );

      const candidates = this.extractCandidates(sampleItinerary);
      const retrieval: RetrievalResult = {
        candidates,
        expandedQueries: [],
        coverageScore: candidates.length,
        metadata: {
          sampleItinerary,
        },
      };

      return updateSession(session.id, {
        retrieval,
        status: "in_progress",
      });
    } catch (error) {
      appendError(session.id, {
        agent: "retrieval-strategist",
        stage: "fatal",
        message: "Failed to retrieve and score activities",
        detail: error,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  private ensureModel() {
    if (!this.deps.geminiModel) {
      throw new Error("Gemini model not configured");
    }
  }

  private resolveWeatherCondition(session: RequestSession): WeatherCondition {
    const rawWeather = session.context?.weather?.raw as WeatherSnapshot | undefined;
    const id = rawWeather?.weather?.[0]?.id ?? 0;
    const temp = rawWeather?.main?.temp ?? 20;
    return getWeatherType(id, temp);
  }

  private extractCandidates(sampleItinerary: any): RankedActivity[] {
    const allowedActivities = Array.isArray(sampleItinerary?.searchMetadata?.allowedActivities)
      ? sampleItinerary.searchMetadata.allowedActivities
      : [];

    return allowedActivities.map((activity: any, index: number) => {
      const score = typeof activity.relevanceScore === "number" ? activity.relevanceScore : Math.max(0, 1 - index / allowedActivities.length);
      return {
        title: activity.title,
        score,
        tags: Array.isArray(activity.tags) ? activity.tags : [],
        trafficAnalysis: activity.trafficAnalysis,
        raw: activity,
      } satisfies RankedActivity;
    });
  }
}

type WeatherSnapshot = {
  weather?: Array<{ id?: number }>;
  main?: { temp?: number };
};

function getWeatherType(id: number, temp: number): WeatherCondition {
  if (id >= 200 && id <= 232) return "thunderstorm";
  if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return "rainy";
  if (id >= 600 && id <= 622) return "snow";
  if (id >= 701 && id <= 781) return "foggy";
  if (id === 800) return "clear";
  if (id >= 801 && id <= 804) return "cloudy";
  if (temp < 15) return "cold";
  return "default";
}
