import { searchSimilarActivities } from "@/lib/vectorSearch";
import { proposeSubqueries } from "../agent/agent";
import { isCurrentlyPeakHours } from "@/lib/peakHours";
import { WEATHER_TAG_FILTERS } from "./config";
import { validateAndEnrichActivity } from "../utils/itineraryUtils";
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

        // Enhanced filtering with weighted relevance scoring including peak hours
        const scoredSimilar = (similar || []).map((s) => {
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
