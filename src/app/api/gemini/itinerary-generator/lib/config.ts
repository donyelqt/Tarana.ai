import { GoogleGenerativeAI } from "@google/generative-ai";
import type { WeatherCondition } from "../types/types";

// Global initialization for Gemini model to avoid re-creating the client on every request.
export const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
export const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
export const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.5-flash" }) : null;


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
  thunderstorm: ["Indoor-Friendly"],
  rainy: ["Indoor-Friendly"],
  snow: ["Indoor-Friendly"],
  foggy: ["Indoor-Friendly", "Weather-Flexible"],
  cloudy: ["Outdoor-Friendly", "Weather-Flexible"],
  clear: ["Outdoor-Friendly"],
  cold: ["Indoor-Friendly"],
  default: []
} as const;

// Interest mapping for faster lookup - updated to match activities in itineraryData.ts
export const INTEREST_DETAILS = {
  "Nature & Scenery": "- Nature & Scenery: Burnham Park, Mines View Park, Wright Park, Camp John Hay, Botanical Garden, Mirador Heritage and Eco Park, Valley of Colors, Mt. Kalugong, Great wall of Baguio, Camp John Hay Yellow Trail, Lions Head, Baguio Cathedral, The Mansion, Diplomat Hotel",
  "Food & Culinary": "- Food & Culinary: Baguio Night Market, SM City Baguio, Baguio Public Market, Good Shepherd Convent",
  "Culture & Arts": "- Culture & Arts: Bencab Museum, Tam-Awan Village, Ili-Likha Artists Village, Baguio Cathedral, The Mansion, Diplomat Hotel, Philippine Military Academy, Mirador Heritage and Eco Park, Valley of Colors, Easter Weaving Room",
  "Shopping & Local Finds": "- Shopping & Local Finds: Baguio Night Market, Baguio Public Market, SM City Baguio, Good Shepherd Convent, Easter Weaving Room, Ili-Likha Artists Village",
  "Adventure": "- Adventure: Burnham Park, Wright Park, Camp John Hay, Tam-Awan Village, Great wall of Baguio, Camp John Hay Yellow Trail, Mt. Kalugong"
};
