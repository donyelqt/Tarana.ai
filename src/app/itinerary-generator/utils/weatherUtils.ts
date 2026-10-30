import { WeatherData, fetchWeatherFromAPI } from "@/lib/core";

export const fetchWeatherData = async (
  lat?: number,
  lon?: number
): Promise<WeatherData | null> => {
  try {
    const data = await fetchWeatherFromAPI(lat, lon);
    console.log(`Weather data fetched${lat != null ? ` for ${lat.toFixed(3)}, ${lon?.toFixed(3)}` : ""}:`, data);
    return data;
  } catch (error) {
    console.error("Failed to fetch weather data:", error);
    return null;
  }
};

export const getWeatherIconUrl = (weatherData: WeatherData | null): string => {
  if (!weatherData || !weatherData.weather || !weatherData.weather[0] || !weatherData.weather[0].icon) {
    return "https://openweathermap.org/img/wn/01d@2x.png"; 
  }
  return `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png`;
};

export const getWeatherDescription = (weatherData: WeatherData | null): string => {
  if (!weatherData) {
    return "Weather data unavailable";
  }
  
  const condition = weatherData.weather?.[0]?.main || "Unknown";
  const temp = Math.round(weatherData.main?.temp || 0);
  
  return `${condition}, ${temp}°C`;
}; 