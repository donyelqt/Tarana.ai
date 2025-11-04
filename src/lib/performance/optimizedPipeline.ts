/**
 * Optimized Itinerary Generation Pipeline
 * Enterprise-grade pipeline with 3-5x performance improvements
 * 
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

import { ultraFastItineraryEngine } from "./ultraFastItineraryEngine";
import { parallelTrafficProcessor } from "./parallelTrafficProcessor";
import { smartCacheManager } from "./smartCacheManager";
import { buildDetailedPrompt } from "@/app/api/gemini/itinerary-generator/lib/contextBuilder";
import { handleItineraryProcessing } from "@/app/api/gemini/itinerary-generator/lib/responseHandler";
import { getPeakHoursContext } from "@/lib/traffic";
import { GuaranteedJsonEngine } from '@/app/api/gemini/itinerary-generator/lib/guaranteedJsonEngine';
import type { WeatherCondition } from "@/app/api/gemini/itinerary-generator/types/types";
import crypto from "crypto";

const PIPELINE_DEBUG = (() => {
  const envValue = process.env.OPTIMIZED_PIPELINE_DEBUG ?? process.env.NEXT_PUBLIC_OPTIMIZED_PIPELINE_DEBUG;
  if (typeof envValue === 'string') {
    return envValue.toLowerCase() !== 'false';
  }
  return true;
})();

const debugLog = (...args: unknown[]) => {
  if (PIPELINE_DEBUG) {
    console.log(...args);
  }
};

export interface PipelineMetrics {
  totalTime: number;
  phases: {
    search: number;
    traffic: number;
    ai: number;
    processing: number;
  };
  optimizations: {
    cacheHits: number;
    apiCallsReduced: number;
    parallelizationGain: number;
  };
  performance: {
    activitiesProcessed: number;
    throughput: number; // activities per second
    efficiency: number; // 0-100 score
  };
}

export interface OptimizedGenerationRequest {
  prompt: string;
  interests: string[];
  weatherData: any;
  durationDays: number | null;
  budget: string;
  pax: string;
  model: any;
}

/**
 * Ultra-fast itinerary generation pipeline
 */
export class OptimizedPipeline {
  private static instance: OptimizedPipeline;
  
  private constructor() {}

  static getInstance(): OptimizedPipeline {
    if (!OptimizedPipeline.instance) {
      OptimizedPipeline.instance = new OptimizedPipeline();
    }
    return OptimizedPipeline.instance;
  }

