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
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
    )
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching weather data:', error)
    return null
  }
}

// Client-side function to fetch weather data through our secure API route
export async function fetchWeatherFromAPI(lat: number = BAGUIO_COORDINATES.lat, lon: number = BAGUIO_COORDINATES.lon): Promise<WeatherData | null> {
  try {
    const response = await fetch(`/api/weather?lat=${lat}&lon=${lon}`)
    
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error('Error fetching weather data from API:', error)
    return null
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
