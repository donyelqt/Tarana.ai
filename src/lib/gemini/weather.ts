import { WeatherCondition } from './types';

export const WEATHER_CONTEXTS = {
  thunderstorm: (temp: number, desc: string) =>
    `WARNING: ${desc} (${temp}°C). ONLY indoor activities: Museums, malls, indoor dining. Select "Indoor-Friendly" tagged activities only.`,
  rainy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Prioritize "Indoor-Friendly" tagged activities: Museums, malls, covered dining.`,
  snow: (temp: number, desc: string) =>
    `${desc} (${temp}°C)! Focus on "Indoor-Friendly" activities: warm venues, hot beverages, brief safe outdoor viewing.`,
  foggy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Use "Indoor-Friendly" or "Weather-Flexible" activities. Avoid viewpoints.`,
  cloudy: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Mix of "Weather-Flexible" activities. Good for photography.`,
  clear: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Perfect for "Outdoor-Friendly" activities: hiking, parks, viewpoints.`,
  cold: (temp: number, desc: string) =>
    `${desc} (${temp}°C). Prioritize "Indoor-Friendly" activities with warming options.`,
  default: (temp: number, desc: string) =>
    `Weather: ${desc} at ${temp}°C. Balance indoor/outdoor activities.`,
} as const;

export const WEATHER_TAG_FILTERS: Record<string, string[]> = {
  thunderstorm: ["Indoor-Friendly"],
  rainy: ["Indoor-Friendly"],
  snow: ["Indoor-Friendly"],
  foggy: ["Indoor-Friendly", "Weather-Flexible"],
  cloudy: ["Outdoor-Friendly", "Weather-Flexible"],
  clear: ["Outdoor-Friendly"],
  cold: ["Indoor-Friendly"],
  default: [],
};

export function getWeatherType(id: number, temp: number): WeatherCondition {
  if (id >= 200 && id <= 232) return 'thunderstorm';
  if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
  if (id >= 600 && id <= 622) return 'snow';
  if (id >= 701 && id <= 781) return 'foggy';
  if (id === 800) return 'clear';
  if (id >= 801 && id <= 804) return 'cloudy';
  if (temp < 15) return 'cold';
  return 'default';
}