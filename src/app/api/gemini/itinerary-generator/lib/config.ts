import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import type { WeatherCondition } from "../types/types";

// Global initialization for Gemini model to avoid re-creating the client on every request.
export const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

const DEFAULT_MODEL_ID = "gemini-2.5-flash";
const configuredModelId = process.env.GOOGLE_GEMINI_MODEL?.trim();
const MODEL_ID = configuredModelId && configuredModelId.length > 0 ? configuredModelId : DEFAULT_MODEL_ID;

if (!configuredModelId && API_KEY) {
  console.log(`[Itinerary Generator] Using Gemini model: ${DEFAULT_MODEL_ID}`);
}

export const geminiModel = genAI ? genAI.getGenerativeModel({ 
  model: MODEL_ID,
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    },
  ],
}) : null;

// Pre-computed weather context lookup for faster processing
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
};

// Mapping of weather types to acceptable activity tags – used to pre-filter the sample DB sent to Gemini
export const WEATHER_TAG_FILTERS = {
  thunderstorm: [],
  rainy: [],
  snow: [],
  foggy: [],
  cloudy: [],
  clear: [],
  cold: [],
  default: []
} as const;

// Interest mapping for faster lookup - updated to match activities in itineraryData.ts
export const INTEREST_DETAILS = {
  "Nature & Scenery": "- Nature & Scenery: Burnham Park, Mines View Park, Botanical Garden, The Mansion, Wright Park, Camp John Hay, Bencab Museum, Baguio Cathedral, Mirador Heritage and Eco Park, Diplomat Hotel, Lions Head, Philippine Military Academy, Great wall of Baguio, Camp John Hay Yellow Trail, Valley of Colors, Mt. Kalugong, Tavern Cafe, Oh My Gulay, Hill Station",
  "Food & Culinary": "- Food & Culinary: Baguio Night Market, SM City Baguio, Baguio Public Market, Good Shepherd Convent, Chimichanga by Jaimes Family Feast, Kapi Kullaaw, Itaewon Cafe, Agara Ramen, KoCo Cafe, Good Shepherd Cafe, Tavern Cafe, Oh My Gulay, Hill Station, Hiraya Cafe, Uji-Matcha Cafe, K-Flavors Buffet, Korean Palace Kung Jeon, Myeong Dong Jjigae Restaurant",
  "Culture & Arts": "- Culture & Arts: Bencab Museum, Tam-Awan Village, Ili-Likha Artists Village, Baguio Cathedral, The Mansion, Diplomat Hotel, Philippine Military Academy, Mirador Heritage and Eco Park, Valley of Colors, Easter Weaving Room, Lions Head, Kapi Kullaaw",
  "Shopping & Local Finds": "- Shopping & Local Finds: Baguio Night Market, Baguio Public Market, SM City Baguio, Good Shepherd Convent, Easter Weaving Room, Ili-Likha Artists Village, Chimichanga by Jaimes Family Feast, Itaewon Cafe, Agara Ramen, KoCo Cafe, Good Shepherd Cafe, Hiraya Cafe, Uji-Matcha Cafe, K-Flavors Buffet, Korean Palace Kung Jeon, Myeong Dong Jjigae Restaurant",
  "Adventure": "- Adventure: Burnham Park, Wright Park, Camp John Hay, Tam-Awan Village, Great wall of Baguio, Camp John Hay Yellow Trail, Mt. Kalugong, Mines View Park"
};