  /**
   * Generate itinerary with ultra-fast optimizations
   */
  async generateOptimized(request: OptimizedGenerationRequest): Promise<{
    itinerary: any;
    metrics: PipelineMetrics;
  }> {
    const pipelineStartTime = Date.now();
    debugLog(`🚀 OPTIMIZED PIPELINE: Starting ultra-fast generation for "${request.prompt}"`);

    // Determine weather type efficiently
    const weatherType = this.getWeatherTypeOptimized(request.weatherData);

    // Phase 1: Ultra-Fast Activity Search (200-500ms)
    const searchStartTime = Date.now();
    const { activities, metrics: searchMetrics } = await ultraFastItineraryEngine.findActivitiesUltraFast(
      request.prompt,
      request.interests,
      weatherType,
      request.durationDays,
      request.model
    );
    const searchTime = Date.now() - searchStartTime;

    debugLog(`⚡ SEARCH PHASE: Completed in ${searchTime}ms with ${activities.length} activities`);

    // Phase 2: Parallel Traffic Enhancement (300-800ms)
    const trafficStartTime = Date.now();
    const { enhancedActivities, metrics: trafficMetrics } = await parallelTrafficProcessor.processActivitiesUltraFast(activities);
    const shuffleSeed = this.computeActivityShuffleSeed(request);
    const shuffledActivities = this.shuffleActivities(enhancedActivities, shuffleSeed);
    const activitiesForPrompt = this.limitActivitiesToCapacity(shuffledActivities, request.durationDays);
    const allowedActivitiesSnapshot = this.createAllowedActivitiesSnapshot(activitiesForPrompt);
    const normalizeTitle = (title: string) =>
      title
        ?.toLowerCase()
        .normalize('NFKD')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
    const trafficMetadata = new Map<string, {
      originalTitle: string;
      trafficAnalysis?: any;
      trafficRecommendation?: string;
      combinedTrafficScore?: number;
      crowdLevel?: string;
      lat?: number;
      lon?: number;
      trafficLevel?: string;
      tags: string[];
    }>();

    activitiesForPrompt.forEach(activity => {
      if (!activity?.title) {
        return;
      }

      const key = normalizeTitle(activity.title);
      if (!key) {
        return;
      }

      trafficMetadata.set(key, {
        originalTitle: activity.title,
        trafficAnalysis: activity.trafficAnalysis,
        trafficRecommendation: activity.trafficRecommendation,
        combinedTrafficScore: activity.combinedTrafficScore,
        crowdLevel: activity.crowdLevel,
        lat: activity.lat,
        lon: activity.lon,
        trafficLevel: activity.trafficAnalysis?.realTimeTraffic?.trafficLevel || (activity as any).trafficLevel,
        tags: Array.isArray(activity.tags) ? [...activity.tags] : [],
      });
    });
    const metadataEntries = Array.from(trafficMetadata.entries());
    const findMetadataForTitle = (title: string) => {
      const normalized = normalizeTitle(title);
      if (!normalized) {
        return undefined;
      }

      let metadata = trafficMetadata.get(normalized);
      if (metadata) {
        return metadata;
      }

      metadata = metadataEntries.find(([storedKey]) =>
        storedKey.includes(normalized) || normalized.includes(storedKey)
      )?.[1];
      if (metadata) {
        return metadata;
      }

      metadata = metadataEntries.find(([, value]) => {
        const originalNormalized = normalizeTitle(value.originalTitle || '');
        return originalNormalized && (originalNormalized.includes(normalized) || normalized.includes(originalNormalized));
      })?.[1];
      if (metadata) {
        return metadata;
      }

      metadata = metadataEntries.find(([, value]) => {
        const original = value.originalTitle?.toLowerCase() || '';
        const current = title.toLowerCase();
        return original.includes(current) || current.includes(original);
      })?.[1];

      return metadata;
    };
    const trafficTime = Date.now() - trafficStartTime;

    debugLog(`🚦 TRAFFIC PHASE: Completed in ${trafficTime}ms with ${activitiesForPrompt.length} shuffled activities`);

    // Phase 3 & 4: Structured AI Generation & Processing (1000-2000ms)
    const aiStartTime = Date.now();

    // Build detailed prompt for structured generation
    const effectiveSampleItinerary = this.buildEffectiveSampleItinerary(
      activitiesForPrompt,
      request,
      allowedActivitiesSnapshot,
      shuffleSeed
    );
    const detailedPrompt = buildDetailedPrompt(
        request.prompt,
        effectiveSampleItinerary,
        request.weatherData,
        request.interests,
        request.durationDays,
        request.budget,
        request.pax,
        true // CRITICAL: Restrict AI to only use filtered activities
    );

    // Generate guaranteed structured itinerary
    const structuredItinerary = await GuaranteedJsonEngine.generateGuaranteedJson(detailedPrompt, effectiveSampleItinerary, '', '');
    const structuredItineraryWithMetadata: any = {
      ...structuredItinerary,
      searchMetadata: {
        ...(structuredItinerary as any)?.searchMetadata,
        allowedActivities: allowedActivitiesSnapshot,
        source: 'traffic_filtered'
      }
    };
    const aiTime = Date.now() - aiStartTime;

    debugLog(`🤖 STRUCTURED AI PHASE: Completed in ${aiTime}ms`);

    // The output is already validated, so we can skip complex parsing.
    // We still need to run the final processing steps.
    const processingStartTime = Date.now();
    const peakHoursContext = getPeakHoursContext();
    const finalItinerary = await handleItineraryProcessing(
      structuredItineraryWithMetadata,
      request.prompt,
      request.durationDays,
      peakHoursContext
    );

    if (finalItinerary?.items) {
      finalItinerary.items = finalItinerary.items.map((period: any) => {
        const updatedActivities = (period.activities || []).map((activity: any) => {
          const title = activity?.title;
          if (!title) {
            return activity;
          }

          const metadata = findMetadataForTitle(title);
          if (!metadata) {
            return activity;
          }

          const trafficLevel = metadata.trafficAnalysis?.realTimeTraffic?.trafficLevel
            ?? metadata.trafficLevel
            ?? activity.trafficLevel;
          const mergedTags = new Set<string>([
            ...(Array.isArray(activity.tags) ? activity.tags : []),
            ...(metadata.tags || []),
          ]);

          if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
            mergedTags.add('low-traffic');
          } else if (trafficLevel === 'MODERATE') {
            mergedTags.add('moderate-traffic');
          }

          return {
            ...activity,
            trafficAnalysis: metadata.trafficAnalysis,
            trafficRecommendation: metadata.trafficRecommendation ?? activity.trafficRecommendation,
            combinedTrafficScore: metadata.combinedTrafficScore ?? activity.combinedTrafficScore,
            crowdLevel: metadata.crowdLevel ?? activity.crowdLevel,
            lat: metadata.lat ?? activity.lat,
            lon: metadata.lon ?? activity.lon,
            trafficLevel,
            tags: Array.from(mergedTags),
          };
        });

        return {
          ...period,
          activities: updatedActivities,
        };
      });
    }

