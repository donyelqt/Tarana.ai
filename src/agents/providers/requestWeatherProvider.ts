import type { ConciergePayload } from "../conciergeAgent";
import type { WeatherProvider } from "../contextScoutAgent";

export class RequestWeatherProvider implements WeatherProvider {
  async getWeather(payload: ConciergePayload) {
    if (payload.weatherData && typeof payload.weatherData === "object") {
      return payload.weatherData as Record<string, unknown>;
    }
    return null;
  }
}
