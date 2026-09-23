import { NextResponse } from "next/server";
import { processItinerary } from "../utils/itineraryUtils";
import { geminiModel } from "./config";
import { ItinerarySchema } from "../types/schemas";
import type { EnhancedGenerateContentResponse, GenerateContentResult } from "@google/generative-ai";
import { withRetry } from "@/lib/upstream/withRetry";
import { logger } from "../../../../../lib/observability/logger";
import { UpstreamTimeoutError } from "@/lib/upstream/withTimeout";

const MAX_RETRIES = 2;
// Hard per-call deadline bounded under the 60s Vercel Hobby kill (see
// structuredOutputEngine.ts). Gemini has no request timeout of its own;
// without this a hung 503/429 retry loop can exceed the platform limit and
// the charge is lost with no possible refund.
const CALL_TIMEOUT_MS = 25000;

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

    // Raw-error capture: the shared helper wraps non-AppError failures in
    // AppError(UPSTREAM) on exhaustion, which erases the .status shapes the
    // route's handleError classifies on (a 503 → TIMEOUT/503 becomes a
    // 500 → UNKNOWN). Keep the raw error and re-throw it below.
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
                jitter: 'none', // preserves the previous fixed 1s/2s delay
                timeoutMs: CALL_TIMEOUT_MS,
                upstream: 'gemini-itinerary',
                shouldRetry: (error) => {
                    // Preserves the previous gate: only Gemini transient
                    // statuses (503/429) are retried; a timeout fires once —
                    // the previous race rejected a raw 'Generation timeout'
                    // Error, which also was not retried. Timeouts throw as-is
                    // (UpstreamTimeoutError is an AppError) so the route's
                    // handleError still sees .status === 503 → TIMEOUT.
                    if (error instanceof UpstreamTimeoutError) return false;
                    const s = (error as any)?.status ?? (error as any)?.response?.status;
                    return s === 503 || s === 429;
                },
            }
        );
        return result.response;
    } catch (error) {
        // Preserve the wire contract: re-throw the raw error when one was
        // captured. Timeouts arrive as UpstreamTimeoutError (AppError) and
        // re-throw untouched — same classification as the pre-migration race.
        if (error instanceof UpstreamTimeoutError) throw error;
        if (lastRaw) throw lastRaw;
        throw new Error("Failed to generate content after multiple retries due to service unavailability.");
    }
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
            logger.warn("Response validation issues:", { issues: validation.issues }, 'responseHandler');
        }
        
        // Use cleaned text if available, otherwise original
        const textToProcess = validation.cleanedText || text;
        
        // Use the robust parser with multiple recovery strategies
        return RobustJsonParser.parseResponse(textToProcess);
    } catch (error) {
        logger.error("RobustJsonParser failed:", { error }, 'responseHandler');
        
        // Ultimate fallback - return minimal valid structure
        return {
            title: "Baguio City Itinerary",
            subtitle: "Unable to parse response - please try again",
            items: []
        };
    }
}
