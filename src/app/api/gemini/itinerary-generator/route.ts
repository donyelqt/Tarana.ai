import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createHash } from "crypto";
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
