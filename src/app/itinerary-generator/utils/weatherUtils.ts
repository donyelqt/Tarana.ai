import { WeatherData, fetchWeatherFromAPI } from "@/lib/core";

/**
 * Hook to fetch and process weather data
 * @returns Promise with weather data or null
 */
export const fetchWeatherData = async (): Promise<WeatherData | null> => {
  try {
    const data = await fetchWeatherFromAPI();
    console.log("Weather data fetched:", data);
    return data;
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
};

/**
 * Get appropriate weather icon URL from weather data
 * @param weatherData The weather data object
 * @returns Weather icon URL
 */
export const getWeatherIconUrl = (weatherData: WeatherData | null): string => {
  if (!weatherData || !weatherData.weather || !weatherData.weather[0] || !weatherData.weather[0].icon) {
    return "https://openweathermap.org/img/wn/01d@2x.png"; // Default sunny icon
  }
  return `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`;
};

/**
 * Get a user-friendly description of the current weather
 * @param weatherData The weather data object
 * @returns Formatted weather description
 */
export const getWeatherDescription = (weatherData: WeatherData | null): string => {
  if (!weatherData) {
    return "Weather data unavailable";
  }
  
  const condition = weatherData.weather?.[0]?.main || "Unknown";
  const temp = Math.round(weatherData.main?.temp || 0);
  
  return `${condition}, ${temp}°C`;
}; 