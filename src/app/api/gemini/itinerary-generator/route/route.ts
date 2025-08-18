import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { searchSimilarActivities } from "@/lib/vectorSearch";
// Import the canonical sample itinerary so we can look up images by title as a fallback
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";
// Extracted helpers
import { proposeSubqueries } from "../agent/agent";
import {
  ensureFullItinerary,
  removeDuplicateActivities,
  organizeItineraryByDays,
} from "../utils/itineraryUtils";
import type { WeatherCondition } from "../types/types";
// Peak hours management
import {
  getPeakHoursContext,
  filterLowTrafficActivities,
  getManilaTime,
  isCurrentlyPeakHours
} from "@/lib/peakHours";

// Global initialization for Gemini model to avoid re-creating the client on every request.
const API_KEY = process.env.GOOGLE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;
const geminiModel = genAI ? genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" }) : null;

// Simple in-memory cache for similar requests
const responseCache = new Map<string, { response: any; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Define a type for the keys of WEATHER_CONTEXTS
// Pre-computed weather context lookup for faster processing
const WEATHER_CONTEXTS = {
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
const WEATHER_TAG_FILTERS = {
  thunderstorm: ["Indoor-Friendly"],
  rainy: ["Indoor-Friendly"],
  snow: ["Indoor-Friendly"],
  foggy: ["Indoor-Friendly", "Weather-Flexible"],
  cloudy: ["Outdoor-Friendly", "Weather-Flexible"],
  clear: ["Outdoor-Friendly"],
  cold: ["Indoor-Friendly"],
  default: []
} as const;

// Interest mapping for faster lookup
const INTEREST_DETAILS = {
  "Nature & Scenery": "- Nature & Scenery: Burnham Park, Mines View Park, Wright Park, Camp John Hay, Botanical Garden, Mirador Heritage & Eco Park, Valley of Colors, Mt. Kalugong, Mt. Yangbew, Great Wall of Baguio, Camp John Hay Yellow Trail, Lions Head",
  "Food & Culinary": "- Food & Culinary: Good Taste Restaurant, Café by the Ruins, Hill Station, Vizco's, Baguio Craft Brewery, Oh My Gulay, Choco-late de Batirol, Ili-Likha Food Hub, Canto Bogchi Joint, Arca's Yard, Amare La Cucina, Le Chef at The Manor, Lemon and Olives, Grumpy Joe, Luisa's Cafe, Agara Ramen, 50's Diner, Balajadia Kitchenette, Wagner Cafe, Pizza Volante",
  "Culture & Arts": "- Culture & Arts: BenCab Museum, Tam-awan Village, Baguio Museum, Ili-Likha Artist Village, Baguio Cathedral, The Mansion, Diplomat Hotel, Philippine Military Academy, Igorot Stone Kingdom, Laperal White House, Mt. Cloud Bookshop, Mirador Heritage & Eco Park, Oh My Gulay",
  "Shopping & Local Finds": "- Shopping & Local Finds: Night Market on Harrison Road, Baguio Public Market, Session Road shops, SM City Baguio, Good Shepherd Convent, Easter Weaving Room, Baguio Craft Market, Ili-Likha Food Hub",
  "Adventure": "- Adventure: Tree Top Adventure, Mt. Ulap Eco-Trail, Mines View Park horseback riding, Wright Park horseback riding, Camp John Hay Yellow Trail, Great Wall of Baguio, Mt. Kalugong, Mt. Yangbew, Camp John Hay, Valley of Colors"
};

async function processItinerary(parsed: any, prompt: string, durationDays: number | null, model: any) {
  let processed = removeDuplicateActivities(parsed);
  processed = organizeItineraryByDays(processed, durationDays);
  if (durationDays && model) {
    processed = await ensureFullItinerary(processed, prompt, durationDays, model);
  }

  // Final cleanup of any placeholder activities or duplicates that might have been added.
  if (processed && typeof processed === "object" && Array.isArray((processed as any).items)) {
    const seenActivities = new Set<string>();
    (processed as any).items = (processed as any).items
      .map((period: any) => {
        const filteredActivities = Array.isArray(period.activities)
          ? period.activities.filter((act: any) => {
              if (!act.title || act.title.toLowerCase() === "no available activity") {
                return false;
              }
              if (seenActivities.has(act.title)) {
                return false;
              }
              seenActivities.add(act.title);
              return true;
            })
          : [];
        return { ...period, activities: filteredActivities };
      });
  }
  return processed;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, weatherData, interests, duration, budget, pax, sampleItinerary } = await req.json();

    // We now always build the itinerary from the vector database (pgvector).
    // Any sampleItinerary sent by the client is ignored except for logging purposes.
    let effectiveSampleItinerary: any = null;

    // Log the incoming request body for debugging
    console.log("Gemini API request body:", { prompt, weatherData, interests, duration, budget, pax, sampleItinerary });

    // Check and log API key presence
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY || "";
    if (!apiKey) {
      console.error("GOOGLE_GEMINI_API_KEY is missing!");
      return NextResponse.json({ text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." }, { status: 500 });
    }

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    
    // Generate cache key based on request parameters
    const cacheKey = JSON.stringify({
      prompt: prompt?.substring(0, 100), // First 100 chars for similarity
      weatherId: weatherData?.weather?.[0]?.id,
      temp: Math.round(weatherData?.main?.temp || 0),
      interests: interests?.sort(),
      duration,
      budget,
      pax
    });
    
    // Check cache for recent similar requests
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.response);
    }

    // Re-use the globally initialised model (created once per lambda / server instance)
    const model = geminiModel;
    if (!model) {
      console.error("Gemini model is not initialized – missing API key?");
      return NextResponse.json({ text: "", error: "Gemini model not available." }, { status: 500 });
    }

    // Optimized weather processing
    const weatherId = weatherData?.weather?.[0]?.id || 0;
    const weatherDescription = weatherData?.weather?.[0]?.description || "";
    const temperature = weatherData?.main?.temp || 20;
    
    // Fast weather type determination
    const getWeatherType = (id: number, temp: number): WeatherCondition => {
      if (id >= 200 && id <= 232) return 'thunderstorm';
      if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
      if (id >= 600 && id <= 622) return 'snow';
      if (id >= 701 && id <= 781) return 'foggy';
      if (id === 800) return 'clear';
      if (id >= 801 && id <= 804) return 'cloudy';
      if (temp < 15) return 'cold';
      return 'default';
    };
    
    const weatherType: WeatherCondition = getWeatherType(weatherId, temperature);
    const weatherContext = WEATHER_CONTEXTS[weatherType](temperature, weatherDescription);

    // Normalize UI inputs to internal categories for consistent prompt building
    const durationDays = (() => {
      if (!duration) return null;
      const match = duration.toString().match(/\d+/); // extract first number
      return match ? parseInt(match[0], 10) : null;
    })();

    const budgetCategory = (() => {
      if (!budget) return null;
      if (budget === "less than ₱3,000/day" || budget === "₱3,000 - ₱5,000/day") return "Budget";
      if (budget === "₱5,000 - ₱10,000/day") return "Mid-range";
      if (budget === "₱10,000+/day") return "Luxury";
      return budget; // fallback to the raw value
    })();

    const paxCategory = (() => {
      if (!pax) return null;
      if (pax === "1") return "Solo";
      if (pax === "2") return "Couple";
      if (pax === "3-5") return "Family";
      if (pax === "6+") return "Group";
      return pax; // fallback to the raw value
    })();

    // ------------------
    // Prefilter sample itinerary to reduce prompt size and latency
    // ------------------
    if (effectiveSampleItinerary && typeof effectiveSampleItinerary === "object") {
      const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
      const interestSet = new Set(
        interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
      );
      effectiveSampleItinerary = {
        ...effectiveSampleItinerary,
        items: effectiveSampleItinerary.items.map((section: any) => ({
          ...section,
          activities: section.activities.filter((act: any) => {
            const interestMatch =
              interestSet.size === 0 || act.tags.some((t: string) => interestSet.has(t));
            const weatherMatch =
              allowedWeatherTags.length === 0 || act.tags.some((t: string) => allowedWeatherTags.includes(t));
            return interestMatch && weatherMatch;
          }),
        })),
      };
    }

    // Enhanced RAG + minimal agent loop: Build the activity database from vector search,
    // let the model propose targeted sub-queries for better coverage, then re-search and merge.
    if (typeof prompt === "string" && prompt.length > 0) {
      try {
        // Initial retrieval
        let similar = await searchSimilarActivities(prompt, 60);

        // Agentic planning: if the pool is small or we want better coverage, ask for sub-queries
        const existingTitles = (similar || []).map(s => s.metadata?.title || s.activity_id);
        const subqueries = await proposeSubqueries({
          model,
          userPrompt: prompt,
          interests: Array.isArray(interests) ? interests : undefined,
          weatherType,
          durationDays,
          existingTitles,
          maxQueries: 3
        });

        if (subqueries.length > 0) {
          const batch = await searchSimilarActivities(subqueries, 30);
          // Merge and dedupe by title, keep best similarity
          const byTitle = new Map<string, { activity_id: string; similarity: number; metadata: Record<string, any>; }>();
          for (const s of [...similar, ...batch]) {
            const title: string = s.metadata?.title || s.activity_id;
            if (!byTitle.has(title) || byTitle.get(title)!.similarity < s.similarity) {
              byTitle.set(title, s);
            }
          }
          similar = Array.from(byTitle.values());
        }

        // Apply weather + interest filters before constructing the itinerary object
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
        const interestSet = new Set(
          interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
        );

        // Enhanced filtering with weighted relevance scoring including peak hours
        const scoredSimilar = (similar || []).map((s) => {
          const tags = Array.isArray(s.metadata?.tags) ? s.metadata.tags : [];
          const peakHours = s.metadata?.peakHours || "";
          const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
          const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
          const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
          
          // Calculate relevance score based on multiple factors
          let relevanceScore = s.similarity; // Base score from vector similarity
          
          // Boost score for interest matches
          if (interestMatch && interestSet.size > 0) {
            const matchCount = tags.filter((t: string) => interestSet.has(t)).length;
            relevanceScore += (matchCount / interestSet.size) * 0.3; // Up to 30% boost for interest matches
          }
          
          // Boost score for weather appropriateness
          if (weatherMatch && allowedWeatherTags.length > 0) {
            const matchCount = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
            relevanceScore += (matchCount / allowedWeatherTags.length) * 0.2; // Up to 20% boost for weather matches
          }
          
          // Boost score for low-traffic activities (not currently in peak hours)
          if (!isCurrentlyPeak) {
            relevanceScore += 0.25; // 25% boost for activities not in peak hours
          } else {
            relevanceScore -= 0.1; // Small penalty for activities currently in peak hours
          }
          
          return {
            ...s,
            relevanceScore,
            interestMatch,
            weatherMatch,
            isCurrentlyPeak,
            peakHours
          };
        });

        // Filter and sort by relevance score
        const filteredSimilar = scoredSimilar
          .filter(s => s.interestMatch && s.weatherMatch)
          .sort((a, b) => b.relevanceScore - a.relevanceScore)
          .slice(0, 40); // Keep top 40 most relevant activities

        if (filteredSimilar.length > 0) {
          // Group activities by time periods for better organization
          const morningActivities: any[] = [];
          const afternoonActivities: any[] = [];
          const eveningActivities: any[] = [];
          const anytimeActivities: any[] = [];
          
          filteredSimilar.forEach(s => {
            const timeStr = s.metadata?.time?.toLowerCase() || "";
            const activity = {
              image: s.metadata?.image || "",
              title: s.metadata?.title || s.activity_id,
              time: s.metadata?.time || "",
              desc: s.metadata?.desc || "",
              tags: s.metadata?.tags || [],
              peakHours: s.metadata?.peakHours || "",
              relevanceScore: s.relevanceScore, // Include score for debugging/transparency
              isCurrentlyPeak: s.isCurrentlyPeak
            };
            
            if (timeStr.includes("am") || timeStr.includes("morning")) {
              morningActivities.push(activity);
            } else if (timeStr.includes("pm") || timeStr.includes("afternoon")) {
              afternoonActivities.push(activity);
            } else if (timeStr.includes("evening") || timeStr.includes("night")) {
              eveningActivities.push(activity);
            } else {
              anytimeActivities.push(activity);
            }
          });
          
          // Create a more structured itinerary with time periods
          const items = [];
          
          if (morningActivities.length > 0) {
            items.push({
              period: "Morning",
              activities: morningActivities
            });
          }
          
          if (afternoonActivities.length > 0) {
            items.push({
              period: "Afternoon",
              activities: afternoonActivities
            });
          }
          
          if (eveningActivities.length > 0) {
            items.push({
              period: "Evening",
              activities: eveningActivities
            });
          }
          
          if (anytimeActivities.length > 0) {
            items.push({
              period: "Flexible Time",
              activities: anytimeActivities
            });
          }
          
          effectiveSampleItinerary = {
            title: "Personalized Recommendations",
            subtitle: "Activities matched to your preferences using semantic search",
            items: items.length > 0 ? items : [
              {
                period: "Anytime",
                activities: filteredSimilar.map(s => ({
                  image: s.metadata?.image || "",
                  title: s.metadata?.title || s.activity_id,
                  time: s.metadata?.time || "",
                  desc: s.metadata?.desc || "",
                  tags: s.metadata?.tags || [],
                  peakHours: s.metadata?.peakHours || "",
                  relevanceScore: s.relevanceScore,
                  isCurrentlyPeak: s.isCurrentlyPeak
                }))
              }
            ]
          } as any;
        }
      } catch (vecErr) {
        console.warn("Vector search failed", vecErr);
      }
    }

    // Use effectiveSampleItinerary downstream

    // Get peak hours context for current Manila time
    const peakHoursContext = getPeakHoursContext();
    
    // Enhanced RAG context - send the filtered DB with relevance scores and peak hours instructions
    const sampleItineraryContext = effectiveSampleItinerary
      ? `EXCLUSIVE DATABASE: ${JSON.stringify(effectiveSampleItinerary)}\n\nABSOLUTE RULE: You MUST ONLY use activities from this database. This is the COMPLETE list of available activities. DO NOT create, invent, or suggest any activity not in this list. Activities are pre-filtered and ranked by relevance. Higher relevanceScore values indicate better matches. Activities marked with isCurrentlyPeak: true are currently crowded and should be scheduled for later or replaced with alternatives from this same database.`
      : "ERROR: No activities found in database. Return an error message stating insufficient data.";

    // Weather context is now handled by the lookup table above

    // Add user preference context
    let interestsContext = "";
    if (interests && Array.isArray(interests) && interests.length > 0 && !interests.includes("Random")) {
      interestsContext = `
        The visitor has expressed specific interest in: ${interests.join(", ")}.
        From the sample itinerary database, prioritize activities that have tags matching these interests:
        ${interests.map((interest: string) => INTEREST_DETAILS[interest as keyof typeof INTEREST_DETAILS] || `- ${interest}: Select appropriate activities from the sample database`).join("\n")}
        
        Ensure these activities are also appropriate for the current weather conditions.
      `;
    } else {
      interestsContext = `
        The visitor hasn't specified particular interests, so provide a balanced mix of Baguio's highlights across different categories.
        Select a variety of activities from the sample itinerary database that cover different interest areas.
      `;
    }

    // Add duration context
    let durationContext = "";
    if (durationDays) {
      durationContext = `
        This is a ${durationDays}-day trip, so pace the itinerary accordingly:
        ${durationDays === 1 ? "Focus on must-see highlights and efficient time management. Select 2-3 activities per time period (morning, afternoon, evening) from the sample database." : ""}
        ${durationDays === 2 ? "Balance major attractions with some deeper local experiences. Select 2-3 activities per time period per day from the sample database." : ""}
        ${durationDays === 3 ? "Include major attractions and allow time to explore local neighborhoods. Select 2 activities per time period per day from the sample database, allowing for more relaxed pacing." : ""}
        ${durationDays >= 4 ? "Include major attractions, local experiences, and some day trips to nearby areas. Select 1-2 activities per time period per day from the sample database, allowing for a very relaxed pace." : ""}
      `;
    }

    // Add budget context
    let budgetContext = "";
    if (budgetCategory) {
      budgetContext = `
        The visitor's budget preference is ${budget}, so recommend:
        ${budgetCategory === "Budget" ? "From the sample itinerary database, prioritize activities with the 'Budget-friendly' tag. Focus on affordable dining, free/low-cost attractions, public transportation, and budget accommodations." : ""}
        ${budgetCategory === "Mid-range" ? "From the sample itinerary database, select a mix of budget and premium activities. Include moderate restaurants, standard attraction fees, occasional taxis, and mid-range accommodations." : ""}
        ${budgetCategory === "Luxury" ? "From the sample itinerary database, include premium experiences where available. Recommend fine dining options, premium experiences, private transportation, and luxury accommodations." : ""}
      `;
    }

    // Add group size context
    let paxContext = "";
    if (paxCategory) {
      paxContext = `
        The group size is ${pax}, so consider:
        ${paxCategory === "Solo" ? "From the sample itinerary database, select activities that are enjoyable for solo travelers. Include solo-friendly activities, social opportunities, and safety considerations." : ""}
        ${paxCategory === "Couple" ? "From the sample itinerary database, prioritize activities suitable for couples. Include romantic settings, couple-friendly activities, and intimate dining options." : ""}
        ${paxCategory === "Family" ? "From the sample itinerary database, prioritize activities with the 'Family-friendly' tag if available. Include family-friendly activities, child-appropriate options, and group dining venues." : ""}
        ${paxCategory === "Group" ? "From the sample itinerary database, select activities that can accommodate larger parties. Include group-friendly venues, activities that accommodate larger parties, and group dining options." : ""}
      `;
    }

    // Construct a detailed prompt for the AI with RAG-enhanced instructions
    const detailedPrompt = `
      ${prompt}
      
      ${sampleItineraryContext}
      ${weatherContext}
      ${peakHoursContext}
      ${interestsContext}
      ${durationContext}
      ${budgetContext}
      ${paxContext}
      
      Generate a detailed Baguio City itinerary using the semantically retrieved activities from the database. For multi-day itineraries, ensure each activity is only recommended once across all days.

      Rules:
      1. **Be concise and personalized.**
      2. **MANDATORY: ONLY use activities from the provided RAG database.** You are FORBIDDEN from creating, inventing, or suggesting ANY activity that is not explicitly listed in the database above. Every single activity in your response MUST have an exact match in the database with the same title, exact image URL, and description. Use ONLY the image URLs provided in the database - do not modify, substitute, or generate alternative image URLs. If the database is empty or insufficient, return fewer activities rather than inventing new ones.
      3. **Prioritize activities with higher relevanceScore values** as they are more closely aligned with the user's query, interests, weather conditions, and current traffic levels.
      4. **PEAK HOURS OPTIMIZATION:** Activities marked with isCurrentlyPeak: true are currently crowded. Either schedule them for later when they're less busy, or choose alternative activities that are not currently in peak hours. Use the peakHours field to suggest optimal visit times.
      5. Organize by Morning (8AM-12NN), Afternoon (12NN-6PM), Evening (6PM onwards), respecting the time periods already suggested in the database.
      ${durationDays ? `5.a. Ensure the itinerary spans exactly ${durationDays} day(s). Create separate day sections and, within each day, include Morning, Afternoon, and Evening periods populated only from the database.` : ""}
      6. Pace the itinerary based on trip duration, ensuring a balanced schedule.
      7. For each activity, include: **image** (MUST be the exact image URL from the database - do not modify or substitute), **title** (exact title from the database), **time** slot (e.g., "9:00-10:30AM"), a **brief** description that mentions optimal visit times to avoid crowds, and **tags** (exact tags from the database).
      8. **TRAFFIC-AWARE DESCRIPTIONS:** In the description, mention when each activity is less crowded based on the peakHours data. For example: "Best visited after 2 PM to avoid morning crowds" or "Currently low traffic - perfect time to visit!"
      9. Adhere to the user's budget preferences by selecting only activities from the database that match the budget category.
      10. **CRITICAL: DO NOT REPEAT activities across different days.** Each activity should only be recommended once in the entire itinerary.
      11. **VALIDATION REQUIREMENT:** Before including any activity, verify it exists in the provided database. If you cannot find sufficient activities in the database to fill the requested itinerary duration, return a shorter itinerary with only the available database activities.
      12. If the database already contains organized time periods (Morning, Afternoon, Evening), use that structure as a starting point and refine it based on the user's needs and current traffic conditions.
      13. **OUTPUT FORMAT:** Return a JSON object with this exact structure: { "title": "Your X Day Itinerary", "subtitle": "...", "items": [{"period": "...", "activities": [{"image": "...", "title": "...", "time": "...", "desc": "...", "tags": [...]}]}] }
      14. **FINAL CHECK:** Before outputting, verify every single activity title, image URL, and tags match exactly with the provided database entries. Each image field must contain the exact URL string from the database without any modifications.
    `;

    // Optimized generation parameters for faster response
    const generationConfig = {
      responseMimeType: "application/json",
      temperature: 2,  // Lowered for faster, more deterministic responses
      topK: 1,          // Further reduced for faster token selection
      topP: 0.9,         // Kept the same to maintain quality
      maxOutputTokens: 8192 // Increased to prevent incomplete JSON which causes API errors.
    };

    // Generate the itinerary with retry logic to gracefully handle temporary overloads (e.g., 503 Service Unavailable) or rate limits (429).
    const MAX_RETRIES = 3;
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    let result: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
          generationConfig,
        });
        break; // Success – exit retry loop.
      } catch (err: any) {
        const status = err?.status || err?.response?.status;
        // Retry only for transient errors
        if (attempt < MAX_RETRIES && (status === 503 || status === 429)) {
          const delay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          console.warn(`Gemini transient error (status ${status}). Retry ${attempt} of ${MAX_RETRIES} after ${delay}ms`);
          await sleep(delay);
          continue;
        }
        // If not retryable or retries exhausted, rethrow to be handled by outer catch.
        throw err;
      }
    }

    // If result is still null here, all retries failed.
    if (!result) {
      return NextResponse.json(
        { text: "", error: "Failed to generate content after multiple retries due to service unavailability." },
        { status: 503 }
      );
    }

    // Log the result object for debugging
    console.log("Gemini result object:", result);
    // Log the full response object for debugging
    console.log("Gemini full response object:", result.response);

    const response = result.response;
    const text = response.text();
    
    // Log the raw Gemini response for debugging
    console.log("Gemini raw response text:", text);
    
    // If text is empty, return the full response object for debugging
    let finalText = text;
    if (!finalText) {
      // Try to manually extract text from candidates[0].content.parts
      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts;
      if (Array.isArray(parts)) {
        finalText = parts.map(p => p.text || '').join('');
        console.log("Manually extracted Gemini text:", finalText);
      }
      if (!finalText) {
        return NextResponse.json({ text: "", error: "Gemini response.text() and manual extraction are empty", fullResponse: response });
      }
    }
    
    // Enhanced JSON extraction and parsing with multiple fallback strategies
    let cleanedJson = finalText;
    let parseAttempts = [];

    // Strategy 1: Extract from markdown code blocks
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1];
      parseAttempts.push('markdown_extraction');
    }

    // Strategy 2: Find JSON object boundaries
    const firstBrace = cleanedJson.indexOf('{');
    const lastBrace = cleanedJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const potentialJson = cleanedJson.slice(firstBrace, lastBrace + 1);
      parseAttempts.push('brace_extraction');
      
      // Try parsing the extracted JSON first
      try {
        let parsed = JSON.parse(potentialJson);
        console.log("Successfully parsed JSON using brace extraction");
        parsed = await processItinerary(parsed, prompt, durationDays, model);
        const responseData = { text: JSON.stringify(parsed) };
        responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
        return NextResponse.json(responseData);
      } catch (braceError: any) {
        console.warn("Brace extraction failed, trying cleaning:", braceError?.message || braceError);
        cleanedJson = potentialJson;
      }
    }

    // Strategy 3: Clean the JSON string
    cleanedJson = cleanedJson
      .replace(/\/\/.*$/gm, '')       // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/,\s*([\]}])/g, '$1')   // Remove trailing commas
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
      .replace(/\n\s*\n/g, '\n')      // Remove empty lines
      .trim();

    // Log the cleaned JSON before parsing
    console.log("Cleaned JSON to parse:", cleanedJson.substring(0, 500) + '...');
    console.log("Parse attempts:", parseAttempts);

    // Strategy 4: Try parsing the cleaned JSON
    try {
      let parsed = JSON.parse(cleanedJson);
      console.log("Successfully parsed JSON after cleaning");
      parsed = await processItinerary(parsed, prompt, durationDays, model);
      const responseData = { text: JSON.stringify(parsed) };
      responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
      return NextResponse.json(responseData);
    } catch (cleanError: any) {
      console.error("Cleaned JSON parsing failed:", cleanError?.message || cleanError);
      
      // Strategy 5: Try to fix common JSON issues
      try {
        let fixedJson = cleanedJson
          .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":') // Add quotes to unquoted keys
          .replace(/:\s*'([^']*)'/g, ': "$1"')  // Replace single quotes with double quotes
          .replace(/,\s*}/g, '}')               // Remove trailing commas before closing braces
          .replace(/,\s*]/g, ']');              // Remove trailing commas before closing brackets
        
        let parsed = JSON.parse(fixedJson);
        console.log("Successfully parsed JSON after fixing common issues");
        parsed = await processItinerary(parsed, prompt, durationDays, model);
        const responseData = { text: JSON.stringify(parsed) };
        responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
        return NextResponse.json(responseData);
      } catch (fixError: any) {
        console.error("JSON fixing failed:", fixError?.message || fixError);
        
        // Strategy 6: Last resort - return detailed error for debugging
        console.error("All JSON parsing strategies failed. Raw response:", finalText.substring(0, 1000));
        return NextResponse.json({ 
          text: "", 
          error: "Failed to parse JSON from Gemini response after multiple attempts.", 
          details: {
            originalError: cleanError?.message || String(cleanError),
            fixError: fixError?.message || String(fixError),
            parseAttempts,
            rawResponsePreview: finalText.substring(0, 500)
          }
        });
      }
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    // Handle rate limit errors
    if (typeof error === 'object' && error !== null && 'status' in error && (error as any).status === 429) {
      return NextResponse.json(
        { text: "", error: "API quota exceeded. Please check your plan and billing details, or try again later." },
        { status: 429 }
      );
    } else if (typeof error === 'object' && error !== null && 'status' in error && (error as any).status === 503) {
      return NextResponse.json(
        { text: "", error: "The Gemini model is currently overloaded. Please try again shortly." },
        { status: 503 }
      );
    }
    
    // Handle other errors
    return NextResponse.json(
      { text: "", error: "Failed to generate content." },
      { status: 500 }
    );
  }
}
