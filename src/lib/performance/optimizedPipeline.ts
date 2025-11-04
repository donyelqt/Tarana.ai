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
    const allowedActivitiesSnapshot = this.createAllowedActivitiesSnapshot(enhancedActivities);
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

    enhancedActivities.forEach(activity => {
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

    debugLog(`🚦 TRAFFIC PHASE: Completed in ${trafficTime}ms with ${enhancedActivities.length} enhanced activities`);

    // Phase 3 & 4: Structured AI Generation & Processing (1000-2000ms)
    const aiStartTime = Date.now();

    // Build detailed prompt for structured generation
    const effectiveSampleItinerary = this.buildEffectiveSampleItinerary(
      enhancedActivities,
      request,
      allowedActivitiesSnapshot
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
        activitiesProcessed: enhancedActivities.length,
        throughput: enhancedActivities.length / (totalTime / 1000),
        efficiency: this.calculateEfficiencyScore(totalTime, enhancedActivities.length)
      }
    };

    debugLog(`🎯 OPTIMIZED PIPELINE: Completed in ${totalTime}ms (${Math.round(enhancedActivities.length / (totalTime / 1000))} activities/sec)`);
    debugLog(`📊 PERFORMANCE BREAKDOWN:`, {
      search: `${searchTime}ms`,
      traffic: `${trafficTime}ms`,
      ai: `${aiTime}ms`,
      processing: `${processingTime}ms`,
      efficiency: `${metrics.performance.efficiency}%`
    });

    return { itinerary: finalItinerary, metrics };
  }

  /**
   * Build effective sample itinerary optimized for AI context
   */
  private buildEffectiveSampleItinerary(
    activities: any[],
    request: OptimizedGenerationRequest,
    allowedActivities: any[]
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

    return {
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
        allowedActivities
      }
    };
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
