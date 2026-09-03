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
  /**
   * Set only on the offline fallback (fetchWeatherFromAPI catch path).
   * Optional so existing callers are unaffected — check with
   * isFallbackWeather() before presenting data as live.
   */
  isFallback?: boolean;
  /**
   * One-line machine-safe reason the fallback was served (e.g.
   * "proxy 502 (upstream 400)", "proxy 500 (not configured)", "network").
   * Shown under the dashboard badge so the next screenshot IS the diagnosis.
   */
  fallbackReason?: string;
}

// Baguio City coordinates — now delegates to cityConfig (single source of truth)
// Kept for backward compat; new code should use getCityCenter('baguio')
import { getCityCenter } from '@/lib/data/cityConfig'
export const BAGUIO_COORDINATES = {
  ...getCityCenter('baguio'),
  name: 'Baguio City'
}

export async function fetchWeatherData(lat: number, lon: number, apiKey: string): Promise<WeatherData | null> {
  // NOTE: never log the request URL — it carries the OpenWeather appid.
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
    // Propagate the upstream message (e.g. "wrong latitude", "Invalid API
    // key") so the single log line at the fallback site is actionable.
    throw new Error(
      `Weather API error: ${response.status} — ${errorText.slice(0, 200)}`
    );
  }

  return response.json();
}

export async function fetchWeatherFromAPI(lat: number = BAGUIO_COORDINATES.lat, lon: number = BAGUIO_COORDINATES.lon): Promise<WeatherData | null> {
  // Short machine-safe cause, surfaced on the fallback object so the UI can
  // display WHY live data is missing (no console spelunking required).
  let fallbackReason = 'network';
  try {
    // Add a timestamp to prevent caching issues
    const timestamp = new Date().getTime();
    // Use absolute URL in server context, relative in client
    const baseUrl = typeof window === 'undefined'
      ? (process.env.NEXTAUTH_URL || 'http://localhost:3000')
      : '';

    const response = await fetch(`${baseUrl}/api/weather?lat=${lat}&lon=${lon}&_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' // Disable caching
    });

    if (!response.ok) {
      // Single actionable log line (the route already logged server-side with
      // upstream status/message): proxy status + upstream detail, then fall
      // through to the fallback below.
      const errorText = await response.text().catch(() => 'No error details');
      fallbackReason = summariseProxyFailure(response.status, errorText);
      console.warn(`Weather proxy ${response.status}: ${errorText.slice(0, 300)} — serving fallback`);
      throw new Error(`Weather API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Weather API error:')) {
      // Already logged above with context — don't log twice (this was the
      // double-console-error spam: utils.ts:92 + utils.ts:93 on every failure).
    } else {
      console.error('Error fetching weather data from API:', error);
    }
    
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
      dt: Math.floor(Date.now() / 1000), // Add current timestamp
      isFallback: true, // Lets the UI badge this as typical, not live, weather
      fallbackReason, // Shown under the badge — the next screenshot is the diagnosis
    };
  }
}

/**
 * Compress a proxy failure into a badge-sized reason. Parses the route's JSON
 * error shape ({ error, upstreamStatus, upstreamMessage }) when present.
 */
export function summariseProxyFailure(status: number, bodyText: string): string {
  try {
    const body = JSON.parse(bodyText) as {
      error?: unknown;
      upstreamStatus?: unknown;
      upstreamMessage?: unknown;
    };
    if (typeof body?.upstreamMessage === 'string' && body.upstreamMessage) {
      return `proxy ${status} (upstream ${String(body.upstreamStatus ?? '?')}): ${body.upstreamMessage.slice(0, 80)}`;
    }
    if (typeof body?.error === 'string' && body.error) {
      return `proxy ${status}: ${body.error.slice(0, 80)}`;
    }
  } catch {
    // Not JSON — fall through to the raw-status form below.
  }
  const snippet = bodyText.trim().slice(0, 60);
  return snippet ? `proxy ${status}: ${snippet}` : `proxy ${status}`;
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
