import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
import { geminiModel, API_KEY } from "../lib/config";
import { getPeakHoursContext } from "@/lib/peakHours";
import { buildDetailedPrompt } from "../lib/contextBuilder";
import { findAndScoreActivities } from "../lib/activitySearch";
import { generateItinerary, handleItineraryProcessing, parseAndCleanJson } from "../lib/responseHandler";
import type { WeatherCondition } from "../types/types";

// Main logic for generating an itinerary, wrapped for caching
const getCachedItinerary = unstable_cache(
    async (requestBody: any, hash: string) => {
        const { prompt, weatherData, interests, duration, budget, pax } = requestBody;

        if (!geminiModel) {
            throw new Error("Gemini model not available.");
        }

        const durationDays = (() => {
            if (!duration) return null;
            const match = duration.toString().match(/\d+/);
            return match ? parseInt(match[0], 10) : null;
        })();

        const weatherId = weatherData?.weather?.[0]?.id || 0;
        const temperature = weatherData?.main?.temp || 20;
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

        const effectiveSampleItinerary = await findAndScoreActivities(prompt, interests, weatherType, durationDays, geminiModel);
        const detailedPrompt = buildDetailedPrompt(prompt, effectiveSampleItinerary, weatherData, interests, durationDays, budget, pax);
        const response = await generateItinerary(detailedPrompt, prompt, durationDays);

        const text = response.text();
        if (!text) {
            throw new Error("Gemini response is empty");
        }

        const peakHoursContext = getPeakHoursContext();
        let parsed = parseAndCleanJson(text);
        const finalItinerary = await handleItineraryProcessing(parsed, prompt, durationDays, peakHoursContext);
        return { text: JSON.stringify(finalItinerary) };
    },
    ['itinerary-requests'], // Cache key prefix
    {
        revalidate: 30 * 60, // 30-minute cache revalidation
        tags: ['itineraries'],
    }
);

export async function POST(req: NextRequest) {
    try {
        const requestBody = await req.json();
        const { prompt } = requestBody;

        if (!API_KEY) {
            console.error("GOOGLE_GEMINI_API_KEY is missing!");
            return NextResponse.json({ text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." }, { status: 500 });
        }

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        // Generate a stable cache key from the request body
        const hash = createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');

        // Call the cached function with a stable key
        const responseData = await getCachedItinerary(requestBody, hash);

        return NextResponse.json(responseData);

    } catch (e: any) {
        console.error("Error in itinerary generation pipeline:", e);
        return NextResponse.json({ text: "", error: e.message || "An unknown error occurred." }, { status: 500 });
    }
}
