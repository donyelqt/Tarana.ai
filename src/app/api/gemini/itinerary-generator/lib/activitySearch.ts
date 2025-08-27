import { searchSimilarActivities } from "@/lib/vectorSearch";
import { proposeSubqueries } from "../agent/agent";
import { isCurrentlyPeakHours } from "@/lib/peakHours";
import { WEATHER_TAG_FILTERS } from "./config";
import { validateAndEnrichActivity } from "../utils/itineraryUtils";
import { trafficAwareActivitySearch, createDefaultTrafficOptions } from "@/lib/trafficAwareActivitySearch";
import { getActivityCoordinates } from "@/lib/baguioCoordinates";
import type { WeatherCondition } from "../types/types";

export async function findAndScoreActivities(prompt: string, interests: string[], weatherType: WeatherCondition, durationDays: number | null, model: any) {
    let effectiveSampleItinerary: any = null;

    try {
        // Agentic planning: generate sub-queries to broaden the search and improve coverage.
        const subqueries = await proposeSubqueries({
            model,
            userPrompt: prompt,
            interests: Array.isArray(interests) ? interests : undefined,
            weatherType,
            durationDays,
            existingTitles: [], // No existing titles initially
            maxQueries: 3
        });

        // Combine the original prompt with sub-queries for a single batch search.
        const allQueries = [prompt, ...subqueries];
        const searchResults = await searchSimilarActivities(allQueries, 30);

        // Merge and dedupe results by title, keeping the highest similarity score.
        const byTitle = new Map<string, { activity_id: string; similarity: number; metadata: Record<string, any>; }>();
        for (const s of searchResults) {
            const title: string = s.metadata?.title || s.activity_id;
            if (!byTitle.has(title) || byTitle.get(title)!.similarity < s.similarity) {
                byTitle.set(title, s);
            }
        }
        const similar = Array.from(byTitle.values());

        // Apply weather + interest filters before constructing the itinerary object
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
        const interestSet = new Set(
            interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
        );

        // Enhanced filtering with weighted relevance scoring including peak hours and real-time traffic
        const scoredSimilar = (similar || []).map((s) => {
            const tags = Array.isArray(s.metadata?.tags) ? s.metadata.tags : [];
            const peakHours = s.metadata?.peakHours || "";
            const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
            const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
            const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
            
            // Get coordinates for traffic analysis
            const coordinates = getActivityCoordinates(s.metadata?.title || s.activity_id);
            
            let relevanceScore = s.similarity; // Base score from vector similarity
            
            if (interestMatch && interestSet.size > 0) {
                const matchCount = tags.filter((t: string) => interestSet.has(t)).length;
                relevanceScore += (matchCount / interestSet.size) * 0.25; // Up to 25% boost for interest matches
            }
            
            if (weatherMatch && allowedWeatherTags.length > 0) {
                const matchCount = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
                relevanceScore += (matchCount / allowedWeatherTags.length) * 0.15; // Up to 15% boost for weather matches
            }
            
            // Peak hours penalty (reduced to make room for traffic scoring)
            if (!isCurrentlyPeak) {
                relevanceScore += 0.15; // 15% boost for activities not in peak hours
            } else {
                relevanceScore -= 0.3; // Penalty for activities currently in peak hours
            }
            
            // Add coordinates for traffic analysis later
            if (coordinates) {
                relevanceScore += 0.1; // Small boost for activities with known coordinates
            }
            
            return {
                ...s,
                relevanceScore,
                interestMatch,
                weatherMatch,
                isCurrentlyPeak,
                peakHours,
                coordinates
            };
        });

        const filteredSimilar = scoredSimilar
            .filter(s => s.interestMatch && s.weatherMatch && !s.isCurrentlyPeak) // STRICTLY exclude peak hour activities
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 40);

        if (filteredSimilar.length > 0) {
            // Create activities with coordinates
            const activitiesWithCoords = filteredSimilar.map(s => {
                const rawActivity = {
                    image: s.metadata?.image || "",
                    title: s.metadata?.title || s.activity_id,
                    time: s.metadata?.time || "",
                    desc: s.metadata?.desc || "",
                    tags: s.metadata?.tags || [],
                    peakHours: s.metadata?.peakHours || "",
                    relevanceScore: s.relevanceScore,
                    isCurrentlyPeak: s.isCurrentlyPeak,
                    lat: s.coordinates?.lat,
                    lon: s.coordinates?.lon
                };
                
                return validateAndEnrichActivity(rawActivity);
            }).filter(Boolean);

            console.log(`🚗 Itinerary Generator: Starting traffic enhancement for ${activitiesWithCoords.length} activities`);
            
            // Enhance activities with real-time traffic data
            const trafficOptions = createDefaultTrafficOptions(true);
            console.log(`⚙️ Itinerary Generator: Traffic options configured:`, {
                prioritizeTraffic: trafficOptions.prioritizeTraffic,
                avoidCrowds: trafficOptions.avoidCrowds,
                flexibleTiming: trafficOptions.flexibleTiming,
                maxTrafficLevel: trafficOptions.maxTrafficLevel
            });
            
            const trafficEnhancedActivities = await trafficAwareActivitySearch.enhanceActivitiesWithTraffic(
                activitiesWithCoords,
                trafficOptions
            );
            
            console.log(`📊 Itinerary Generator: Traffic enhancement completed. Enhanced ${trafficEnhancedActivities.length} activities`);
            
            // Log traffic data summary
            const trafficSummary = trafficEnhancedActivities.map(activity => ({
                name: activity.title,
                hasTrafficData: !!activity.trafficData,
                congestionScore: activity.trafficData?.congestionScore || 'N/A',
                trafficLevel: activity.trafficData?.trafficLevel || 'N/A',
                recommendationScore: activity.trafficData?.recommendationScore || 'N/A'
            }));
            console.log(`🎯 Itinerary Generator: Traffic data summary:`, trafficSummary);

            // Filter and sort by traffic conditions
            console.log(`🔍 Itinerary Generator: Filtering and sorting by traffic conditions`);
            const finalActivities = trafficAwareActivitySearch.filterAndSortByTraffic(
                trafficEnhancedActivities,
                trafficOptions
            );
            
            console.log(`✅ Itinerary Generator: Traffic filtering completed. Final count: ${finalActivities.length} activities`);

            // Update descriptions with traffic insights
            console.log(`📝 Itinerary Generator: Adding traffic insights to activity descriptions`);
            const activitiesWithTrafficInsights = trafficAwareActivitySearch.updateDescriptionsWithTrafficInsights(
                finalActivities
            );
            
            console.log(`🎨 Itinerary Generator: Traffic insights added to descriptions. Processing ${activitiesWithTrafficInsights.length} activities`);

            // Organize by time periods with traffic-aware logging
            console.log(`⏰ Itinerary Generator: Organizing activities by time periods with traffic considerations`);
            const morningActivities: any[] = [];
            const afternoonActivities: any[] = [];
            const eveningActivities: any[] = [];
            const anytimeActivities: any[] = [];
            
            activitiesWithTrafficInsights.forEach(activity => {
                const timeStr = activity.time?.toLowerCase() || "";
                const trafficInfo = activity.trafficData ? 
                    `(Traffic: ${activity.trafficData.trafficLevel}, Score: ${activity.trafficData.recommendationScore})` : 
                    '(No traffic data)';
                
                if (timeStr.includes("am") || timeStr.includes("morning")) {
                    morningActivities.push(activity);
                    console.log(`🌅 Morning: ${activity.title} ${trafficInfo}`);
                } else if (timeStr.includes("pm") || timeStr.includes("afternoon")) {
                    afternoonActivities.push(activity);
                    console.log(`☀️ Afternoon: ${activity.title} ${trafficInfo}`);
                } else if (timeStr.includes("evening") || timeStr.includes("night")) {
                    eveningActivities.push(activity);
                    console.log(`🌆 Evening: ${activity.title} ${trafficInfo}`);
                } else {
                    anytimeActivities.push(activity);
                    console.log(`🕐 Anytime: ${activity.title} ${trafficInfo}`);
                }
            });
            
            console.log(`📋 Itinerary Generator: Time period organization complete:`, {
                morning: morningActivities.length,
                afternoon: afternoonActivities.length,
                evening: eveningActivities.length,
                anytime: anytimeActivities.length
            });
            
            const items = [];
            
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
            
            effectiveSampleItinerary = {
                title: "Personalized Recommendations",
                subtitle: "Activities matched to your preferences using semantic search",
                items: items.length > 0 ? items : [
                    {
                        period: "Anytime",
                        activities: filteredSimilar.map(s => {
                            const rawActivity = {
                                image: s.metadata?.image || "",
                                title: s.metadata?.title || s.activity_id,
                                time: s.metadata?.time || "",
                                desc: s.metadata?.desc || "",
                                tags: s.metadata?.tags || [],
                                peakHours: s.metadata?.peakHours || "",
                                relevanceScore: s.relevanceScore,
                                isCurrentlyPeak: s.isCurrentlyPeak
                            };
                            return validateAndEnrichActivity(rawActivity);
                        }).filter(Boolean)
                    }
                ]
            } as any;
        }
    } catch (vecErr) {
        console.warn("Vector search failed", vecErr);
    }

    return effectiveSampleItinerary;
}
