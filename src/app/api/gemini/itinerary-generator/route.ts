import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { CreditService, InsufficientCreditsError } from "@/lib/referral-system";
import { geminiModel, API_KEY } from "./lib/config";
import { getPeakHoursContext } from "@/lib/traffic";
import { buildDetailedPrompt } from "./lib/contextBuilder";
import { findAndScoreActivities } from "./lib/activitySearch";
import { generateItinerary, handleItineraryProcessing, parseAndCleanJson } from "./lib/responseHandler";
import { ErrorHandler, ErrorType, ItineraryError } from "./lib/errorHandler";
import { GuaranteedJsonEngine } from "./lib/guaranteedJsonEngine";
import type { WeatherCondition } from "./types/types";

// Main logic for generating an itinerary, wrapped for caching
const getCachedItinerary = unstable_cache(
    async (requestBody: any, hash: string) => {
        const requestId = hash.substring(0, 8);
        
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
            
            // Use Guaranteed JSON Engine for 100% reliable output
            const peakHoursContext = getPeakHoursContext();
            const weatherContext = `Weather: ${weatherData?.weather?.[0]?.description || 'clear'}, ${weatherData?.main?.temp || 20}°C`;
            const trafficContext = "Real-time traffic analysis integrated with peak hours filtering";
            
            console.log(`🛡️ MAIN ROUTE: Using GuaranteedJsonEngine for request ${requestId}`);
            const guaranteedItinerary = await GuaranteedJsonEngine.generateGuaranteedJson(
                detailedPrompt,
                effectiveSampleItinerary,
                weatherContext,
                peakHoursContext,
                `Duration: ${durationDays} days, Budget: ${budget}, Pax: ${pax}`,
                requestId
            );
            
            // Process the guaranteed valid itinerary
            const finalItinerary = await handleItineraryProcessing(guaranteedItinerary, prompt, durationDays, peakHoursContext);
            return { text: JSON.stringify(finalItinerary) };
        }, 3, 1000); // 3 retries with 1 second base delay
    },
    ['itinerary-requests'], // Cache key prefix
    {
        revalidate: 30 * 60, // 30-minute cache revalidation
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
                    error: "Insufficient credits",
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
        
        // ✅ CRITICAL: Check if this is a refresh request (bypass cache)
        const isRefreshRequest = req.headers.get('x-refresh-request') === 'true' || 
                                 req.headers.get('x-bypass-cache') === 'true';
        
        if (isRefreshRequest) {
            console.log('🔄 REFRESH REQUEST DETECTED - Bypassing cache for fresh generation');
        }

        // Handle health check endpoint
        if (req.nextUrl.searchParams.get('action') === 'health') {
            const health = await GuaranteedJsonEngine.healthCheck();
            return NextResponse.json(health);
        }

        // Handle metrics endpoint
        if (req.nextUrl.searchParams.get('action') === 'metrics') {
            const metrics = GuaranteedJsonEngine.getMetrics();
            return NextResponse.json(metrics);
        }

        // Generate a stable cache key from the request body
        const hash = createHash('sha256').update(JSON.stringify(requestBody)).digest('hex');
        
        let responseData;
        
        // ✅ CACHE BYPASS: For refresh requests, skip cache and generate fresh
        if (isRefreshRequest) {
            console.log('⏩ Executing fresh generation (cache bypassed)');
            const requestId = hash.substring(0, 8);
            
            // Generate fresh itinerary without cache
            responseData = await ErrorHandler.withRetry(async () => {
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
                
                const peakHoursContext = getPeakHoursContext();
                const weatherContext = `Weather: ${weatherData?.weather?.[0]?.description || 'clear'}, ${weatherData?.main?.temp || 20}°C`;
                const trafficContext = "Real-time traffic analysis integrated with peak hours filtering";
                
                console.log(`🛡️ REFRESH MODE: Using GuaranteedJsonEngine for request ${requestId}`);
                const guaranteedItinerary = await GuaranteedJsonEngine.generateGuaranteedJson(
                    detailedPrompt,
                    effectiveSampleItinerary,
                    weatherContext,
                    peakHoursContext,
                    `Duration: ${durationDays} days, Budget: ${budget}, Pax: ${pax}`,
                    requestId
                );
                
                const finalItinerary = await handleItineraryProcessing(guaranteedItinerary, prompt, durationDays, peakHoursContext);
                return { text: JSON.stringify(finalItinerary) };
            }, 3, 1000);
            
            console.log('✅ Fresh generation completed (refresh mode)');
        } else {
            // Normal flow: Use cached function
            responseData = await getCachedItinerary(requestBody, hash);
        }

        // ✅ CREDIT SYSTEM: Consume 1 credit for successful generation
        try {
            console.log(`🔄 Attempting to consume 1 credit for user ${userId} - Tarana Gala`);
            const consumeResult = await CreditService.consumeCredits({
                userId,
                amount: 1,
                service: 'tarana_gala',
                description: `Generated itinerary: ${prompt?.substring(0, 50) || 'Itinerary generation'}`
            });
            console.log(`✅ Credit consumed successfully for user ${userId} - Tarana Gala`, consumeResult);
        } catch (creditConsumeError: any) {
            console.error("❌ CREDIT CONSUMPTION FAILED:", {
                userId,
                service: 'tarana_gala',
                error: creditConsumeError?.message || creditConsumeError,
                code: creditConsumeError?.code,
                details: creditConsumeError?.details,
                stack: creditConsumeError?.stack
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
