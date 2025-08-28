import { GoogleGenerativeAI } from "@google/generative-ai";
import type { WeatherCondition } from "../types/types";
import { getManilaTime, getPeakHoursContext } from "@/lib/peakHours";
import { tomtomTrafficService } from "@/lib/tomtomTraffic";
import { getActivityCoordinates } from "@/lib/baguioCoordinates";

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
  includePeakHoursContext?: boolean;
  includeTrafficData?: boolean;
}): Promise<string[]> {
  const { model, userPrompt, interests, weatherType, durationDays, existingTitles, includePeakHoursContext = true, includeTrafficData = true } = params;
  const maxQueries = Math.min(params.maxQueries ?? 3, 5);
  
  // Get current Manila time context for peak hours optimization
  const manilaTime = getManilaTime();
  const currentTimeStr = manilaTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila'
  });
  
  // Get real-time traffic context for major Baguio locations
  let trafficContext = "";
  if (includeTrafficData) {
    console.log(`🚦 AGENT: Fetching real-time traffic data for subquery optimization`);
    try {
      // Sample key Baguio locations for traffic assessment
      const keyLocations = [
        { name: "Burnham Park", coords: getActivityCoordinates("Burnham Park") },
        { name: "Session Road", coords: getActivityCoordinates("Baguio Public Market") },
        { name: "Mines View Park", coords: getActivityCoordinates("Mines View Park") }
      ];
      
      const trafficPromises = keyLocations
        .filter(loc => loc.coords)
        .map(async (loc) => {
          try {
            const traffic = await tomtomTrafficService.getLocationTrafficData(loc.coords!.lat, loc.coords!.lon);
            return {
              area: loc.name,
              level: traffic?.trafficLevel || 'UNKNOWN',
              score: traffic?.recommendationScore || 50
            };
          } catch {
            return { area: loc.name, level: 'UNKNOWN', score: 50 };
          }
        });
      
      const trafficData = await Promise.all(trafficPromises);
      const lowTrafficAreas = trafficData.filter(t => t.level === 'LOW' || t.score >= 70);
      const highTrafficAreas = trafficData.filter(t => t.level === 'HIGH' || t.level === 'SEVERE');
      
      trafficContext = `
    - REAL-TIME TRAFFIC DATA: Current traffic conditions in Baguio:
      ${trafficData.map(t => `${t.area}: ${t.level} traffic (${t.score}% optimal)`).join(', ')}
    - LOW TRAFFIC AREAS: ${lowTrafficAreas.length > 0 ? lowTrafficAreas.map(t => t.area).join(', ') : 'None identified'}
    - AVOID HIGH TRAFFIC: ${highTrafficAreas.length > 0 ? highTrafficAreas.map(t => t.area).join(', ') : 'No major congestion'}
    - Prioritize activities near low-traffic areas or suggest alternative timing for congested locations.`;
      
      console.log(`✅ AGENT: Traffic context generated for ${trafficData.length} locations`);
    } catch (error) {
      console.warn(`⚠️ AGENT: Failed to fetch traffic data for subqueries:`, error);
      trafficContext = `
    - TRAFFIC DATA: Real-time traffic data unavailable, using peak hours guidance only.`;
    }
  }
  
  const peakHoursGuidance = includePeakHoursContext ? `
    - PEAK HOURS OPTIMIZATION: Current Manila time is ${currentTimeStr}. Prioritize activities that are typically less crowded at this time.
    - Consider low-traffic alternatives to popular tourist spots during peak hours (10 AM - 12 PM, 4 PM - 6 PM).
    - For current evening time, focus on activities that are good for evening visits or have lower crowds in the evening.` : "";
  
  try {
    const guidance = `
      You are assisting itinerary planning for Baguio. Propose up to ${maxQueries} short, specific retrieval sub-queries
      (no punctuation besides spaces) that would yield activities matching the user's needs but NOT already present
      in the existing titles list. Focus on filling gaps by:
      - current weather type: ${weatherType}
      - interests: ${(interests && interests.length > 0) ? interests.join(", ") : "(none specified)"}
      - durationDays: ${durationDays ?? "unknown"}
      - time-of-day coverage (morning/afternoon/evening) and budget fit when possible${peakHoursGuidance}${trafficContext}
      Existing titles: ${existingTitles.slice(0, 60).join(" | ")}
      Output a JSON array of strings only, e.g.: ["low traffic morning hike", "evening market less crowded", "indoor museum avoid peak hours", "activities near low traffic areas"].
    `;
    const resp = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: guidance + "\n\nUser prompt: " + userPrompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192
      }
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
