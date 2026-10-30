import { clsx, type ClassValue } from "clsx"
import { StaticImageData } from "next/image"
import { twMerge } from "tailwind-merge"
import { fetchWithTimeout } from "@/lib/upstream/withTimeout"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


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
  
  isFallback?: boolean;
  
  fallbackReason?: string;
}



import { getCityCenter } from '@/lib/data/cityConfig'
export const BAGUIO_COORDINATES = {
  ...getCityCenter('baguio'),
  name: 'Baguio City'
}

export async function fetchWeatherData(lat: number, lon: number, apiKey: string): Promise<WeatherData | null> {
  
  const response = await fetchWithTimeout(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`,
    {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' 
    },
    8000,
    'openweather'
  )

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No error details available');
    
    
    throw new Error(
      `Weather API error: ${response.status} — ${errorText.slice(0, 200)}`
    );
  }

  return response.json();
}

export async function fetchWeatherFromAPI(lat: number = BAGUIO_COORDINATES.lat, lon: number = BAGUIO_COORDINATES.lon): Promise<WeatherData | null> {
  
  
  
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    console.warn(`Weather fetch skipped: invalid coordinates lat=${String(lat).slice(0, 40)}, lon=${String(lon).slice(0, 40)} — serving fallback`);
    return {
      main: { temp: 18, feels_like: 16, humidity: 70 },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      name: 'Baguio',
      sys: { country: 'PH' },
      dt: Math.floor(Date.now() / 1000),
      isFallback: true,
      fallbackReason: 'client: invalid coordinates (not sent)',
    };
  }
  
  
  let fallbackReason = 'network';
  try {
    
    const timestamp = new Date().getTime();
    
    const baseUrl = typeof window === 'undefined'
      ? (process.env.NEXTAUTH_URL || 'http://localhost:3000')
      : '';

    const response = await fetch(`${baseUrl}/api/weather?lat=${latNum}&lon=${lonNum}&_t=${timestamp}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store' 
    });

    if (!response.ok) {
      
      
      
      const errorText = await response.text().catch(() => 'No error details');
      fallbackReason = summariseProxyFailure(response.status, errorText);
      console.warn(`Weather proxy ${response.status}: ${errorText.slice(0, 300)} — serving fallback`);
      throw new Error(`Weather API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Weather API error:')) {
      
      
    } else {
      console.error('Error fetching weather data from API:', error);
    }
    
    
    
    return {
      main: {
        temp: 18, 
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
      dt: Math.floor(Date.now() / 1000), 
      isFallback: true, 
      fallbackReason, 
    };
  }
}


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
    
  }
  const snippet = bodyText.trim().slice(0, 60);
  return snippet ? `proxy ${status}: ${snippet}` : `proxy ${status}`;
}

export function getWeatherIconUrl(iconCode: string): string {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`
}


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
    
    
    
    const responseText = data.candidates[0]?.content.parts[0]?.text;
    
    if (!responseText) {
      throw new Error('Empty response from Gemini API');
    }
    
    
    return null;
  } catch (error) {
    console.error('Error generating itinerary:', error);
    return null;
  }
}
