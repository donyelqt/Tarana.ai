import { GoogleGenerativeAI } from "@google/generative-ai";
import type { WeatherCondition } from "./types";

// Lightweight agentic helper: ask the model to propose up to N targeted sub-queries
// to improve retrieval coverage (e.g., fill gaps for weather, interests, or time slots).
// Returns a deduped list of short search queries.
export async function proposeSubqueries(params: {
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
  userPrompt: string;
  interests: string[] | undefined;
  weatherType: WeatherCondition;
  durationDays: number | null;
  existingTitles: string[];
  maxQueries?: number;
}): Promise<string[]> {
  const { model, userPrompt, interests, weatherType, durationDays, existingTitles } = params;
  const maxQueries = Math.min(params.maxQueries ?? 3, 5);
  try {
    const guidance = `
      You are assisting itinerary planning for Baguio. Propose up to ${maxQueries} short, specific retrieval sub-queries
      (no punctuation besides spaces) that would yield activities matching the user's needs but NOT already present
      in the existing titles list. Focus on filling gaps by:
      - current weather type: ${weatherType}
      - interests: ${(interests && interests.length > 0) ? interests.join(", ") : "(none specified)"}
      - durationDays: ${durationDays ?? "unknown"}
      - time-of-day coverage (morning/afternoon/evening) and budget fit when possible
      Existing titles: ${existingTitles.slice(0, 50).join(" | ")}
      Output a JSON array of strings only, e.g.: ["kid friendly indoor museum", "romantic dinner", "budget friendly viewpoint"].
    `;
    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: guidance + "\n\nUser prompt: " + userPrompt }] }],
    });
    const text = resp.response?.text() ?? "";
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    const set = new Set<string>();
    for (const q of arr) {
      if (typeof q === "string") {
        const trimmed = q.trim().replace(/[^a-z0-9\s-]/gi, "").toLowerCase();
        if (trimmed.length > 0) set.add(trimmed);
      }
    }
    return Array.from(set).slice(0, maxQueries);
  } catch {
    return [];
  }
}
