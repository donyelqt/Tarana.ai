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

    // Normalize inputs
    const durationDays = extractDurationDays(duration);
    const budgetCategory = normalizeBudget(budget);
    const paxCategory = normalizePax(pax);

    // Build activities from vector search to create a constrained sample DB for the model
    let effectiveSampleItinerary: SampleItinerary | null = null;
    if (typeof prompt === "string" && prompt.length > 0) {
      try {
        const vectorResults = await buildActivitiesFromVector(
          prompt,
          interests,
          budgetCategory,
          paxCategory,
          weatherType
        );

        if (vectorResults.length > 0) {
          effectiveSampleItinerary = toSampleItineraryFromVector(vectorResults);
        }
      } catch (vecErr) {
        console.warn("Vector search failed", vecErr);
      }
    }

    // Build context strings
    const sampleItineraryContext = effectiveSampleItinerary
      ? `Database: ${JSON.stringify(effectiveSampleItinerary)}\nRULE: Only use activities from this database. Match user interests and weather tags.`
      : "";

    const interestsContext = buildInterestsContext(interests);
    const durationContext = buildDurationContext(durationDays);
    const budgetContext = buildBudgetContext(budgetCategory, budget);
    const paxContext = buildPaxContext(paxCategory, pax);

    // Build detailed prompt
    const detailedPrompt = buildDetailedPrompt(
      prompt,
      sampleItineraryContext,
      weatherContext,
      interestsContext,
      durationContext,
      budgetContext,
      paxContext
    );

    // Generate itinerary
    const geminiResponse = await generateItinerary(detailedPrompt);

    if (geminiResponse.error) {
      return NextResponse.json({ text: "", error: geminiResponse.error });
    }

    // Process response
    try {
      const parsed = extractAndCleanJSON(geminiResponse.text);
      const titleToImage = buildTitleToImageLookup();
      const cleanedParsed = cleanupActivities(parsed, titleToImage);

      const responseData = { text: JSON.stringify(cleanedParsed) };
      setInCache(cacheKey, responseData);

      return NextResponse.json(responseData);
    } catch (parseError) {
      // Attempt JSON salvage
      try {
        const salvaged = attemptJSONSalvage(geminiResponse.text);
        const responseData = { text: JSON.stringify(salvaged) };
        setInCache(cacheKey, responseData);
        return NextResponse.json(responseData);
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
