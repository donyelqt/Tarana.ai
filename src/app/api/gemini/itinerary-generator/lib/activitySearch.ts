
import { proposeSubqueries } from "../agent/agent";
import { logger } from "../../../../../lib/observability/logger";
import { getCityTime } from "@/lib/traffic/peakHours";

import { WEATHER_TAG_FILTERS } from "./config";
import { trafficAwareActivitySearch, createDefaultTrafficOptions } from "@/lib/traffic";
import { IntelligentSearchEngine, type IntelligentSearchResult } from "@/lib/search";
import { enrichActivitiesWithImages } from "@/lib/services/imageService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCityConfig, isWithinCityBounds, type CityId } from "@/lib/data/cityConfig";
import { rotateByDay } from "@/lib/utils/dailyRotation";
import { extractMatchTerms, matchLocalActivities } from "@/lib/utils/localMatch";
import type { SearchResult, BoundingBox } from "@/types/route-optimization";
import { tomtomRoutingService } from "@/lib/services/tomtomRouting";
import { getTouristPois, getInterestPois, INTEREST_QUERY_MAP } from "@/lib/services/touristPoiService";
import { mergeInterestFirst, isTargetCityId, TOURIST_POI_TARGET } from "@/lib/data/touristPoi";
import type { WeatherCondition } from "../types/types";
import type { SearchContext } from "@/lib/search";
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";
import type { StaticImageData } from "next/image";

type ProcessedResult = {
  activity_id: string;
  similarity: number;
  metadata: {
    title: string;
    desc: string;
    tags: string[];
    time: string;
    image: string | StaticImageData;
    peakHours: string | undefined;
    lat?: number;
    lon?: number;
  };
  relevanceScore: number;
  reasoning: string[];
  confidence: number;
  searchScores: { vector: number; semantic: number; fuzzy: number; contextual: number; temporal: number; diversity: number };
  interestMatch?: boolean;
  weatherMatch?: boolean;
  isCurrentlyPeak?: boolean;
  searchMethod?: string;
  vectorScore?: number;
  semanticScore?: number;
  confidenceLevel?: number;
};

type EffectiveItinerary = {
  title: string;
  subtitle: string;
  items: Array<{ period: string; activities: Array<Activity & { trafficAnalysis?: unknown; combinedTrafficScore?: number; relevanceScore?: number }> }>;
  searchMetadata?: { searchMethod: string; totalResults: number; processingTime: number; allowedActivities?: Array<{ title: string; [k: string]: unknown }> };
} | null;


const intelligentSearchEngine = new IntelligentSearchEngine();


