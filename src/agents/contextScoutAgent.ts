import { updateSession, appendError, type RequestSession, type ContextPayload, type TrafficSnapshot } from "@/lib/agentic/sessionStore";
import { getPeakHoursContext, tomtomTrafficService } from "@/lib/traffic";
import { getActivityCoordinates } from "@/lib/data";
import type { ConciergePayload } from "./conciergeAgent";

export interface WeatherProvider {
  getWeather(prompt: ConciergePayload): Promise<RawWeatherData | null>;
}

export interface ContextScoutDeps {
  weatherProvider: WeatherProvider;
  maxTrafficLocations?: number;
}

type RawWeatherData = {
  weather?: Array<{ description?: string }>;
  main?: { temp?: number };
  [key: string]: unknown;
};

const DEFAULT_TRAFFIC_LOCATIONS = [
  "Burnham Park",
  "Baguio Public Market",
  "Mines View Park",
];

export class ContextScoutAgent {
  constructor(private readonly deps: ContextScoutDeps) {}

  async execute(session: RequestSession, requestBody: ConciergePayload): Promise<RequestSession> {
    try {
      const weatherData = await this.deps.weatherProvider.getWeather(requestBody);
      const contextPayload = await this.buildContextPayload(weatherData);

      return updateSession(session.id, {
        context: contextPayload,
        status: "in_progress",
      });
    } catch (error) {
      appendError(session.id, {
        agent: "context-scout",
        stage: "fatal",
        message: "Failed to gather environmental context",
        detail: error,
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  private async buildContextPayload(weatherData: RawWeatherData | null): Promise<ContextPayload> {
    const [traffic, peakHoursContext] = await Promise.all([
      this.getTrafficSnapshots(),
      Promise.resolve(getPeakHoursContext()),
    ]);

    return {
      weather: weatherData
        ? {
            raw: weatherData,
            description: weatherData.weather?.[0]?.description,
            temperatureC: weatherData.main?.temp,
          }
        : undefined,
      traffic,
      peakHoursContext,
      crowdContext: undefined,
      fetchedAt: Date.now(),
    };
  }

  private async getTrafficSnapshots(): Promise<TrafficSnapshot[]> {
    const locations = DEFAULT_TRAFFIC_LOCATIONS.slice(0, this.deps.maxTrafficLocations ?? DEFAULT_TRAFFIC_LOCATIONS.length);

    const snapshots = await Promise.all(
      locations.map(async (name) => {
        const coords = getActivityCoordinates(name);
        if (!coords) return null;

        try {
          const traffic = await tomtomTrafficService.getLocationTrafficData(coords.lat, coords.lon);
          return {
            area: name,
            trafficLevel: traffic?.trafficLevel ?? "UNKNOWN",
            recommendationScore: traffic?.recommendationScore,
            raw: traffic,
          } as TrafficSnapshot;
        } catch (error) {
          console.warn(`[ContextScoutAgent] traffic fetch failed for ${name}`, error);
          return {
            area: name,
            trafficLevel: "UNKNOWN",
            recommendationScore: undefined,
            raw: { error: String(error) },
          } as TrafficSnapshot;
        }
      })
    ) as Array<TrafficSnapshot | null>;

    return snapshots.filter((snapshot): snapshot is TrafficSnapshot => snapshot !== null);
  }
}
