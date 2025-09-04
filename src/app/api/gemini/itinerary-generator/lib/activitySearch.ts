// Removed legacy vector search import - now using unified intelligent search
import { proposeSubqueries } from "../agent/agent";
import { isCurrentlyPeakHours, getManilaTime } from "@/lib/traffic";
import { WEATHER_TAG_FILTERS } from "./config";
import { validateAndEnrichActivity } from "../utils/itineraryUtils";
import { trafficAwareActivitySearch, createDefaultTrafficOptions } from "@/lib/traffic";
import { IntelligentSearchEngine } from "@/lib/search";
import type { WeatherCondition } from "../types/types";
import type { SearchContext } from "@/lib/search";
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";

// Initialize unified intelligent search engine
const intelligentSearchEngine = new IntelligentSearchEngine();

export async function findAndScoreActivities(prompt: string, interests: string[], weatherType: WeatherCondition, durationDays: number | null, model: any) {
    let effectiveSampleItinerary: any = null;
    
    try {
        // Create search context for unified intelligent search
        const searchContext: SearchContext = {
            interests: Array.isArray(interests) ? interests : [],
            weatherCondition: weatherType,
            timeOfDay: determineTimeOfDay(),
            budget: 'mid-range',
            groupSize: 2,
            duration: durationDays || 1,
            currentTime: getManilaTime(),
            userPreferences: {}
        };
        
        // Use intelligent search engine
        const availableActivities = sampleItineraryCombined.items[0].activities;
        console.log(`\n🔍 INTELLIGENT SEARCH: Starting search for "${prompt}" with ${availableActivities.length} activities`);
        const intelligentResults = await intelligentSearchEngine.search(prompt, searchContext, availableActivities);
        console.log(`✅ INTELLIGENT SEARCH: Found ${intelligentResults.length} results with traffic-aware scoring`);
        
        // Enhanced intelligent search with query expansion if needed
        let finalResults = intelligentResults;
        if (intelligentResults.length < 15) {
            console.log(`🔍 EXPANDING SEARCH: Only ${intelligentResults.length} results, generating sub-queries for broader coverage`);
            
            // Generate AI sub-queries to expand search coverage
            const subqueries = await proposeSubqueries({
                model,
                userPrompt: prompt,
                interests: Array.isArray(interests) ? interests : undefined,
                weatherType,
                durationDays,
                existingTitles: intelligentResults.map(r => r.activity.title),
                maxQueries: 3
            });

            // Run additional intelligent searches with sub-queries
            const expandedResults: any[] = [];
            for (const subquery of subqueries) {
                const subResults = await intelligentSearchEngine.search(subquery, searchContext, availableActivities);
                expandedResults.push(...subResults);
            }
            
            // Merge and deduplicate results
            const allResults = [...intelligentResults, ...expandedResults];
            const uniqueResults = new Map();
            
            for (const result of allResults) {
                const key = result.activity.title;
                if (!uniqueResults.has(key) || uniqueResults.get(key).scores.composite < result.scores.composite) {
                    uniqueResults.set(key, result);
                }
            }
            
            finalResults = Array.from(uniqueResults.values())
                .sort((a, b) => b.scores.composite - a.scores.composite)
                .slice(0, 30);
                
            console.log(`✅ EXPANDED SEARCH: Final results count: ${finalResults.length}`);
        }

        // Process unified intelligent search results
        const processedResults = finalResults.map(result => ({
            activity_id: result.activity.title,
            similarity: result.scores.composite,
            metadata: {
                title: result.activity.title,
                desc: result.activity.desc,
                tags: result.activity.tags,
                time: result.activity.time,
                image: result.activity.image,
                peakHours: result.activity.peakHours
            },
            relevanceScore: result.scores.composite,
            reasoning: result.reasoning,
            confidence: result.confidence,
            searchScores: {
                vector: result.scores.vector,
                semantic: result.scores.semantic,
                fuzzy: result.scores.fuzzy,
                contextual: result.scores.contextual,
                temporal: result.scores.temporal,
                diversity: result.scores.diversity
            }
        }));
        
        const similar = processedResults;

        // Apply unified intelligent filtering and optimization
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
        const interestSet = new Set(
            interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
        );

        const scoredSimilar = similar.map((s: any) => {
            const tags = Array.isArray(s.metadata?.tags) ? s.metadata.tags : [];
            const peakHours = s.metadata?.peakHours || "";
            const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
            const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
            const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
            
            let relevanceScore = s.similarity;
            
            if (interestMatch && interestSet.size > 0) {
                const matchCount = tags.filter((t: string) => interestSet.has(t)).length;
                relevanceScore += (matchCount / interestSet.size) * 0.3;
            }
            
            if (weatherMatch && allowedWeatherTags.length > 0) {
                const matchCount = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
                relevanceScore += (matchCount / allowedWeatherTags.length) * 0.2;
            }
            
            if (!isCurrentlyPeak) {
                relevanceScore += 0.25;
            } else {
                relevanceScore -= 0.5;
            }
            
            return {
                ...s,
                relevanceScore,
                interestMatch,
                weatherMatch,
                isCurrentlyPeak,
                peakHours,
                searchMethod: 'unified_intelligent_search',
                vectorScore: s.searchScores?.vector || 0,
                semanticScore: s.searchScores?.semantic || 0,
                confidenceLevel: s.confidence || 0.5
            };
        });

        // STRICT peak hours filtering - absolutely no peak hour activities allowed
        const filteredSimilar = scoredSimilar
            .filter(s => {
                // Must match interests and weather
                if (!s.interestMatch || !s.weatherMatch) return false;
                
                // CRITICAL: Double-check peak hours status
                const peakHours = s.metadata?.peakHours || s.peakHours || "";
                const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
                
                if (isCurrentlyPeak) {
                    console.log(`FILTERING OUT: ${s.metadata?.title || s.activity_id} - Currently in peak hours: ${peakHours}`);
                    return false;
                }
                
                return true;
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 40);

        if (filteredSimilar.length > 0) {
            const morningActivities: any[] = [];
            const afternoonActivities: any[] = [];
            const eveningActivities: any[] = [];
            const anytimeActivities: any[] = [];
            
            filteredSimilar.forEach((s: any) => {
                const timeStr = s.metadata?.time?.toLowerCase() || "";
                // Final peak hours check before adding to activities
                const peakHours = s.metadata?.peakHours || "";
                const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
                
                if (isCurrentlyPeak) {
                    console.log(`SKIPPING: ${s.metadata?.title || s.activity_id} - Still in peak hours during activity creation`);
                    return; // Skip this activity
                }
                
                const rawActivity = {
                    image: s.metadata?.image || "",
                    title: s.metadata?.title || s.activity_id,
                    time: s.metadata?.time || "",
                    desc: s.metadata?.desc || "",
                    tags: s.metadata?.tags || [],
                    peakHours: peakHours,
                    relevanceScore: s.relevanceScore,
                    isCurrentlyPeak: false // Guaranteed false at this point
                };
                
                const activity = validateAndEnrichActivity(rawActivity);
                if (!activity) return;
                
                if (timeStr.includes("am") || timeStr.includes("morning")) {
                    morningActivities.push(activity);
                } else if (timeStr.includes("pm") || timeStr.includes("afternoon")) {
                    afternoonActivities.push(activity);
                } else if (timeStr.includes("evening") || timeStr.includes("night")) {
                    eveningActivities.push(activity);
                } else {
                    anytimeActivities.push(activity);
                }
            });
            
            const items = [];
            
            // Apply traffic-aware activity search with detailed logging
            console.log(`\n🚦 TRAFFIC-AWARE SEARCH: Processing ${filteredSimilar.length} activities`);
            const trafficOptions = createDefaultTrafficOptions();
            const trafficEnhancedActivities = await trafficAwareActivitySearch.enhanceActivitiesWithTraffic(
                filteredSimilar.map(s => s.metadata),
                trafficOptions
            );
            console.log(`✅ TRAFFIC-AWARE SEARCH: Enhanced ${trafficEnhancedActivities.length} activities with real-time traffic data`);
            
            // Log detailed traffic integration results
            console.log(`\n=== TOMTOM API INTEGRATION RESULTS ===`);
            const trafficSummary = trafficEnhancedActivities.map(activity => ({
                name: activity.title,
                coordinates: activity.trafficAnalysis ? `${activity.trafficAnalysis.lat}, ${activity.trafficAnalysis.lon}` : 'NO_COORDS',
                trafficLevel: activity.trafficAnalysis?.realTimeTraffic?.trafficLevel || 'NO_DATA',
                congestionScore: activity.trafficAnalysis?.realTimeTraffic?.congestionScore || 0,
                recommendationScore: activity.trafficAnalysis?.realTimeTraffic?.recommendationScore || 0,
                hasRealTimeData: !!activity.trafficAnalysis?.realTimeTraffic
            }));
            
            const successfulTrafficFetches = trafficSummary.filter(a => a.hasRealTimeData).length;
            const totalActivities = trafficSummary.length;
            
            console.log(`🎯 TOMTOM API SUCCESS RATE: ${successfulTrafficFetches}/${totalActivities} (${Math.round(successfulTrafficFetches/totalActivities*100)}%)`);
            console.log(`📊 DETAILED TRAFFIC DATA:`, trafficSummary);
            console.log(`=======================================\n`);

            // Final activity selection and validation
            const finalActivities = trafficEnhancedActivities.slice(0, Math.min(12, trafficEnhancedActivities.length));
            console.log(`🎯 FINAL SELECTION: Selected ${finalActivities.length} activities for itinerary generation`);
            
            // Log real-time traffic integration success for final activities
            console.log(`\n=== FINAL ITINERARY TRAFFIC INTEGRATION ===`);
            const finalTrafficStats = finalActivities.map(activity => ({
                activity: activity.title,
                realTimeTraffic: activity.trafficAnalysis?.realTimeTraffic ? 'INTEGRATED' : 'FALLBACK',
                trafficLevel: activity.trafficAnalysis?.realTimeTraffic?.trafficLevel || 'UNKNOWN',
                optimalScore: activity.trafficAnalysis?.realTimeTraffic?.recommendationScore || 0,
                combinedScore: activity.combinedTrafficScore || 0,
                recommendation: activity.trafficRecommendation || 'UNKNOWN'
            }));
            
            const integratedCount = finalTrafficStats.filter(a => a.realTimeTraffic === 'INTEGRATED').length;
            console.log(`🚀 REAL-TIME TRAFFIC INTEGRATION: ${integratedCount}/${finalActivities.length} activities using live TomTom data`);
            console.log(`📈 TRAFFIC-AWARE ITINERARY:`, finalTrafficStats);
            console.log(`==========================================\n`);
            
            // Validate and enrich each activity
            const validatedActivities = finalActivities.map(activity => {
                const validated = validateAndEnrichActivity(activity);
                console.log(`✅ Activity validated: ${validated.title} (Peak: ${validated.peakHours || 'None'})`);
                return validated;
            });

            if (morningActivities.length > 0) {
                items.push({ period: "Morning", activities: morningActivities });
            }
            
            if (afternoonActivities.length > 0) {
                items.push({ period: "Afternoon", activities: afternoonActivities });
            }
            
            if (eveningActivities.length > 0) {
                items.push({ period: "Evening", activities: eveningActivities });
            }
            
            if (anytimeActivities.length > 0) {
                items.push({ period: "Flexible Time", activities: anytimeActivities });
            }
            
            const subtitleText = intelligentResults.length >= 10 
                ? "Activities matched using intelligent search with advanced AI algorithms"
                : "Activities matched to your preferences using semantic search";
            
            effectiveSampleItinerary = {
                title: "Personalized Recommendations",
                subtitle: subtitleText,
                items: items.length > 0 ? items : [
                    {
                        period: "Anytime",
                        activities: filteredSimilar.map(s => {
                            // Final peak hours validation for fallback activities
                            const peakHours = s.metadata?.peakHours || "";
                            const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
                            
                            if (isCurrentlyPeak) {
                                console.log(`FALLBACK FILTER: Excluding ${s.metadata?.title || s.activity_id} - Currently in peak hours`);
                                return null; // Will be filtered out by .filter(Boolean)
                            }
                            
                            const rawActivity = {
                                image: s.metadata?.image || "",
                                title: s.metadata?.title || s.activity_id,
                                time: s.metadata?.time || "",
                                desc: s.metadata?.desc || "",
                                tags: s.metadata?.tags || [],
                                peakHours: peakHours,
                                relevanceScore: s.relevanceScore || s.similarity,
                                isCurrentlyPeak: false, // Guaranteed false
                                searchReasoning: s.reasoning || [],
                                confidence: s.confidence || 0.7
                            };
                            return validateAndEnrichActivity(rawActivity);
                        }).filter(Boolean)
                    }
                ],
                searchMetadata: {
                    searchMethod: finalResults.length >= 10 ? 'intelligent' : 'semantic',
                    totalResults: filteredSimilar.length,
                    processingTime: Date.now()
                }
            } as any;
        }
    } catch (searchErr) {
        console.warn("Intelligent search failed, falling back to basic search", searchErr);
        
        // Ultimate fallback: return a subset of activities based on simple text matching
        const availableActivities = sampleItineraryCombined.items[0].activities;
        const basicMatches = availableActivities.filter((activity: Activity) => 
            activity.title.toLowerCase().includes(prompt.toLowerCase()) ||
            activity.desc.toLowerCase().includes(prompt.toLowerCase()) ||
            (activity.tags || []).some((tag: string) => tag.toLowerCase().includes(prompt.toLowerCase()))
        ).slice(0, 100);
        
        if (basicMatches.length > 0) {
            effectiveSampleItinerary = {
                title: "Basic Recommendations",
                subtitle: "Activities matched using basic text search (fallback mode)",
                items: [{
                    period: "Anytime",
                    activities: basicMatches.map((activity: Activity) => ({
                        ...activity,
                        relevanceScore: 0.5,
                        isCurrentlyPeak: false
                    }))
                }],
                searchMetadata: {
                    searchMethod: 'fallback',
                    totalResults: basicMatches.length,
                    processingTime: Date.now()
                }
            };
        }
    }

    return effectiveSampleItinerary;
}

/**
 * Determine time of day based on current Manila time
 */
function determineTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const manilaTime = getManilaTime();
    const hour = manilaTime.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    return 'anytime';
}
