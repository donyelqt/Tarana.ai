// Type definitions for the Gemini API module

export interface WeatherData {
  weather?: { id: number; description: string }[];
  main?: { temp: number };
}

export interface RequestParams {
  prompt: string;
  weatherData: WeatherData;
  interests: string[];
  duration: string | number;
  budget: string;
  pax: string;
  sampleItinerary: any;
}

export interface ProcessedParams {
  prompt: string;
  weatherData: WeatherData;
  interests: string[];
  duration: number;
  budget: string;
  pax: string;
  budgetCategory: string | null;
  paxCategory: string | null;
  durationDays: number | null;
}

export interface VectorSearchResult {
  activity_id: string;
  similarity: number;
  metadata?: {
    title?: string;
    image?: string;
    desc?: string;
    tags?: string[];
    type?: string;
    time?: string;
    duration?: number;
    budget_category?: string;
    suitable_for?: string[];
  };
  score?: number;
}

export interface CacheItem {
  response: unknown;
  timestamp: number;
}

export type WeatherCondition = 
  | 'thunderstorm'
  | 'rainy'
  | 'snow'
  | 'foggy'
  | 'cloudy'
  | 'clear'
  | 'cold'
  | 'default';

export interface GeminiResponse {
  text: string;
  error?: string;
  fullResponse?: any;
  raw?: string;
}