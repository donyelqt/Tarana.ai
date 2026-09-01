// Removed legacy vector search import - now using unified intelligent search
import { proposeSubqueries } from "../agent/agent";
import { getCityTime } from "@/lib/traffic/peakHours";

import { WEATHER_TAG_FILTERS } from "./config";
import { trafficAwareActivitySearch, createDefaultTrafficOptions } from "@/lib/traffic";
import { IntelligentSearchEngine } from "@/lib/search";
import { enrichActivitiesWithImages } from "@/lib/services/imageService";
import { getCityConfig } from "@/lib/data/cityConfig";
import { tomtomRoutingService } from "@/lib/services/tomtomRouting";
import type { WeatherCondition } from "../types/types";
import type { SearchContext } from "@/lib/search";
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";

// Initialize unified intelligent search engine
const intelligentSearchEngine = new IntelligentSearchEngine();

export async function findAndScoreActivities(
  prompt: string, 
  interests: string[], 
  weatherType: WeatherCondition, 
  durationDays: number | null, 
  model: any,
  trafficAware: boolean = true,
  cityId: string = "baguio"
) {
    let effectiveSampleItinerary: any = null;
    
    try {
        // Create search context for unified intelligent search
        const searchContext: SearchContext = {
            interests: Array.isArray(interests) ? interests : [],
            weatherCondition: weatherType,
            timeOfDay: determineTimeOfDay(cityId),
            budget: 'mid-range',
            groupSize: 2,
            duration: durationDays || 1,
            currentTime: getCityTime(cityId),
            userPreferences: {}
        };
        
        // Use intelligent search engine
        const availableActivities = sampleItineraryCombined.items[0].activities;
        console.log(`\n🔍 INTELLIGENT SEARCH: Starting search for "${prompt}" with ${availableActivities.length} activities`);
        const intelligentResults = await intelligentSearchEngine.search(prompt, searchContext);
        console.log(`✅ INTELLIGENT SEARCH: Found ${intelligentResults.length} results with traffic-aware scoring`);
        
        // Enhanced intelligent search with query expansion if needed
        let finalResults = intelligentResults;
        if (intelligentResults.length < 2) {
            console.log(`🔍 EXPANDING SEARCH: Only ${intelligentResults.length} results, generating sub-queries for broader coverage`);
            
            // Generate AI sub-queries to expand search coverage
            const subqueries = await proposeSubqueries({
                model,
                userPrompt: prompt,
                interests: Array.isArray(interests) ? interests : undefined,
                weatherType,
                durationDays,
                existingTitles: intelligentResults.map(r => r.activity.title),
                maxQueries: 2,
                includeTrafficData: trafficAware, // respect the traffic toggle
            });

            // Run additional intelligent searches with sub-queries
            const expandedResults: any[] = [];
            for (const subquery of subqueries) {
                const subResults = await intelligentSearchEngine.search(subquery, searchContext);
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

        // Process unified intelligent search results - only use activities that exist in the database
        const databaseActivities = sampleItineraryCombined.items[0].activities;
        const databaseTitles = new Set(databaseActivities.map((act: any) => act.title.toLowerCase()));
        
        const processedResults = finalResults
            .filter(result => databaseTitles.has(result.activity.title.toLowerCase()))
            .map(result => ({
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
        
        const interestSet = new Set(
            interests && Array.isArray(interests) && !interests.includes("Random") ? interests : []
        );

        let similar = processedResults;

        if (interestSet.size === 0) {
            const mergedByTitle = new Map<string, any>();
            similar.forEach(item => mergedByTitle.set(item.activity_id.toLowerCase(), item));

            databaseActivities.forEach((activity: Activity) => {
                const key = activity.title.toLowerCase();
                if (!mergedByTitle.has(key)) {
                    mergedByTitle.set(key, {
                        activity_id: activity.title,
                        similarity: 0.25,
                        metadata: {
                            title: activity.title,
                            desc: activity.desc,
                            tags: activity.tags,
                            time: activity.time,
                            image: activity.image,
                            peakHours: activity.peakHours
                        },
                        relevanceScore: 0.25,
                        reasoning: ['Random interest baseline inclusion'],
                        confidence: 0.5,
                        searchScores: {
                            vector: 0,
                            semantic: 0,
                            fuzzy: 0,
                            contextual: 0,
                            temporal: 0,
                            diversity: 0
                        }
                    });
                }
            });

            similar = Array.from(mergedByTitle.values());
            console.log(`🎛️ RANDOM INTEREST MODE: Using full catalog with ${similar.length} activities for traffic analysis.`);
        }

        // Apply unified intelligent filtering and optimization
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as any)[weatherType] ?? [];

        const scoredSimilar = similar.map((s: any) => {
            const tags = Array.isArray(s.metadata?.tags) ? s.metadata.tags : [];
            const interestMatch = interestSet.size === 0 || tags.some((t: string) => interestSet.has(t));
            const weatherMatch = allowedWeatherTags.length === 0 || tags.some((t: string) => allowedWeatherTags.includes(t));
            let relevanceScore = s.similarity;
            
            if (interestMatch && interestSet.size > 0) {
                const matchCount = tags.filter((t: string) => interestSet.has(t)).length;
                relevanceScore += (matchCount / interestSet.size) * 0.3;
            }
            
            if (weatherMatch && allowedWeatherTags.length > 0) {
                const matchCount = tags.filter((t: string) => allowedWeatherTags.includes(t)).length;
                relevanceScore += (matchCount / allowedWeatherTags.length) * 0.2;
            }
            return {
                ...s,
                relevanceScore,
                interestMatch,
                weatherMatch,
                searchMethod: 'unified_intelligent_search',
                vectorScore: s.searchScores?.vector || 0,
                semanticScore: s.searchScores?.semantic || 0,
                confidenceLevel: s.confidence || 0.5
            };
        });

        let filteredSimilar = scoredSimilar
            .filter(s => s.interestMatch && s.weatherMatch)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 40);

        // ── Strict city scoping: Baguio stays Baguio, other cities use ONLY TomTom for that city ──
        // User selects "Manila" → only Manila places. Zero results = honest empty (NEVER Baguio leakage).
        if (cityId !== "baguio") {
          try {
            const city = getCityConfig(cityId)
            const bounds = {
              topLeft: { lat: city.bounds.north, lng: city.bounds.west },
              bottomRight: { lat: city.bounds.south, lng: city.bounds.east },
            }
            // Compact queries beat verbose prompts for TomTom POI search.
            // Map UI interest labels to TomTom-friendly category terms (literal
            // labels like "Culture & Arts" match only same-named POIs).
            const safeInterests = Array.isArray(interests) ? interests.filter(i => i && i !== "Random") : []
            const INTEREST_QUERY_MAP: Record<string, string> = {
              "Food & Culinary": "restaurants",
              "Nature & Scenery": "park viewpoint",
              "Culture & Arts": "museum landmark",
              "Shopping & Local Finds": "shopping market",
              "Adventure": "outdoor attraction",
            }
            const genericQuery = `tourist attractions ${city.name}`
            const queryCandidates = safeInterests.length > 0
              ? [
                  `${safeInterests.slice(0, 2).map(i => INTEREST_QUERY_MAP[i] ?? i).join(" ")} ${city.name}`,
                  ...safeInterests.slice(0, 2).map(i => `${INTEREST_QUERY_MAP[i] ?? i} ${city.name}`),
                  genericQuery,
                ]
              : [genericQuery]
            const seenTitles = new Set<string>()
            const tomResults: Array<{ name: string;[k: string]: any }> = []
            for (const q of queryCandidates) {
              if (tomResults.length >= 12) break
              try {
                const batch = await tomtomRoutingService.searchLocations(q, bounds as any, undefined, { countrySet: city.countrySet, language: city.language })
                for (const r of batch) {
                  const key = (r as any).coordinates ? `${(r as any).coordinates.lat.toFixed(3)},${(r as any).coordinates.lon.toFixed(3)}` : r.name.toLowerCase().trim()
                  if (!seenTitles.has(key)) { seenTitles.add(key); tomResults.push(r) }
                }
                console.log(`🌍 STRICT CITY: query "${q}" → ${batch.length} results (cumulative ${tomResults.length})`)
              } catch (qErr) {
                console.warn(`STRICT CITY query "${q}" failed`, qErr)
              }
            }
            if (tomResults.length > 0) {
              filteredSimilar = tomResults.slice(0, 20).map(r => ({
                activity_id: r.name,
                similarity: (r.relevanceScore ?? 50) / 100,
                metadata: {
                  title: r.name,
                  desc: r.address || `${r.category} in ${city.name}`,
                  tags: [r.category || "Travel", ...(Array.isArray(interests) ? interests.slice(0,2) : [])].slice(0,4),
                  time: "Anytime",
                  image: "",
                  peakHours: "",
                  lat: r.coordinates.lat,
                  lon: r.coordinates.lng,
                },
                relevanceScore: (r.relevanceScore ?? 50) / 100,
                reasoning: [`TomTom ${city.name} search`],
                confidence: 0.6,
                searchScores: { vector:0, semantic:0, fuzzy:0, contextual:0, temporal:0, diversity:0 },
                interestMatch: true,
                weatherMatch: true,
                searchMethod: 'tomtom_strict',
                vectorScore:0, semanticScore:0, confidenceLevel:0.6,
              }))
              console.log(`🌍 STRICT CITY: ${cityId} → ${filteredSimilar.length} TomTom places (Baguio vector ignored)`)
            } else {
              // STRICT: honest empty — do NOT leak Baguio results into another city
              console.warn(`⚠️ STRICT CITY: TomTom returned 0 for ${cityId} after retry — returning EMPTY (no Baguio leakage)`)
              filteredSimilar = []
            }
          } catch (e) {
            console.warn(`⚠️ STRICT CITY: TomTom failed for ${cityId} — returning EMPTY (no Baguio leakage)`, e)
            filteredSimilar = []
          }
        } else if (filteredSimilar.length < 8) {
          // Baguio fallback: supplement with Baguio TomTom when vector insufficient
          try {
            const city = getCityConfig("baguio")
            const bounds = {
              topLeft: { lat: city.bounds.north, lng: city.bounds.west },
              bottomRight: { lat: city.bounds.south, lng: city.bounds.east },
            }
            const tomResults = await tomtomRoutingService.searchLocations(prompt, bounds as any, undefined, { countrySet: city.countrySet, language: city.language })
            const seen = new Set(filteredSimilar.map(s => s.metadata.title.toLowerCase()))
            const hybrid = tomResults.slice(0, 10).map(r => ({
              activity_id: r.name,
              similarity: (r.relevanceScore ?? 50) / 100,
              metadata: {
                title: r.name,
                desc: r.address || `${r.category} in ${city.name}`,
                tags: [r.category || "Travel", ...(Array.isArray(interests) ? interests.slice(0,2) : [])].slice(0,4),
                time: "Anytime",
                image: "",
                peakHours: "",
                lat: r.coordinates.lat,
                lon: r.coordinates.lng,
              },
              relevanceScore: (r.relevanceScore ?? 50) / 100,
              reasoning: ["TomTom Baguio supplement"],
              confidence: 0.6,
              searchScores: { vector:0, semantic:0, fuzzy:0, contextual:0, temporal:0, diversity:0 },
              interestMatch: true,
              weatherMatch: true,
              searchMethod: 'tomtom_hybrid',
              vectorScore:0, semanticScore:0, confidenceLevel:0.6,
            })).filter(h => !seen.has((h.metadata.title as string).toLowerCase()))
            if (hybrid.length > 0) {
              filteredSimilar = [...filteredSimilar, ...hybrid].slice(0, 40)
              console.log(`🌍 BAGUIO SUPPLEMENT: Added ${hybrid.length} TomTom → total ${filteredSimilar.length}`)
            }
          } catch (e) {
            console.warn("Baguio TomTom supplement failed", e)
          }
        }

        if (filteredSimilar.length > 0) {
            let finalActivities: any[];
            let sanitisedAllowedActivities: any[];

            if (trafficAware) {
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

                // Soft traffic ranking — keep all, rank by combinedTrafficScore instead of hard drop
                // Previously hard-filtered HIGH/SEVERE → 0 results on congested PH days (retention killer)
                // Now we rank: VERY_LOW/LOW/MODERATE naturally score higher, HIGH/SEVERE penalized via trafficAwareActivitySearch
                const trafficFilteredActivities = trafficEnhancedActivities
                // Log soft penalty for observability (not filter)
                trafficFilteredActivities.forEach(a => {
                  const lvl = a.trafficAnalysis?.realTimeTraffic?.trafficLevel
                  if (lvl === 'HIGH' || lvl === 'SEVERE') {
                    console.log(`⚠️ TRAFFIC SOFT PENALTY: ${a.title} level ${lvl} will rank lower (not dropped)`)
                  }
                })

                // Final activity selection and validation
                finalActivities = trafficFilteredActivities.slice(0, Math.min(20, trafficFilteredActivities.length));
                // Enrich with accurate per-location images (Tier 0 curated for Baguio, Tier 1-3 for PH/world)
                try {
                    finalActivities = await enrichActivitiesWithImages(finalActivities as any, { concurrency: 5 }) as any
                } catch (e) {
                    console.warn("Image enrichment failed, keeping original images", e)
                }
                console.log(` FINAL SELECTION: Selected ${finalActivities.length} activities for itinerary generation`);

                // Build sanitised allowed activities (with traffic data)
                sanitisedAllowedActivities = finalActivities.map(activity => ({
                    image: activity.image,
                    title: activity.title,
                    time: activity.time,
                    desc: activity.desc,
                    tags: Array.isArray(activity.tags) ? activity.tags : [],
                    peakHours: activity.peakHours,
                    trafficAnalysis: activity.trafficAnalysis ? {
                        realTimeTraffic: activity.trafficAnalysis.realTimeTraffic,
                        recommendation: activity.trafficRecommendation,
                    } : undefined
                }));
            } else {
                // FAST MODE: Skip traffic enhancement, use raw search results
                console.log(`⚡ FAST MODE: Skipping traffic integration for ${filteredSimilar.length} activities`);
                finalActivities = filteredSimilar.map(s => ({
                    ...s.metadata,
                    relevanceScore: s.relevanceScore,
                    isCurrentlyPeak: s.isCurrentlyPeak,
                    searchReasoning: s.reasoning || [],
                    confidence: s.confidence || 0.7
                })).slice(0, 20);

                // Enrich fast-mode images as well (curated stays, new places get fetched)
                try {
                    finalActivities = await enrichActivitiesWithImages(finalActivities as any, { concurrency: 5 }) as any
                } catch (e) {
                    console.warn("Image enrichment (fast mode) failed", e)
                }
                sanitisedAllowedActivities = finalActivities.map((activity: any) => ({
                    image: activity.image,
                    title: activity.title,
                    time: activity.time,
                    desc: activity.desc,
                    tags: Array.isArray(activity.tags) ? activity.tags : [],
                    peakHours: activity.peakHours,
                }));
            }

            // Group activities by time period
            const groupByPeriod = () => ({
                Morning: [] as any[],
                Afternoon: [] as any[],
                Evening: [] as any[],
                Flexible: [] as any[]
            });

            const buckets = groupByPeriod();

            const normalizeActivity = (activity: any) => ({
                image: activity.image || '',
                title: activity.title,
                time: activity.time || '',
                desc: activity.desc || '',
                tags: Array.isArray(activity.tags) ? [...activity.tags] : [],
                peakHours: activity.peakHours,
                trafficAnalysis: activity.trafficAnalysis,
                trafficRecommendation: activity.trafficRecommendation,
                combinedTrafficScore: activity.combinedTrafficScore,
                relevanceScore: activity.relevanceScore,
                isCurrentlyPeak: activity.isCurrentlyPeak
            });

            const inferPeriod = (timeStr: string) => {
                const lower = timeStr.toLowerCase();
                if (lower.includes('morning') || (lower.includes('am') && !lower.includes('pm'))) {
                    return 'Morning';
                }
                if (lower.includes('afternoon')) {
                    return 'Afternoon';
                }
                if (lower.includes('evening') || lower.includes('night') || lower.includes('pm')) {
                    return 'Evening';
                }
                return 'Flexible';
            };

            finalActivities.forEach(activity => {
                const normalized = normalizeActivity(activity);
                const periodKey = inferPeriod(activity.time || '');
                buckets[periodKey].push(normalized);
            });

            const items: Array<{ period: string; activities: any[] }> = [];

            (['Morning', 'Afternoon', 'Evening'] as const).forEach(period => {
                if (buckets[period].length > 0) {
                    items.push({ period, activities: buckets[period] });
                }
            });

            if (buckets.Flexible.length > 0) {
                items.push({ period: "Flexible Time", activities: buckets.Flexible });
            }

            // Log traffic integration for traffic-aware mode only
            if (trafficAware) {
                console.log(`
=== FINAL ITINERARY TRAFFIC INTEGRATION ===`);
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
            }

            // Add traffic tags only in traffic-aware mode
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const validatedActivities = trafficAware ? finalActivities.map(activity => {
                const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
                const tags = [...(activity.tags || [])];
                
                // Add traffic tags
                if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
                    tags.push('low-traffic');
                } else if (trafficLevel === 'MODERATE') {
                    tags.push('moderate-traffic');
                }
                
                return {
                    ...activity,
                    tags
                };
            }) : finalActivities;

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
                            return rawActivity;
                        }).filter(Boolean)
                    }
                ],
                searchMetadata: {
                    searchMethod: finalResults.length >= 10 ? 'intelligent' : 'semantic',
                    totalResults: filteredSimilar.length,
                    processingTime: Date.now(),
                    allowedActivities: sanitisedAllowedActivities
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
 * Determine time of day based on city time (defaults to Baguio/Manila for backward compat)
 */
function determineTimeOfDay(cityId: string = "baguio"): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const cityTime = getCityTime(cityId);
    const hour = cityTime.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    return 'anytime';
}
