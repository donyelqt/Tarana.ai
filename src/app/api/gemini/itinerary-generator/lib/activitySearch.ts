import { searchSimilarActivities } from "@/lib/vectorSearch";
import { intelligentSearchEngine, type SearchContext } from "@/lib/intelligentSearch";
import { searchOptimizer, type SearchOptimization } from "@/lib/searchOptimizer";
import { proposeSubqueries } from "../agent/agent";
import { isCurrentlyPeakHours, getManilaTime } from "@/lib/peakHours";
import { WEATHER_TAG_FILTERS } from "./config";
import { validateAndEnrichActivity } from "../utils/itineraryUtils";
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";
import type { WeatherCondition } from "../types/types";

export async function findAndScoreActivities(prompt: string, interests: string[], weatherType: WeatherCondition, durationDays: number | null, model: any) {
    let effectiveSampleItinerary: any = null;

    try {
        // Create search context for intelligent search
        const searchContext: SearchContext = {
            interests: Array.isArray(interests) ? interests : [],
            weatherCondition: weatherType,
            timeOfDay: determineTimeOfDay(),
            budget: 'mid-range', // Default, could be passed as parameter
            groupSize: 2, // Default, could be passed as parameter
            duration: durationDays || 1,
            currentTime: getManilaTime(),
            userPreferences: {}
        };

        // Generate search optimization
        const searchOptimization: SearchOptimization = searchOptimizer.generateSearchOptimization(prompt, searchContext);
        
        // Use intelligent search engine
        const availableActivities = sampleItineraryCombined.items[0].activities;
        const intelligentResults = await intelligentSearchEngine.search(prompt, searchContext, availableActivities);
        
        // Fallback to legacy search if intelligent search fails or returns insufficient results
        let searchResults: any[] = [];
        if (intelligentResults.length < 10) {
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
            searchResults = await searchSimilarActivities(allQueries, 30);
        }

        // Process intelligent search results or fallback to legacy processing
        let processedResults: any[] = [];
        
        if (intelligentResults.length >= 10) {
            // Use intelligent search results
            processedResults = intelligentResults.map(result => ({
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
                confidence: result.confidence
            }));
        } else {
            // Merge and dedupe legacy results by title, keeping the highest similarity score.
            const byTitle = new Map<string, { activity_id: string; similarity: number; metadata: Record<string, any>; }>();
            for (const s of searchResults) {
                const title: string = s.metadata?.title || s.activity_id;
                if (!byTitle.has(title) || byTitle.get(title)!.similarity < s.similarity) {
                    byTitle.set(title, s);
                }
            }
            processedResults = Array.from(byTitle.values());
        }
        
        const similar = processedResults;

        // Apply intelligent filtering and optimization
        let scoredSimilar: any[] = [];
        
        if (intelligentResults.length >= 10) {
            // Use intelligent search results with built-in scoring
            scoredSimilar = similar.map(s => ({
                ...s,
                interestMatch: true, // Already filtered by intelligent search
                weatherMatch: true, // Already filtered by intelligent search
                isCurrentlyPeak: isCurrentlyPeakHours(s.metadata?.peakHours || ""),
                peakHours: s.metadata?.peakHours || ""
            }));
        } else {
            // Apply legacy weather + interest filters
            const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];
            const interestSet = new Set(
                interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
            );

            // Enhanced filtering with weighted relevance scoring including peak hours
            scoredSimilar = (similar || []).map((s) => {
                const tags = Array.isArray(s.metadata?.tags) ? s.metadata.tags : [];
                const peakHours = s.metadata?.peakHours || "";
                const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
                const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
                const isCurrentlyPeak = isCurrentlyPeakHours(peakHours);
                
                let relevanceScore = s.similarity; // Base score from vector similarity
                
                if (interestMatch && interestSet.size > 0) {
                    const matchCount = tags.filter((t: string) => interestSet.has(t)).length;
                    relevanceScore += (matchCount / interestSet.size) * 0.3; // Up to 30% boost for interest matches
                }
                
                if (weatherMatch && allowedWeatherTags.length > 0) {
                    const matchCount = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
                    relevanceScore += (matchCount / allowedWeatherTags.length) * 0.2; // Up to 20% boost for weather matches
                }
                
                if (!isCurrentlyPeak) {
                    relevanceScore += 0.25; // 25% boost for activities not in peak hours
                } else {
                    relevanceScore -= 0.5; // Strong penalty for activities currently in peak hours
                }
                
                return {
                    ...s,
                    relevanceScore,
                    interestMatch,
                    weatherMatch,
                    isCurrentlyPeak,
                    peakHours
                };
            });
        }

        const filteredSimilar = scoredSimilar
            .filter(s => s.interestMatch && s.weatherMatch && !s.isCurrentlyPeak) // STRICTLY exclude peak hour activities
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 40);

        if (filteredSimilar.length > 0) {
            const morningActivities: any[] = [];
            const afternoonActivities: any[] = [];
            const eveningActivities: any[] = [];
            const anytimeActivities: any[] = [];
            
            filteredSimilar.forEach(s => {
                const timeStr = s.metadata?.time?.toLowerCase() || "";
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
                            const rawActivity = {
                                image: s.metadata?.image || "",
                                title: s.metadata?.title || s.activity_id,
                                time: s.metadata?.time || "",
                                desc: s.metadata?.desc || "",
                                tags: s.metadata?.tags || [],
                                peakHours: s.metadata?.peakHours || "",
                                relevanceScore: s.relevanceScore || s.similarity,
                                isCurrentlyPeak: s.isCurrentlyPeak,
                                searchReasoning: s.reasoning || [],
                                confidence: s.confidence || 0.7
                            };
                            return validateAndEnrichActivity(rawActivity);
                        }).filter(Boolean)
                    }
                ],
                searchMetadata: {
                    searchMethod: intelligentResults.length >= 10 ? 'intelligent' : 'semantic',
                    totalResults: filteredSimilar.length,
                    searchOptimization: searchOptimization,
                    processingTime: Date.now()
                }
            } as any;
        }
    } catch (searchErr) {
        console.warn("Intelligent search failed, falling back to basic search", searchErr);
        
        // Ultimate fallback: return a subset of activities based on simple text matching
        const availableActivities = sampleItineraryCombined.items[0].activities;
        const basicMatches = availableActivities.filter(activity => 
            activity.title.toLowerCase().includes(prompt.toLowerCase()) ||
            activity.desc.toLowerCase().includes(prompt.toLowerCase()) ||
            (activity.tags || []).some(tag => tag.toLowerCase().includes(prompt.toLowerCase()))
        ).slice(0, 20);
        
        if (basicMatches.length > 0) {
            effectiveSampleItinerary = {
                title: "Basic Recommendations",
                subtitle: "Activities matched using basic text search (fallback mode)",
                items: [{
                    period: "Anytime",
                    activities: basicMatches.map(activity => ({
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
