import { NextRequest, NextResponse } from "next/server";
import { geminiModel, responseCache, CACHE_DURATION, API_KEY } from "../lib/config";
import { getPeakHoursContext } from "@/lib/peakHours";
import { buildDetailedPrompt } from "../lib/contextBuilder";
import { findAndScoreActivities } from "../lib/activitySearch";
import { generateItinerary, handleItineraryProcessing, parseAndCleanJson } from "../lib/responseHandler";
import type { WeatherCondition } from "../types/types";

export async function POST(req: NextRequest) {
    try {
        const { prompt, weatherData, interests, duration, budget, pax } = await req.json();

        console.log("Gemini API request body:", { prompt, weatherData, interests, duration, budget, pax });

        if (!API_KEY) {
            console.error("GOOGLE_GEMINI_API_KEY is missing!");
            return NextResponse.json({ text: "", error: "GOOGLE_GEMINI_API_KEY is missing on the server." }, { status: 500 });
        }

        if (!prompt) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        const cacheKey = JSON.stringify({
            prompt: prompt?.substring(0, 100),
            weatherId: weatherData?.weather?.[0]?.id,
            temp: Math.round(weatherData?.main?.temp || 0),
            interests: interests?.sort(),
            duration,
            budget,
            pax
        });

        const cached = responseCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            return NextResponse.json(cached.response);
        }

        if (!geminiModel) {
            console.error("Gemini model is not initialized – missing API key?");
            return NextResponse.json({ text: "", error: "Gemini model not available." }, { status: 500 });
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
        console.log("Gemini raw response text:", text);

        let finalText = text;
        if (!finalText) {
            const candidate = response.candidates?.[0];
            const parts = candidate?.content?.parts;
            if (Array.isArray(parts)) {
                finalText = parts.map(p => p.text || '').join('');
                console.log("Manually extracted Gemini text:", finalText);
            }
            if (!finalText) {
                return NextResponse.json({ text: "", error: "Gemini response is empty", fullResponse: response });
            }
        }

        const peakHoursContext = getPeakHoursContext();
        let parsed = parseAndCleanJson(finalText);
        const finalItinerary = await handleItineraryProcessing(parsed, prompt, durationDays, peakHoursContext);
        const responseData = { text: JSON.stringify(finalItinerary) };
        responseCache.set(cacheKey, { response: responseData, timestamp: Date.now() });
        return NextResponse.json(responseData);

    } catch (e: any) {
        console.error("Error in itinerary generation pipeline:", e);
        return NextResponse.json({ text: "", error: e.message || "An unknown error occurred." }, { status: 500 });
    }
}
