import { NextRequest, NextResponse } from "next/server";
import { SampleItinerary } from "@/lib/types";

// Types and utilities from modularized Gemini helpers
import { RequestParams, WeatherCondition } from "@/lib/gemini/types";
import { WEATHER_CONTEXTS, getWeatherType } from "@/lib/gemini/weather";
import { getFromCache, setInCache, cleanupCache } from "@/lib/gemini/cache";
import { buildActivitiesFromVector, toSampleItineraryFromVector } from "@/lib/gemini/vectorPipeline";
import {
  buildInterestsContext,
  normalizeBudget,
  normalizePax,
  extractDurationDays,
  buildDurationContext,
  buildBudgetContext,
  buildPaxContext,
  buildDetailedPrompt,
} from "@/lib/gemini/prompt";
import { generateItinerary } from "@/lib/gemini/geminiService";
import {
  extractAndCleanJSON,
  buildTitleToImageLookup,
  cleanupActivities,
  attemptJSONSalvage,
} from "@/lib/gemini/responseProcessor";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const requestBody: RequestParams = await req.json();
    const { prompt, weatherData, interests, duration: rawDuration, budget, pax, sampleItinerary } = requestBody;

    // Validate and parse duration
    const duration = typeof rawDuration === "string"
      ? parseInt(rawDuration.replace(/\D/g, ""), 10)
      : typeof rawDuration === "number"
      ? rawDuration
      : 1;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Generate cache key
    const cacheKey = JSON.stringify({
      prompt: prompt?.substring(0, 100),
      weatherId: weatherData?.weather?.[0]?.id ?? null,
      temp: Math.round(weatherData?.main?.temp ?? 0),
      interests: Array.isArray(interests) ? [...interests].sort() : [],
      duration,
      budget,
      pax,
    });

    // Check cache
    const cached = getFromCache(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    cleanupCache();

    // Process weather data
    const weatherId = weatherData?.weather?.[0]?.id ?? 0;
    const weatherDescription = weatherData?.weather?.[0]?.description ?? "";
    const temperature = weatherData?.main?.temp ?? 20;

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

    // Enhanced RAG approach: Build the activity database from vector similarity search with semantic relevance.
    if (typeof prompt === "string" && prompt.length > 0) {
      try {
        // Fetch more matches for a richer pool and better semantic matching
        const similar = await searchSimilarActivities(prompt, 60); 

        // Apply weather + interest filters before constructing the itinerary object
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
        const interestSet = new Set(
          interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
        );

        // Enhanced filtering with weighted relevance scoring
        const scoredSimilar = (similar || []).map((s) => {
          const tags = s.metadata?.tags || [];
          const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
          const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
          
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
          
          return {
            ...s,
            relevanceScore,
            interestMatch,
            weatherMatch
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
              relevanceScore: s.relevanceScore // Include score for debugging/transparency
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
                  relevanceScore: s.relevanceScore
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

    // Enhanced RAG context - send the filtered DB with relevance scores and clear instructions
    const sampleItineraryContext = effectiveSampleItinerary
      ? `Database: ${JSON.stringify(effectiveSampleItinerary)}\n\nRULE: Only use activities from this database. Activities are already pre-filtered and ranked by relevance to the user's query, interests, and current weather conditions. Higher relevanceScore values indicate better matches to the user's needs. Prioritize activities with higher relevance scores when creating the itinerary.`
      : "";

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
      ${interestsContext}
      ${durationContext}
      ${budgetContext}
      ${paxContext}
      
      Generate a detailed Baguio City itinerary using the semantically retrieved activities from the database. For multi-day itineraries, ensure each activity is only recommended once across all days.

      Rules:
      1. **Be concise and personalized.**
      2. **Strictly use the provided RAG-enhanced activity database.** The database contains activities that have been semantically matched to the user's query and preferences. Do NOT invent, suggest, or mention any activity, place, or experience that is not present in the provided database.
      3. **Prioritize activities with higher relevanceScore values** as they are more closely aligned with the user's query, interests, and weather conditions.
      4. Organize by Morning (8AM-12NN), Afternoon (12NN-6PM), Evening (6PM onwards), respecting the time periods already suggested in the database.
      5. Pace the itinerary based on trip duration, ensuring a balanced schedule.
      6. For each activity, include: **image** (exact image URL from the database), **title**, **time** slot (e.g., "9:00-10:30AM"), a **brief** description (features, costs, location, duration, weather notes), and **tags** (interest and weather).
      7. Adhere to the user's budget preferences.
      8. **IMPORTANT: DO NOT REPEAT activities across different days.** Each activity should only be recommended once in the entire itinerary.
      9. If the database already contains organized time periods (Morning, Afternoon, Evening), use that structure as a starting point and refine it based on the user's needs.
      10. Output a JSON object with this structure: { "title": "Your X Day Itinerary", "subtitle": "...", "items": [{"period": "...", "activities": [{"image": "...", "title": "...", "time": "...", "desc": "...", "tags": [...]}]}] }
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

    // Function to check for duplicate activities across days
    const removeDuplicateActivities = (parsedItinerary: any) => {
      if (!parsedItinerary || !parsedItinerary.items || !Array.isArray(parsedItinerary.items)) {
        return parsedItinerary;
      }
      
      const seenActivities = new Set<string>();
      const result = {
        ...parsedItinerary,
        items: parsedItinerary.items.map((day: any, dayIndex: number) => {
          if (!day.activities || !Array.isArray(day.activities)) return day;
          
          return {
            ...day,
            activities: day.activities.filter((activity: any) => {
              // Skip if no title
              if (!activity.title) return true;
              
              // Check if we've seen this activity before
              if (seenActivities.has(activity.title)) {
                console.log(`Removing duplicate activity: ${activity.title} on day/period ${day.period}`);
                return false;
              }
              
              // Add to seen activities
              seenActivities.add(activity.title);
              return true;
            })
          };
        }).filter((day: any) => day.activities && day.activities.length > 0)
      };
      
      return result;
    };

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
    
    // Try to extract and clean JSON from the response
    let cleanedJson = finalText;

    // Use a more robust regex to extract from markdown code blocks
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
      cleanedJson = codeBlockMatch[1];
    }

    // Further cleaning: remove comments and trailing commas
    cleanedJson = cleanedJson
      .replace(/\/\/.*$/gm, '')       // Remove single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/,\s*([\]}])/g, '$1')   // Remove trailing commas
      .trim();

    // Log the cleaned JSON before parsing
    console.log("Cleaned JSON to parse:", cleanedJson);

    try {
      // Validate that it's proper JSON by parsing
      let parsed = JSON.parse(cleanedJson);
      
      // Apply the removeDuplicateActivities function to eliminate duplicates
      parsed = removeDuplicateActivities(parsed);

      // Remove placeholder activities titled "No available activity", drop empty periods,
      // back-fill any missing image URLs using the canonical sampleItineraryCombined,
      // and ensure no duplicate activities across days.
      if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
        // Build a quick lookup table: title -> image from sampleItineraryCombined
        const titleToImage: Record<string, string> = {};
        for (const sec of sampleItineraryCombined.items) {
          for (const act of sec.activities) {
            const img = typeof act.image === "string" ? act.image : (act.image as any)?.src || "";
            if (act.title && img) {
              titleToImage[act.title] = img;
            }
          }
        }
        
        // Track seen activities to prevent duplicates across days
        const seenActivities = new Set<string>();

        (parsed as any).items = (parsed as any).items
          .map((period: any) => {
            const cleanedActs = Array.isArray(period.activities)
              ? period.activities
                  .filter((act: any) => {
                    // Filter out placeholder activities
                    if (!act.title || act.title.toLowerCase() === "no available activity") {
                      return false;
                    }
                    
                    // Check for duplicates across days
                    if (seenActivities.has(act.title)) {
                      console.log(`Removing duplicate activity: ${act.title} in period ${period.period}`);
                      return false;
                    }
                    
                    // Add to seen activities
                    seenActivities.add(act.title);
                    return true;
                  })
                  .map((act: any) => {
                    if ((!act.image || act.image === "") && titleToImage[act.title]) {
                      act.image = titleToImage[act.title];
                    }
                    return act;
                  })
              : [];
            return { ...period, activities: cleanedActs };
          })
          .filter((period: any) => Array.isArray(period.activities) && period.activities.length > 0);
      }

      const responseData = { text: JSON.stringify(parsed) };

      // Cache the successful response
      responseCache.set(cacheKey, {
        response: responseData,
        timestamp: Date.now()
      });

      // Clean old cache entries periodically
      if (responseCache.size > 100) {
        const now = Date.now();
        for (const [key, value] of responseCache.entries()) {
          if (now - value.timestamp > CACHE_DURATION) {
            responseCache.delete(key);
          }
        }
      }

      return NextResponse.json(responseData);
    } catch (parseError) {
      // Attempt JSON salvage
      try {
        const firstBrace = cleanedJson.indexOf('{');
        const lastBrace = cleanedJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          const potentialJson = cleanedJson.slice(firstBrace, lastBrace + 1);
          let parsed = JSON.parse(potentialJson);
          
          // Apply the removeDuplicateActivities function to eliminate duplicates
          parsed = removeDuplicateActivities(parsed);

          if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
            // Track seen activities to prevent duplicates across days
            const seenActivities = new Set<string>();
            
            (parsed as any).items = (parsed as any).items
              .map((period: any) => {
                const filteredActivities = Array.isArray(period.activities)
                  ? period.activities.filter((act: any) => {
                      // Filter out placeholder activities
                      if (!act.title || act.title.toLowerCase() === "no available activity") {
                        return false;
                      }
                      
                      // Check for duplicates across days
                      if (seenActivities.has(act.title)) {
                        console.log(`Removing duplicate activity: ${act.title} in period ${period.period}`);
                        return false;
                      }
                      
                      // Add to seen activities
                      seenActivities.add(act.title);
                      return true;
                    })
                  : [];
                return { ...period, activities: filteredActivities };
              })
              .filter((period: any) => period.activities.length > 0);
          }

          const responseData = { text: JSON.stringify(parsed) };
          responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
          return NextResponse.json(responseData);
        }
      } catch {
        console.error("Failed to parse JSON from Gemini response:", parseError, geminiResponse.text);
        return NextResponse.json({ text: "", error: "Failed to parse JSON from Gemini response.", raw: geminiResponse.text });
      }
    }
  } catch (error) {
    console.error("Error calling Gemini API:", error);

    if (typeof error === "object" && error !== null) {
      const errorMessage = (error as any).message || "";

      if (errorMessage.includes("quota exceeded") || errorMessage.includes("429")) {
        return NextResponse.json(
          { text: "", error: "API quota exceeded. Please check your plan and billing details, or try again later." },
          { status: 429 }
        );
      } else if (errorMessage.includes("overloaded") || errorMessage.includes("503")) {
        return NextResponse.json(
          { text: "", error: "The Gemini model is currently overloaded. Please try again shortly." },
          { status: 503 }
        );
      }
    }

    return NextResponse.json({ text: "", error: "Failed to generate content." }, { status: 500 });
  }
}
