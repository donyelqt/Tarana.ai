import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";
import { geminiModel, API_KEY } from "../lib/config";
import { getPeakHoursContext } from "@/lib/traffic";
import { buildDetailedPrompt } from "../lib/contextBuilder";
import { findAndScoreActivities } from "../lib/activitySearch";
import { generateItinerary, handleItineraryProcessing, parseAndCleanJson } from "../lib/responseHandler";
import { ErrorHandler, ErrorType, ItineraryError } from "../lib/errorHandler";
import { optimizedPipeline } from "@/lib/performance/optimizedPipeline";
import { smartCacheManager } from "@/lib/performance/smartCacheManager";
import type { WeatherCondition } from "../types/types";

// Optimized logic for ultra-fast itinerary generation
const getCachedItinerary = unstable_cache(
    async (requestBody: any, hash: string) => {
        const requestId = hash.substring(0, 8);
        
        // Check if optimized pipeline should be used
        const useOptimized = process.env.USE_OPTIMIZED_PIPELINE !== 'false';
        
        if (useOptimized) {
            console.log(`🚀 USING OPTIMIZED PIPELINE for request ${requestId}`);
            
            return await ErrorHandler.withRetry(async () => {
                const { prompt, weatherData, interests, duration, budget, pax } = requestBody;

                if (!geminiModel) {
                    throw new ItineraryError(ErrorType.GENERATION, "Gemini model not available", false, requestId);
                }

                const durationDays = duration ? parseInt(duration.toString().match(/\d+/)?.[0] || '1', 10) : null;

// Use optimized pipeline for 3-5x faster generation
                const { itinerary, metrics } = await optimizedPipeline.generateOptimized({
                    prompt,
                    interests: Array.isArray(interests) ? interests : [],
                    weatherData,
                    durationDays,
                    budget: budget || 'mid-range',
                    pax: pax || '2',
                    model: geminiModel
                });

                console.log(`✅ OPTIMIZED PIPELINE: Enhanced activities with real-time traffic data`);
                console.log(`⚡ OPTIMIZED GENERATION: Completed in ${metrics.totalTime}ms with ${metrics.performance.efficiency}% efficiency`);
                
                return { 
                    text: JSON.stringify(itinerary),
                    metrics,
                    optimized: true,
                    requestId
                };
            }, 2, 500); // Reduced retries for faster response
        }
        
        // Fallback to legacy pipeline
        console.log(`🐌 USING LEGACY PIPELINE for request ${requestId}`);
        return await ErrorHandler.withRetry(async () => {
            const { prompt, weatherData, interests, duration, budget, pax } = requestBody;

            if (!geminiModel) {
                throw new ItineraryError(ErrorType.GENERATION, "Gemini model not available", false, requestId);
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
                throw new ItineraryError(ErrorType.GENERATION, "Gemini response is empty", true, requestId);
            }

            const peakHoursContext = getPeakHoursContext();
            let parsed = parseAndCleanJson(text);
            const finalActivities = parsed.slice(0, Math.min(15, parsed.length));
            console.log(`🎯 FINAL SELECTION: Selected ${finalActivities.length} activities for itinerary generation`);
            const finalItinerary = await handleItineraryProcessing(finalActivities, prompt, durationDays, peakHoursContext);
            return { text: JSON.stringify(finalItinerary), optimized: false };
        }, 2, 50); // 2 retries with 500ms base delay
    },
    ['itinerary-requests'], // Cache key prefix
    {
        revalidate: 5 * 60, // Reduced to 5-minute cache for faster updates
        tags: ['itineraries'],
    }
);

export async function POST(req: NextRequest) {
    try {
        // ✅ CREDIT SYSTEM: Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ 
                error: "Authentication required",
                text: "" 
            }, { status: 401 });
        }

        const userId = session.user.id;

        // ✅ CREDIT SYSTEM: Check available credits
        try {
            const balance = await CreditService.getCurrentBalance(userId);
            if (balance.remainingToday < 1) {
                return NextResponse.json({ 
                    error: "Insufficient credits. You need 1 credit to generate an itinerary.",
                    text: "",
                    required: 1,
                    available: balance.remainingToday,
                    nextRefresh: balance.nextRefresh
                }, { status: 402 });
            }
        } catch (creditError) {
            console.error("Error checking credits:", creditError);
            // Continue without credit check if service is unavailable
        }

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

        // ✅ CREDIT SYSTEM: Consume 1 credit for successful generation
        try {
            console.log(`🔄 Attempting to consume 1 credit for user ${userId} - Tarana Gala`);
            const consumeResult = await CreditService.consumeCredits({
                userId,
                amount: 1,
                service: 'tarana_gala',
                description: `Generated itinerary: ${prompt?.substring(0, 50) || 'Itinerary generation'}`
            });
            console.log(`✅ Credit consumed successfully for user ${userId}`, consumeResult);
        } catch (creditConsumeError: any) {
            console.error("❌ CREDIT CONSUMPTION FAILED:", {
                userId,
                service: 'tarana_gala',
                error: creditConsumeError?.message || creditConsumeError
            });
            // Don't block response if credit consumption fails
        }

        return NextResponse.json(responseData);

    } catch (e: any) {
        const requestId = createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex').substring(0, 8);
        const errorDetails = ErrorHandler.handleError(e, requestId);
        
        console.error("Error in itinerary generation pipeline:", errorDetails);
        
        return NextResponse.json({ 
            text: "", 
            error: errorDetails.message,
            errorType: errorDetails.type,
            requestId: errorDetails.requestId,
            retryable: errorDetails.retryable
        }, { status: 500 });
    }
}