    if (finalItinerary) {
      finalItinerary.searchMetadata = {
        ...(structuredItineraryWithMetadata.searchMetadata || {}),
        ...(finalItinerary.searchMetadata || {})
      };
    }
    const processingTime = Date.now() - processingStartTime;
    const totalTime = Date.now() - pipelineStartTime;

    debugLog(`⚡ PROCESSING PHASE: Completed in ${processingTime}ms`);

    // Calculate comprehensive metrics
    const metrics: PipelineMetrics = {
      totalTime,
      phases: {
        search: searchTime,
        traffic: trafficTime,
        ai: aiTime,
        processing: processingTime
      },
      optimizations: {
        cacheHits: searchMetrics.cacheHitRate * 100,
        apiCallsReduced: trafficMetrics.apiCallsReduced,
        parallelizationGain: searchMetrics.parallelizationGain
      },
      performance: {
        activitiesProcessed: activitiesForPrompt.length,
        throughput: activitiesForPrompt.length / (totalTime / 1000),
        efficiency: this.calculateEfficiencyScore(totalTime, activitiesForPrompt.length)
      }
    };

    const throughput = activitiesForPrompt.length / (totalTime / 1000 || 1);
    debugLog(`🎯 OPTIMIZED PIPELINE: Completed in ${totalTime}ms (${throughput.toFixed(2)} activities/sec)`);
    debugLog(
      `📊 PERFORMANCE BREAKDOWN:\n` +
      `   • Search Phase....... ${searchTime}ms\n` +
      `   • Traffic Phase...... ${trafficTime}ms\n` +
      `   • AI Generation...... ${aiTime}ms\n` +
      `   • Post-Processing.... ${processingTime}ms\n` +
      `   • Total Time......... ${totalTime}ms\n` +
      `   • Efficiency Score... ${metrics.performance.efficiency}%`
    );
    debugLog(
      `🧠 OPTIMIZATION INSIGHTS:\n` +
      `   • Activities Enhanced..... ${activitiesForPrompt.length}\n` +
      `   • Throughput.............. ${throughput.toFixed(2)} activities/sec\n` +
      `   • Cache Hit Rate.......... ${searchMetrics.cacheHitRate * 100}%\n` +
      `   • API Calls Reduced....... ${trafficMetrics.apiCallsReduced}\n` +
      `   • Parallelization Gain.... ${searchMetrics.parallelizationGain}`
    );

