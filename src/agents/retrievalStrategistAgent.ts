import { findAndScoreActivities } from "@/app/api/gemini/itinerary-generator/lib/activitySearch";
import type { WeatherCondition } from "@/app/api/gemini/itinerary-generator/types/types";
import { updateSession, appendError, type RequestSession, type RetrievalResult, type RankedActivity } from "@/lib/agentic/sessionStore";
import { isTargetCityId } from "@/lib/data/touristPoi";
export interface RetrievalStrategistDeps {
  geminiModel: unknown;
}

/**
 * The only strategy space the Strategist is allowed to pick from. Every value
 * names a retrieval path that already exists inside findAndScoreActivities --
 * this slice selects between them explicitly instead of calling blind and
 * recording `expandedQueries: []`. No new retrieval code, no new model call:
 * the same single search runs, but the session now says what was asked for.
 */
export type RetrievalStrategy = 'curated' | 'tomtom-live' | 'interest-first' | 'honest-empty';

export interface StrategyDecision {
  strategy: RetrievalStrategy;
  reason: string;
}

export class RetrievalStrategistAgent {
  constructor(private readonly deps: RetrievalStrategistDeps) {}

  /**
   * Pick a strategy from what is known BEFORE any search runs: the scope and
   * the request shape. Deterministic and testable -- no model call involved.
   *
   *  - baguio + no interests          -> curated (deterministic catalog, zero upstream)
   *  - baguio + stated interests      -> interest-first (personalization layer leads)
   *  - strict-city members           -> tomtom-live (the shared 50-POI pool is their only ground)
   *  - anything else (ph-wide/world) -> honest-empty (no pool exists yet; never
   *    fall back to another city's data)
   */
  decideStrategy(session: RequestSession): StrategyDecision {
    const cityId = (session.preferences.cityId ?? 'baguio').toLowerCase();
    const hasInterests =
      Array.isArray(session.preferences.interests) &&
      session.preferences.interests.some((i) => typeof i === 'string' && i.trim().length > 0);

    if (cityId === 'baguio' && !hasInterests) {
      return { strategy: 'curated', reason: 'Baguio has a deterministic catalog and the request states no interests; skip upstream entirely' };
    }
    if (cityId === 'baguio') {
      return { strategy: 'interest-first', reason: 'Baguio with stated interests: personalization layer leads, catalog covers' };
    }
    if (isTargetCityId(cityId)) {
      return { strategy: 'tomtom-live', reason: `${cityId} has no curated catalog; the shared TomTom pool is its only ground` };
    }
    return { strategy: 'honest-empty', reason: `${cityId} has no retrieval pool; refusing to substitute another city's data` };
  }

  async execute(session: RequestSession): Promise<RequestSession> {
    try {
      this.ensureModel();

      const decision = this.decideStrategy(session);
      const weatherType = this.resolveWeatherCondition(session);
      const sampleItinerary = await findAndScoreActivities(
        session.prompt,
        session.preferences.interests,
        weatherType,
        session.preferences.durationDays,
        this.deps.geminiModel,
        true, // trafficAware
        session.preferences.cityId ?? "baguio"
      );

      const observedMethod =
        typeof sampleItinerary?.searchMetadata?.searchMethod === 'string'
          ? sampleItinerary.searchMetadata.searchMethod
          : 'unknown';

      const candidates = this.extractCandidates(sampleItinerary);
      const retrieval: RetrievalResult = {
        candidates,
        expandedQueries: [decision.strategy],
        coverageScore: candidates.length,
        metadata: {
          sampleItinerary,
          strategy: decision.strategy,
          strategyReason: decision.reason,
          observedSearchMethod: observedMethod,
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
