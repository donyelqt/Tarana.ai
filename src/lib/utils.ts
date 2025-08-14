import { clsx, type ClassValue } from "clsx"
import { StaticImageData } from "next/image"
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
  dt: number;
}

// Baguio City coordinates
export const BAGUIO_COORDINATES = {
  lat: 16.4023,
  lon: 120.5960,
  name: 'Baguio City'
}

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
        description: 'clear sky',
        icon: '01d'
      }],
      name: 'Baguio',
      sys: {
        country: 'PH'
      },
      dt: Math.floor(Date.now() / 1000) // Add current timestamp
    };
  }
}

export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
}

// Gemini API response type
export interface GeminiResponse {
  candidates: {
    content: {
      parts: {
        text: string
      }[]
    },
    finishReason: string
  }[]
}

// Itinerary data type
export interface ItineraryItem {
  period: string
  activities: {
    image: string | StaticImageData
    title: string
    time: string
    desc: string
    tags: string[]
    relevanceScore?: number
  }[]
}

export interface ItineraryData {
  title: string
  subtitle: string
  items: ItineraryItem[]
}

// Function to generate itinerary using Gemini API
export async function generateItinerary(
  prompt: string,
  weatherData: WeatherData | null = null
): Promise<ItineraryData | null> {
  try {
    const timestamp = new Date().getTime();
    const response = await fetch(`/api/gemini?_t=${timestamp}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        weatherData
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error(`Gemini API responded with status ${response.status}: ${errorText}`);
      throw new Error(`Gemini API error: ${response.status}`);
    }
    
    const data: GeminiResponse = await response.json();
    
    // Parse the response text to create an itinerary
    // This is a simplified version - in a real app, you'd want more robust parsing
    const responseText = data.candidates[0]?.content.parts[0]?.text;
    
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }
    
    // For now, return null as we'll handle the parsing in the component
    return null;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return null;
  }
}
