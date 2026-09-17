import { NextResponse } from "next/server";
import { processItinerary } from "../utils/itineraryUtils";
import { geminiModel } from "./config";
import { ItinerarySchema } from "../types/schemas";
import type { EnhancedGenerateContentResponse, GenerateContentResult } from "@google/generative-ai";

const MAX_RETRIES = 2;
// Hard per-call deadline bounded under the 60s Vercel Hobby kill (see
// structuredOutputEngine.ts). Gemini has no request timeout of its own;
// without this a hung 503/429 retry loop can exceed the platform limit and
// the charge is lost with no possible refund.
const CALL_TIMEOUT_MS = 25000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Returns the awaited GenerateContentResponse (callers invoke .text() on it);
// typed via the guard below.
export async function generateItinerary(detailedPrompt: string, prompt: string, durationDays: number | null): Promise<EnhancedGenerateContentResponse> {
    const generationConfig = {
        responseMimeType: "application/json",
        temperature: 0.7, // Further lowered for more predictable JSON output
        topK: 1,
        topP: 0.9,
        maxOutputTokens: 8192, 
        // Ensure single response
    };

    let result: GenerateContentResult | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            result = await Promise.race([
                geminiModel!.generateContent({
                    contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
                    generationConfig,
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error("Generation timeout")), CALL_TIMEOUT_MS)
                ),
            ]);
            break; // Success
        } catch (err) {
            let status: unknown;
            if (err && typeof err === "object" && "status" in err) {
                status = err.status;
            } else if (
                err && typeof err === "object" && "response" in err &&
                err.response && typeof err.response === "object" && "status" in err.response
            ) {
                status = err.response.status;
            }
            if (attempt < MAX_RETRIES && (status === 503 || status === 429)) {
                const delay = 1000 * Math.pow(2, attempt - 1);
                console.warn(`Gemini transient error (status ${String(status)}). Retry ${attempt} of ${MAX_RETRIES} after ${delay}ms`);
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
    // Import the robust parser and validator
    const { RobustJsonParser } = require('./robustJsonParser');
    const { ResponseValidator } = require('./responseValidator');
    
    try {
        // Pre-validate the response
        const validation = ResponseValidator.validateResponse(text);
        
        if (!validation.isValid) {
            console.warn("Response validation issues:", validation.issues);
        }
        
        // Use cleaned text if available, otherwise original
        const textToProcess = validation.cleanedText || text;
        
        // Use the robust parser with multiple recovery strategies
        return RobustJsonParser.parseResponse(textToProcess);
    } catch (error) {
        console.error("RobustJsonParser failed:", error);
        
        // Ultimate fallback - return minimal valid structure
        return {
            title: "Baguio City Itinerary",
            subtitle: "Unable to parse response - please try again",
            items: []
        };
    }
}
