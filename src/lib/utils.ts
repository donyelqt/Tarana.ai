import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Weather API types
export interface WeatherData {
  main: {
    temp: number
    feels_like: number
    humidity: number
  }
  weather: {
    id: number
    main: string
    description: string
    icon: string
  }[]
  name: string
  sys: {
    country: string
  }
}

// Function to fetch current weather data directly from OpenWeather API
// This should only be used server-side where API key is secure
export async function fetchWeatherData(lat: number, lon: number, apiKey: string): Promise<WeatherData | null> {
  try {
    console.log(`Making request to OpenWeather API for coordinates: ${lat}, ${lon}`);
    
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`,
      { 
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        cache: 'no-store' // Disable caching to ensure fresh data
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details available');
      console.error(`Weather API responded with status ${response.status}: ${errorText}`);
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Weather data fetched successfully');
    return data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw error; // Propagate the error to be handled by the caller
  }
}

// Client-side function to fetch weather data through our secure API route
export async function fetchWeatherFromAPI(lat: number = BAGUIO_COORDINATES.lat, lon: number = BAGUIO_COORDINATES.lon): Promise<WeatherData | null> {
  try {
    // Add a timestamp to prevent caching issues
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}&_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' // Disable caching
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`Weather API responded with status ${response.status}: ${errorText}`);
      throw new Error(`Weather API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching weather data from API:', error);
    
    // Return a fallback weather data object when API fails
    // This prevents the UI from breaking completely
    return {
      main: {
        temp: 18, // Default temperature for Baguio
        feels_like: 16,
        humidity: 70
      },
      weather: [{
        id: 800,
        main: 'Clear',
        description: 'clear sky (fallback data)',
        icon: '01d'
      }],
      name: BAGUIO_COORDINATES.name,
      sys: {
        country: 'PH'
      }
    };
  }
}

// Function to get weather icon URL
export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
}

// Default coordinates for Baguio City, Philippines
export const BAGUIO_COORDINATES = {
  lat: 16.4023,
  lon: 120.5960,
  name: "Baguio City"
}