    return { itinerary: finalItinerary, metrics };
  }

  /**
   * Build effective sample itinerary optimized for AI context
   */
  private buildEffectiveSampleItinerary(
    activities: any[],
    request: OptimizedGenerationRequest,
    allowedActivities: any[],
    shuffleSeed?: number
  ): any {
    // Group activities by time period for better organization
    const morningActivities: any[] = [];
    const afternoonActivities: any[] = [];
    const eveningActivities: any[] = [];
    const anytimeActivities: any[] = [];

    activities.forEach(activity => {
      const timeStr = activity.time?.toLowerCase() || "";
      
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
    if (morningActivities.length > 0) items.push({ period: "Morning", activities: morningActivities });
    if (afternoonActivities.length > 0) items.push({ period: "Afternoon", activities: afternoonActivities });
    if (eveningActivities.length > 0) items.push({ period: "Evening", activities: eveningActivities });
    if (anytimeActivities.length > 0) items.push({ period: "Flexible Time", activities: anytimeActivities });

    const itinerary = {
      title: "Ultra-Fast Personalized Recommendations",
      subtitle: `Activities optimized using enterprise-grade algorithms with real-time traffic data`,
      items: items.length > 0 ? items : [{
        period: "Anytime",
        activities: activities.slice(0, 15)
      }],
      searchMetadata: {
        searchMethod: 'optimized',
        totalResults: activities.length,
        processingTime: Date.now(),
        optimizations: ['parallel_processing', 'smart_caching', 'geographic_clustering'],
        allowedActivitiesCount: allowedActivities?.length ?? 0,
        activityShuffleSeed: shuffleSeed ?? null,
        activityOrder: activities.map((activity: any) => activity?.title).filter(Boolean),
      }
    };

    return itinerary;
  }

  private computeActivityShuffleSeed(request: OptimizedGenerationRequest): number {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify({
        prompt: request.prompt,
        interests: request.interests,
        duration: request.durationDays,
        budget: request.budget,
        pax: request.pax,
        weather: request.weatherData?.weather?.[0]?.id ?? null,
      }))
      .digest('hex');

    // Convert first 8 hex chars to an integer seed
    return parseInt(hash.slice(0, 8), 16) || Date.now();
  }

  private shuffleActivities<T>(activities: T[], seed: number): T[] {
    if (!activities?.length) {
      return activities ?? [];
    }

    const result = [...activities];

    const random = (() => {
      // Mulberry32 PRNG for deterministic shuffling
      let t = seed >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let v = t;
        v = Math.imul(v ^ (v >>> 15), v | 1);
        v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
        return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
      };
    })();

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  private limitActivitiesToCapacity<T>(activities: T[], durationDays: number | null): T[] {
    if (!activities?.length) {
      return activities ?? [];
    }

    const days = typeof durationDays === 'number' && durationDays > 0 ? durationDays : 1;
    const perSlotCap = days >= 3 ? 1 : 2; // mirrors relaxed pacing logic
    const slotsPerDay = 3; // Morning, Afternoon, Evening
    const baseCapacity = slotsPerDay * perSlotCap * days;

    // Allow a tiny buffer so Gemini can choose alternates if needed, but cap it to avoid prompt bloat.
    const buffer = Math.min(2, Math.max(0, activities.length - baseCapacity));
    const maxItems = Math.min(activities.length, baseCapacity + buffer);

    return activities.slice(0, maxItems);
  }

  private createAllowedActivitiesSnapshot(activities: any[]): any[] {
    const seen = new Set<string>();

    return activities.reduce((acc: any[], activity: any) => {
      const title = typeof activity?.title === 'string' ? activity.title.trim() : '';
      if (!title) {
        return acc;
      }

      const key = title.toLowerCase();
      if (seen.has(key)) {
        return acc;
      }
      seen.add(key);

      const tags = Array.isArray(activity?.tags) ? [...activity.tags] : [];

      acc.push({
        image: activity?.image || '',
        title,
        time: activity?.time || '',
        desc: activity?.desc || '',
        tags,
        peakHours: activity?.peakHours,
        trafficRecommendation: activity?.trafficRecommendation,
        combinedTrafficScore: activity?.combinedTrafficScore,
        crowdLevel: activity?.crowdLevel,
        lat: activity?.lat,
        lon: activity?.lon,
        trafficAnalysis: activity?.trafficAnalysis
          ? {
              recommendation: activity.trafficAnalysis.recommendation ?? activity?.trafficRecommendation,
              realTimeTraffic: activity.trafficAnalysis.realTimeTraffic
                ? { ...activity.trafficAnalysis.realTimeTraffic }
                : undefined
            }
          : undefined
      });

      return acc;
    }, []);
  }

  /**
   * Optimized weather type determination
   */
  private getWeatherTypeOptimized(weatherData: any): WeatherCondition {
    if (!weatherData?.weather?.[0]?.id) return 'default';
    
    const id = weatherData.weather[0].id;
    const temp = weatherData.main?.temp || 20;

    // Fast lookup table for weather types
    if (id >= 200 && id <= 232) return 'thunderstorm';
    if ((id >= 300 && id <= 321) || (id >= 500 && id <= 531)) return 'rainy';
    if (id >= 600 && id <= 622) return 'snow';
    if (id >= 701 && id <= 781) return 'foggy';
    if (id === 800) return 'clear';
    if (id >= 801 && id <= 804) return 'cloudy';
    if (temp < 15) return 'cold';
    return 'default';
  }

  /**
   * Calculate efficiency score based on time and results
   */
  private calculateEfficiencyScore(totalTime: number, activitiesCount: number): number {
    // Baseline: 1 activity per 500ms = 100% efficiency
    const baselineTime = activitiesCount * 500;
    const efficiency = Math.min(100, (baselineTime / totalTime) * 100);
    return Math.round(efficiency);
  }

  /**
   * Get pipeline health metrics
   */
  getHealthMetrics(): {
    status: 'optimal' | 'good' | 'degraded' | 'critical';
    bottlenecks: string[];
    recommendations: string[];
    uptime: number;
  } {
    const cacheHealth = smartCacheManager.getHealthMetrics();
    const processorStats = parallelTrafficProcessor.getPerformanceStats();
    
    let status: 'optimal' | 'good' | 'degraded' | 'critical' = 'good';
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Analyze cache performance
    if (cacheHealth.health === 'excellent') {
      status = 'optimal';
    } else if (cacheHealth.health === 'poor') {
      status = 'degraded';
      bottlenecks.push('Cache performance degraded');
      recommendations.push(...cacheHealth.recommendations);
    }

    // Analyze processor performance
    if (processorStats.activeRequests > 10) {
      bottlenecks.push('High concurrent request load');
      recommendations.push('Consider increasing maxConcurrency');
    }

    return {
      status,
      bottlenecks,
      recommendations,
      uptime: Date.now() // Simplified uptime
    };
  }
}

// Export singleton instance
export const optimizedPipeline = OptimizedPipeline.getInstance();
