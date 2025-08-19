import { NextResponse } from "next/server";
import { processItinerary } from "../utils/itineraryUtils";
import { geminiModel } from "./config";

const MAX_RETRIES = 3;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function generateItinerary(detailedPrompt: string, prompt: string, durationDays: number | null) {
    const generationConfig = {
        responseMimeType: "application/json",
        temperature: 2,
        topK: 1,
        topP: 0.9,
        maxOutputTokens: 8192
    };

    let result: any = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            result = await geminiModel!.generateContent({
                contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
                generationConfig,
            });
            break; // Success
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            if (attempt < MAX_RETRIES && (status === 503 || status === 429)) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.warn(`Gemini transient error (status ${status}). Retry ${attempt} of ${MAX_RETRIES} after ${delay}ms`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }

    if (!result) {
        throw new Error("Failed to generate content after multiple retries due to service unavailability.");
    }

    return result.response;
}

export async function handleItineraryProcessing(parsed: any, prompt: string, durationDays: number | null, peakHoursContext: string) {
    let processed = await processItinerary(parsed, prompt, durationDays, geminiModel, peakHoursContext);

    if (!processed || !processed.items || processed.items.length === 0) {
        const isReasonProvided = processed.subtitle && processed.subtitle.toLowerCase().includes("could not find");
        if (isReasonProvided) {
            processed.items = []; 
        } else {
            processed = {
                title: "Could Not Generate Itinerary",
                subtitle: "Please try adjusting your preferences",
                items: [],
            };
        }
    }
    return processed;
}

export function parseAndCleanJson(text: string) {
    let cleanedJson = text;
    const codeBlockMatch = cleanedJson.match(/```(?:json)?\n?([\s\S]*?)\n?```/i);
    if (codeBlockMatch) {
        cleanedJson = codeBlockMatch[1];
    }

    const firstBrace = cleanedJson.indexOf('{');
    const lastBrace = cleanedJson.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        cleanedJson = cleanedJson.slice(firstBrace, lastBrace + 1);
    }

    return JSON.parse(cleanedJson);
}
