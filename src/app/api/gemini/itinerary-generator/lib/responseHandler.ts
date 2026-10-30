import { NextResponse } from "next/server";
import { processItinerary } from "../utils/itineraryUtils";
import { geminiModel } from "./config";
import { ItinerarySchema } from "../types/schemas";
import type { EnhancedGenerateContentResponse, GenerateContentResult } from "@google/generative-ai";
import { withRetry } from "@/lib/upstream/withRetry";
import { logger } from "../../../../../lib/observability/logger";
import { UpstreamTimeoutError } from "@/lib/upstream/withTimeout";

const MAX_RETRIES = 2;
const CALL_TIMEOUT_MS = 25000;

export async function generateItinerary(detailedPrompt: string, prompt: string, durationDays: number | null): Promise<EnhancedGenerateContentResponse> {
    const generationConfig = {
        responseMimeType: "application/json",
        temperature: 0.7, 
        topK: 1,
        topP: 0.9,
        maxOutputTokens: 8192,
    };

    let lastRaw: unknown = null;

    try {
        const result = await withRetry(
            async () => {
                try {
                    return await geminiModel!.generateContent({
                        contents: [{ role: "user", parts: [{ text: detailedPrompt }] }],
                        generationConfig,
                    });
                } catch (err) {
                    lastRaw = err;
                    throw err;
                }
            },
            {
                maxAttempts: MAX_RETRIES,
                baseDelayMs: 1000,
                factor: 2,
                jitter: 'none', 
                timeoutMs: CALL_TIMEOUT_MS,
                upstream: 'gemini-itinerary',
                shouldRetry: (error) => {
                    if (error instanceof UpstreamTimeoutError) return false;
                    const s = (error as any)?.status ?? (error as any)?.response?.status;
                    return s === 503 || s === 429;
                },
            }
        );
        return result.response;
    } catch (error) {
        if (error instanceof UpstreamTimeoutError) throw error;
        if (lastRaw) throw lastRaw;
        throw new Error("Failed to generate content after multiple retries due to service unavailability.");
    }
}

export async function handleItineraryProcessing(parsed: any, prompt: string, durationDays: number | null, peakHoursContext: string, serverAllowedActivities?: unknown) {
    let processed = await processItinerary(parsed, prompt, durationDays, geminiModel, peakHoursContext, serverAllowedActivities);

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
    const { RobustJsonParser } = require('./robustJsonParser');
    const { ResponseValidator } = require('./responseValidator');
    
    try {
        const validation = ResponseValidator.validateResponse(text);
        
        if (!validation.isValid) {
            logger.warn("Response validation issues:", { entryPoint: 'responseHandler', issues: validation.issues });
        }
        
        const textToProcess = validation.cleanedText || text;
        
        return RobustJsonParser.parseResponse(textToProcess);
    } catch (error) {
        logger.error("RobustJsonParser failed:", { entryPoint: 'responseHandler', error });
        
        return {
            title: "Baguio City Itinerary",
            subtitle: "Unable to parse response - please try again",
            items: []
        };
    }
}