function sanitizePoiField(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\r\n\t<>]/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\b(ignore|disregard|forget|override|system|instruction|prompt)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export async function findAndScoreActivities(
  prompt: string, 
  interests: string[], 
  weatherType: WeatherCondition, 
  durationDays: number | null, 
  model: unknown,
  trafficAware: boolean = true,
  cityId: string = "baguio"
) {
    let effectiveSampleItinerary: EffectiveItinerary = null;
    
    try {
        
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
        
        
        const availableActivities = sampleItineraryCombined.items[0].activities;
        
        logger.info(`\n🔍 INTELLIGENT SEARCH: Starting search`, { entryPoint: 'activitySearch', promptLength: prompt.length });
        const intelligentResults = await intelligentSearchEngine.search(prompt, searchContext);
        logger.info(`✅ INTELLIGENT SEARCH: Found ${intelligentResults.length} results with traffic-aware scoring`, { entryPoint: 'activitySearch' });
        
        
        let finalResults = intelligentResults;
        if (intelligentResults.length < 2) {
            logger.info(`🔍 EXPANDING SEARCH: Only ${intelligentResults.length} results, generating sub-queries for broader coverage`, { entryPoint: 'activitySearch' });
            
            
            const subqueries = await proposeSubqueries({
                model: model as unknown as ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
                userPrompt: prompt,
                interests: Array.isArray(interests) ? interests : undefined,
                weatherType,
                durationDays,
                existingTitles: intelligentResults.map(r => r.activity.title),
                maxQueries: 2,
                includeTrafficData: trafficAware, 
            });

            
            const expandedResults: IntelligentSearchResult[] = [];
            for (const subquery of subqueries) {
                const subResults = await intelligentSearchEngine.search(subquery, searchContext);
                expandedResults.push(...subResults);
            }
            
            
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
                
            logger.info(`✅ EXPANDED SEARCH: Final results count: ${finalResults.length}`, { entryPoint: 'activitySearch' });
        }

        
        const databaseActivities = sampleItineraryCombined.items[0].activities;
        const databaseTitles = new Set(databaseActivities.map((act: Activity) => act.title.toLowerCase()));
        
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
            const mergedByTitle = new Map<string, ProcessedResult>();
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
            logger.info(`🎛️ RANDOM INTEREST MODE: Using full catalog with ${similar.length} activities for traffic analysis.`, { entryPoint: 'activitySearch' });
        }

        
        const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as unknown as Record<string, string[]>)[weatherType] ?? [];

        const scoredSimilar = similar.map((s: ProcessedResult) => {
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

        
        
        if (cityId !== "baguio") {
          
          
          if (!isTargetCityId(cityId)) {
            logger.warn(`⚠️ STRICT CITY: no shared tourist pool for scope "${cityId}" — returning EMPTY (no Baguio leakage)`, { entryPoint: 'activitySearch', cityId: cityId })
            filteredSimilar = []
          } else {
            try {
              const city = getCityConfig(cityId)

              
              
              
              
              const safeInterests = Array.isArray(interests)
                ? interests.filter(i => i && i !== "Random")
                : []
              const interestPois = await getInterestPois(cityId, safeInterests, 20)
              const touristPois = await getTouristPois(cityId)

              if (interestPois.length > 0) {
                logger.info(`🎯 STRICT CITY: ${cityId} → ${interestPois.length} interest-matched POIs for [${safeInterests.slice(0, 2).join(', ')}]`, { entryPoint: 'activitySearch', cityId: cityId })
              }

              
              
              
              
              
              
              
              
              const dayIndex = Math.floor(getCityTime(cityId).getTime() / 86400000)
              const rotatedTourists = touristPois.length > 1
                ? rotateByDay(touristPois, dayIndex)
                : touristPois
              const merged = mergeInterestFirst(
                interestPois,
                rotatedTourists,
                cityId,
                TOURIST_POI_TARGET
              )

              if (merged.length > 0) {
                filteredSimilar = merged.slice(0, 20).map(r => ({
                  activity_id: sanitizePoiField(r.name) || r.name,
                  similarity: (r.relevanceScore ?? 50) / 100,
                  metadata: {
                    title: sanitizePoiField(r.name) || r.name,
                    desc: sanitizePoiField(r.address) || sanitizePoiField(`${r.category} in ${city.name}`),
                    tags: [sanitizePoiField(r.category) || "Travel", ...(Array.isArray(interests) ? interests.slice(0,2) : [])].slice(0,4),
                    time: "Anytime",
                    image: "",
                    peakHours: "",
                    lat: r.coordinates.lat,
                    lon: r.coordinates.lng,
                  },
                  relevanceScore: (r.relevanceScore ?? 50) / 100,
                  reasoning: [`TomTom ${city.name} tourist POI`],
                  confidence: 0.6,
                  searchScores: { vector:0, semantic:0, fuzzy:0, contextual:0, temporal:0, diversity:0 },
                  interestMatch: true,
                  weatherMatch: true,
                  searchMethod: 'tomtom_strict',
                  vectorScore:0, semanticScore:0, confidenceLevel:0.6,
                }))
                logger.info(`🌍 STRICT CITY: ${cityId} → ${filteredSimilar.length} shared tourist POIs`, { entryPoint: 'activitySearch', cityId: cityId })
              } else {
                
                logger.warn(`⚠️ STRICT CITY: shared tourist POI pool returned 0 for ${cityId} — returning EMPTY (no Baguio leakage)`, { entryPoint: 'activitySearch', cityId: cityId })
                filteredSimilar = []
              }
            } catch (e) {
              logger.warn(`⚠️ STRICT CITY: tourist POI lookup failed for ${cityId} — returning EMPTY (no Baguio leakage)`, { entryPoint: 'activitySearch', error: e })
              filteredSimilar = []
            }
          }
        } else if (filteredSimilar.length < 8) {
            
            
            
            
            
            
            try {
                const city = getCityConfig("baguio")
                const bounds = {
                    topLeft: { lat: city.bounds.north, lng: city.bounds.west },
                    bottomRight: { lat: city.bounds.south, lng: city.bounds.east },
                }
                const safeInterests = Array.isArray(interests) ? interests.filter(i => i && i !== "Random") : []
                const genericQuery = `tourist attractions ${city.name}`
                const queryCandidates = safeInterests.length > 0
                    ? [
                        `${safeInterests.slice(0, 2).map(i => INTEREST_QUERY_MAP[i] ?? i).join(" ")} ${city.name}`,
                        ...safeInterests.slice(0, 2).map(i => `${INTEREST_QUERY_MAP[i] ?? i} ${city.name}`),
                        genericQuery,
                    ]
                    : [genericQuery]
                const seenTitles = new Set(filteredSimilar.map(s => s.metadata.title.toLowerCase()))
                let baguioTomResults: SearchResult[] = []
                for (const q of queryCandidates) {
                    if (baguioTomResults.length >= 10) break
                    try {
                        const batch = await tomtomRoutingService.searchLocations(q, bounds as BoundingBox, undefined, { countrySet: city.countrySet, language: city.language })
                        for (const r of batch) {
                            const key = `${r.coordinates.lat.toFixed(3)},${r.coordinates.lng.toFixed(3)}`
                            if (!seenTitles.has(key)) { seenTitles.add(key); baguioTomResults.push(r) }
                        }
                        logger.info(`🌍 BAGUIO SUPPLEMENT: query "${q}" → ${batch.length} results (cumulative ${baguioTomResults.length})`, { entryPoint: 'activitySearch', q: q })
                    } catch (qErr) {
                        logger.warn(`BAGUIO SUPPLEMENT query "${q}" failed`, { entryPoint: 'activitySearch', error: qErr })
                    }
                }
                
                {
                    const beforeBounds = baguioTomResults.length
                    const filteredByBounds = baguioTomResults.filter(r => {
                        const lat = r.coordinates.lat
                        const lon = r.coordinates.lng
                        if (lat == null || lon == null) return false
                        return isWithinCityBounds(lat, lon, "baguio")
                    })
                    if (beforeBounds !== filteredByBounds.length) {
                        logger.info(`BAGUIO SUPPLEMENT: bounds filter removed ${beforeBounds - filteredByBounds.length} out-of-bounds`, { entryPoint: 'activitySearch' })
                    }
                    baguioTomResults = filteredByBounds
                }
                const hybrid = baguioTomResults.slice(0, 10).map(r => ({
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
                    reasoning: ["TomTom Baguio supplement (compact query)"],
                    confidence: 0.6,
                    searchScores: { vector:0, semantic:0, fuzzy:0, contextual:0, temporal:0, diversity:0 },
                    interestMatch: true,
                    weatherMatch: true,
                    searchMethod: 'tomtom_hybrid',
                    vectorScore:0, semanticScore:0, confidenceLevel:0.6,
                }))
                if (hybrid.length > 0) {
                    filteredSimilar = [...filteredSimilar, ...hybrid].slice(0, 40)
                    logger.info(`🌍 BAGUIO SUPPLEMENT: Added ${hybrid.length} TomTom → total ${filteredSimilar.length}`, { entryPoint: 'activitySearch' })
                } else {
                    logger.warn(`🌍 BAGUIO SUPPLEMENT: TomTom returned 0 for Baguio across ${queryCandidates.length} compact queries — falling through to empty-result fallback`, { entryPoint: 'activitySearch' })
                }
            } catch (e) {
                logger.warn(`Baguio TomTom supplement failed`, { entryPoint: 'activitySearch', error: e })
            }
        }

        
        
        
        
        
        
        
        if (filteredSimilar.length === 0 && cityId === "baguio") {
            const terms = extractMatchTerms(interests);
            const allowedWeatherTags: string[] = (WEATHER_TAG_FILTERS as unknown as Record<string, string[]>)[weatherType] ?? [];
            const catalog = sampleItineraryCombined.items[0].activities;
            const tier1 = matchLocalActivities(catalog, terms, allowedWeatherTags);
            const tier2 = tier1.length > 0 ? tier1 : matchLocalActivities(catalog, terms, []);
            const net = tier2.length > 0 ? tier2 : catalog.slice(0, 40);
            logger.info(`🛟 BAGUIO SAFETY NET: ${net.length} local matches (terms: [${terms.join(", ") || "none"}])`, { entryPoint: 'activitySearch' });
            filteredSimilar = net.slice(0, 40).map((activity: Activity) => ({
                activity_id: activity.title,
                similarity: 0.25,
                metadata: {
                    title: activity.title,
                    desc: activity.desc,
                    tags: activity.tags,
                    time: activity.time,
                    image: activity.image,
                    peakHours: activity.peakHours,
                },
                relevanceScore: 0.25,
                reasoning: ['Baguio safety-net local match'],
                confidence: 0.5,
                searchScores: { vector:0, semantic:0, fuzzy:0, contextual:0, temporal:0, diversity:0 },
                interestMatch: true,
                weatherMatch: true,
                searchMethod: 'baguio_safety_net',
                vectorScore:0, semanticScore:0, confidenceLevel:0.5,
            }));
        }

        
        
        
        
        const FINALIST_CAP = 12;
        if (filteredSimilar.length > FINALIST_CAP) {
            logger.info(`✂️ SHORTLIST: capping ${filteredSimilar.length} → ${FINALIST_CAP} before traffic+image enrichment`, { entryPoint: 'activitySearch', FINALIST_CAP: FINALIST_CAP });
            filteredSimilar = filteredSimilar.slice(0, FINALIST_CAP);
        }

        if (filteredSimilar.length > 0) {
            let finalActivities: Array<Activity & { trafficAnalysis?: unknown; combinedTrafficScore?: number; relevanceScore?: number; isCurrentlyPeak?: boolean }>;
            let sanitisedAllowedActivities: Array<{ image: string | StaticImageData; title: string; time: string; desc: string; tags: string[]; peakHours?: string; trafficAnalysis?: unknown }>;

            if (trafficAware) {
                
                logger.info(`\n🚦 TRAFFIC-AWARE SEARCH: Processing ${filteredSimilar.length} activities`, { entryPoint: 'activitySearch' });
                const trafficOptions = createDefaultTrafficOptions();
                const trafficEnhancedActivities = await trafficAwareActivitySearch.enhanceActivitiesWithTraffic(
                    filteredSimilar.map(s => s.metadata),
                    trafficOptions
                );
                logger.info(`✅ TRAFFIC-AWARE SEARCH: Enhanced ${trafficEnhancedActivities.length} activities with real-time traffic data`, { entryPoint: 'activitySearch' });
                
                
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
                
                logger.info(`🎯 TOMTOM API SUCCESS RATE: ${successfulTrafficFetches}/${totalActivities} (${Math.round(successfulTrafficFetches/totalActivities*100)}%)`, { entryPoint: 'activitySearch', successfulTrafficFetches: successfulTrafficFetches, totalActivities: totalActivities });
                logger.info(`📊 DETAILED TRAFFIC DATA:`, { entryPoint: 'activitySearch', trafficSummary });

                
                
                
                const trafficFilteredActivities = trafficEnhancedActivities
                
                trafficFilteredActivities.forEach(a => {
                  const lvl = a.trafficAnalysis?.realTimeTraffic?.trafficLevel
                  if (lvl === 'HIGH' || lvl === 'SEVERE') {
                    logger.info(`⚠️ TRAFFIC SOFT PENALTY: ${a.title} level ${lvl} will rank lower (not dropped)`, { entryPoint: 'activitySearch', lvl: lvl })
                  }
                })

                
                finalActivities = trafficFilteredActivities.slice(0, Math.min(20, trafficFilteredActivities.length));
                
                try {
                    finalActivities = await enrichActivitiesWithImages(finalActivities as unknown as Array<{ title: string; lat?: number; lon?: number; image?: unknown }>, { concurrency: 5, city: getCityConfig(cityId).name, cityId: cityId as CityId }) as unknown as typeof finalActivities
                } catch (e) {
                    logger.warn(`Image enrichment failed, keeping original images`, { entryPoint: 'activitySearch', error: e })
                }
                logger.info(` FINAL SELECTION: Selected ${finalActivities.length} activities for itinerary generation`, { entryPoint: 'activitySearch' });

                
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
                
                logger.info(`⚡ FAST MODE: Skipping traffic integration for ${filteredSimilar.length} activities`, { entryPoint: 'activitySearch' });
                finalActivities = filteredSimilar.map(s => ({
                    ...s.metadata,
                    relevanceScore: s.relevanceScore,
                    isCurrentlyPeak: s.isCurrentlyPeak,
                    searchReasoning: s.reasoning || [],
                    confidence: s.confidence || 0.7
                })).slice(0, 20);

                
                try {
                    finalActivities = await enrichActivitiesWithImages(finalActivities as unknown as Array<{ title: string; lat?: number; lon?: number; image?: unknown }>, { concurrency: 5, city: getCityConfig(cityId).name, cityId: cityId as CityId }) as unknown as typeof finalActivities
                } catch (e) {
                    logger.warn(`Image enrichment (fast mode) failed`, { entryPoint: 'activitySearch', error: e })
                }
                sanitisedAllowedActivities = finalActivities.map((activity: Activity & { trafficAnalysis?: unknown }) => ({
                    image: activity.image,
                    title: activity.title,
                    time: activity.time,
                    desc: activity.desc,
                    tags: Array.isArray(activity.tags) ? activity.tags : [],
                    peakHours: activity.peakHours,
                }));
            }

            
            const groupByPeriod = () => ({
                Morning: [] as Activity[],
                Afternoon: [] as Activity[],
                Evening: [] as Activity[],
                Flexible: [] as Activity[]
            });

            const buckets = groupByPeriod();

            const normalizeActivity = (activity: Activity & { trafficAnalysis?: unknown; trafficRecommendation?: unknown; combinedTrafficScore?: number; relevanceScore?: number; isCurrentlyPeak?: boolean }) => ({
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

            const items: Array<{ period: string; activities: Array<Activity & { trafficAnalysis?: unknown }> }> = [];

            (['Morning', 'Afternoon', 'Evening'] as const).forEach(period => {
                if (buckets[period].length > 0) {
                    items.push({ period, activities: buckets[period] });
                }
            });

            if (buckets.Flexible.length > 0) {
                items.push({ period: "Flexible Time", activities: buckets.Flexible });
            }

            
            if (trafficAware) {
                const finalTrafficStats = finalActivities.map(activity => ({
                    activity: activity.title,
                    realTimeTraffic: activity.trafficAnalysis?.realTimeTraffic ? 'INTEGRATED' : 'FALLBACK',
                    trafficLevel: activity.trafficAnalysis?.realTimeTraffic?.trafficLevel || 'UNKNOWN',
                    optimalScore: activity.trafficAnalysis?.realTimeTraffic?.recommendationScore || 0,
                    combinedScore: activity.combinedTrafficScore || 0,
                    recommendation: activity.trafficRecommendation || 'UNKNOWN'
                }));
                
                const integratedCount = finalTrafficStats.filter(a => a.realTimeTraffic === 'INTEGRATED').length;
                logger.info(`🚀 REAL-TIME TRAFFIC INTEGRATION: ${integratedCount}/${finalActivities.length} activities using live TomTom data`, { entryPoint: 'activitySearch', integratedCount: integratedCount });
                logger.info(`📈 TRAFFIC-AWARE ITINERARY:`, { entryPoint: 'activitySearch', finalTrafficStats });
            }

            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const validatedActivities = trafficAware ? finalActivities.map(activity => {
                const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
                const tags = [...(activity.tags || [])];
                
                
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
            } as unknown as typeof effectiveSampleItinerary;
        } else if (cityId === "baguio") {
            
            
            
            
            
            
            
            
            
            
            
            
            
            const safeInterestsForFallback = Array.isArray(interests)
                ? interests.filter(i => i && i !== "Random")
                : [];
            
            
            const cityForFallback = getCityConfig(cityId).name;
            
            
            const INTEREST_TOKEN_MAP: Record<string, string> = {
                "Food & Culinary": "food culinary",
                "Nature & Scenery": "nature scenery park",
                "Culture & Arts": "culture arts museum",
                "Shopping & Local Finds": "shopping market",
                "Adventure": "adventure outdoor",
            };
            const compactTokens = safeInterestsForFallback.length > 0
                ? safeInterestsForFallback.map(i => (INTEREST_TOKEN_MAP[i] ?? i).toLowerCase())
                : [];
            if (cityForFallback) compactTokens.push(cityForFallback.toLowerCase());

            const allCurated = sampleItineraryCombined.items.flatMap((it: any) => it.activities || []);
            const fallbackMatches = compactTokens.length > 0
                ? allCurated.filter((activity: Activity) => {
                    const haystack = `${activity.title} ${activity.desc} ${(activity.tags || []).join(" ")}`.toLowerCase();
                    return compactTokens.some(tok => haystack.includes(tok));
                })
                : allCurated.slice(0, 20); 

            if (fallbackMatches.length > 0) {
                effectiveSampleItinerary = {
                    title: `${cityForFallback} Recommendations`,
                    subtitle: `Curated activities matched to your interests (vector search returned no results)`,
                    items: [{
                        period: "Anytime",
                        activities: fallbackMatches.slice(0, 20).map((activity: Activity) => ({
                            ...activity,
                            relevanceScore: 0.4,
                            isCurrentlyPeak: false,
                            searchReasoning: ["Empty-result fallback: local text match"],
                            confidence: 0.5,
                        })),
                    }],
                    searchMetadata: {
                        searchMethod: 'fallback_empty',
                        totalResults: fallbackMatches.length,
                        processingTime: Date.now(),
                        allowedActivities: fallbackMatches.slice(0, 20).map((activity: Activity) => ({
                            image: activity.image,
                            title: activity.title,
                            time: activity.time,
                            desc: activity.desc,
                            tags: Array.isArray(activity.tags) ? activity.tags : [],
                            peakHours: activity.peakHours,
                        })),
                    },
                } as unknown as typeof effectiveSampleItinerary;
                logger.info(`🛟 EMPTY-RESULT FALLBACK: ${fallbackMatches.length} local matches for ${cityId} via compact tokens [${compactTokens.slice(0, 4).join(', ')}...]`, { entryPoint: 'activitySearch', cityId: cityId });
            } else {
                logger.warn(`🛟 EMPTY-RESULT FALLBACK: no curated matches for ${cityId} either — returning null (composer will handle)`, { entryPoint: 'activitySearch', cityId: cityId });
            }
        }
    } catch (searchErr) {
        logger.warn(`Intelligent search failed, falling back to basic search`, { entryPoint: 'activitySearch', error: searchErr });

        
        
        
        if (cityId === "baguio") {
        
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
        } else {
            logger.warn(`STRICT CITY: refusing Baguio curated fallback for ${cityId} — returning honest empty`, { entryPoint: 'activitySearch', cityId: cityId });
        }
    }

    return effectiveSampleItinerary;
}


function determineTimeOfDay(cityId: string = "baguio"): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const cityTime = getCityTime(cityId);
    const hour = cityTime.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    return 'anytime';
}
