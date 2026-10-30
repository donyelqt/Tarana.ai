
import { agenticTrafficAnalyzer, TrafficAnalysisResult } from "@/lib/traffic";
import { getActivityCoordinates } from "@/lib/data";
import { smartCacheManager } from "./smartCacheManager";
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";
import { sampleItineraryCombined } from "@/app/itinerary-generator/data/itineraryData";

export interface TrafficProcessingOptions {
  maxConcurrency: number;
  batchSize: number;
  proximityThreshold: number; 
  enableLocationClustering: boolean;
  enableResultCaching: boolean;
  timeoutMs: number;
}

export interface TrafficProcessingMetrics {
  totalActivities: number;
  processedActivities: number;
  apiCallsReduced: number;
  processingTime: number;
  cacheHits: number;
  clustersCreated: number;
}

export class ParallelTrafficProcessor {
  private static instance: ParallelTrafficProcessor;
  
  private readonly defaultOptions: TrafficProcessingOptions = {
    maxConcurrency: 16,
    batchSize: 10,
    proximityThreshold: 1.5, 
    enableLocationClustering: true,
    enableResultCaching: true,
    timeoutMs: 15000 
  };

  private activeSemaphore: Semaphore;
  private locationCache = new Map<string, { lat: number; lon: number }>();

  constructor(private options: Partial<TrafficProcessingOptions> = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.activeSemaphore = new Semaphore(this.options.maxConcurrency!);
    this.preloadCoordinates();
  }

  static getInstance(options?: TrafficProcessingOptions): ParallelTrafficProcessor {
    if (!ParallelTrafficProcessor.instance) {
      ParallelTrafficProcessor.instance = new ParallelTrafficProcessor(options);
    }
    return ParallelTrafficProcessor.instance;
  }

  async processActivitiesUltraFast(activities: Activity[]): Promise<{
    enhancedActivities: Activity[];
    metrics: TrafficProcessingMetrics;
  }> {
    const startTime = Date.now();
    console.log(`🚀 PARALLEL TRAFFIC: Starting ultra-fast processing of ${activities.length} activities`);

    if (!activities.length) {
      return {
        enhancedActivities: [],
        metrics: this.createEmptyMetrics()
      };
    }

    let cacheHits = 0;
    let apiCallsReduced = 0;
    let clustersCreated = 0;

    const { cached, uncached } = await this.separateCachedActivities(activities);
    cacheHits = cached.length;
    
    if (cached.length > 0) {
      console.log(`⚡ CACHE ACCELERATION: ${cached.length}/${activities.length} activities from cache`);
    }

    let clusters: Activity[][] = [];
    if (this.options.enableLocationClustering && uncached.length > 0) {
      clusters = this.createLocationClusters(uncached);
      clustersCreated = clusters.length;
      apiCallsReduced = uncached.length - clusters.length;
      console.log(`📍 CLUSTERING: Reduced ${uncached.length} activities to ${clusters.length} clusters (${apiCallsReduced} API calls saved)`);
    } else {
      clusters = uncached.map(activity => [activity]);
    }

    const enhancedClusters = await this.processClustersConcurrently(clusters);
    
    const allEnhanced = [...cached, ...enhancedClusters.flat()];
    
    await this.waitForTrafficDataCompletion();
    
    const filteredActivities = this.applyStrictTrafficFiltering(allEnhanced);
    
    const totalTime = Date.now() - startTime;
    const metrics: TrafficProcessingMetrics = {
      totalActivities: activities.length,
      processedActivities: filteredActivities.length,
      apiCallsReduced,
      processingTime: totalTime,
      cacheHits,
      clustersCreated
    };

    console.log(`🎯 PARALLEL TRAFFIC: Completed in ${totalTime}ms with ${Math.round(apiCallsReduced/activities.length*100)}% API reduction`);
    console.log(`🚦 TRAFFIC FILTERING: ${allEnhanced.length} → ${filteredActivities.length} activities after strict filtering`);

    return { enhancedActivities: filteredActivities, metrics };
  }

  private async separateCachedActivities(activities: Activity[]): Promise<{
    cached: Activity[];
    uncached: Activity[];
  }> {
    const cached: Activity[] = [];
    const uncached: Activity[] = [];

    for (const activity of activities) {
      const coords = this.getCoordinatesCached(activity.title);
      if (!coords) {
        uncached.push(activity);
        continue;
      }

      if (this.options.enableResultCaching) {
        const cachedTraffic = smartCacheManager.getCachedTrafficData(coords.lat, coords.lon);
        if (cachedTraffic) {
          cached.push({
            ...activity,
            trafficAnalysis: cachedTraffic,
            combinedTrafficScore: cachedTraffic.combinedScore || 70,
            trafficRecommendation: cachedTraffic.recommendation || 'VISIT_SOON',
            crowdLevel: cachedTraffic.crowdLevel || 'MODERATE',
            lat: coords.lat,
            lon: coords.lon
          } as any);
          continue;
        }
      }

      uncached.push(activity);
    }

    return { cached, uncached };
  }

  private createLocationClusters(activities: Activity[]): Activity[][] {
    const clusters: Activity[][] = [];
    const processed = new Set<string>();

    for (const activity of activities) {
      if (processed.has(activity.title)) continue;

      const cluster = [activity];
      processed.add(activity.title);

      const coords = this.getCoordinatesCached(activity.title);
      if (!coords) {
        console.warn(`⚠️ CLUSTERING: No coordinates cached for "${activity.title}". Using standalone fallback.`);
        clusters.push(cluster);
        continue;
      }

      for (const other of activities) {
        if (processed.has(other.title)) continue;

        const otherCoords = this.getCoordinatesCached(other.title);
        if (!otherCoords) continue;

        const distance = this.calculateDistance(coords.lat, coords.lon, otherCoords.lat, otherCoords.lon);
        if (distance <= this.options.proximityThreshold!) {
          cluster.push(other);
          processed.add(other.title);
        }
      }

      clusters.push(cluster);
    }

    return clusters;
  }

  private async processClustersConcurrently(clusters: Activity[][]): Promise<Activity[][]> {
    if (!clusters.length) {
      return [];
    }

    const results: Activity[][] = new Array(clusters.length);

    const settledResults = await Promise.allSettled(
      clusters.map((cluster, index) =>
        this.activeSemaphore.acquire(() => this.processClusterWithTimeout(cluster, index))
      )
    );

    settledResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results[index] = result.value;
      } else {
        console.warn(`⚠️ Cluster ${index} processing failed:`, result.reason);
        results[index] = this.createFallbackCluster(clusters[index]);
      }
    });

    return results;
  }

  private async processClusterWithTimeout(cluster: Activity[], clusterIndex: number): Promise<Activity[]> {
    const timeoutPromise = new Promise<Activity[]>((_, reject) => {
      setTimeout(() => reject(new Error('Cluster processing timeout')), this.options.timeoutMs);
    });

    const processingPromise = this.processCluster(cluster, clusterIndex);

    try {
      return await Promise.race([processingPromise, timeoutPromise]);
    } catch (error) {
      console.warn(`⚠️ Cluster ${clusterIndex} timed out, using fallback`);
      return this.createFallbackCluster(cluster);
    }
  }

  private async processCluster(cluster: Activity[], clusterIndex: number): Promise<Activity[]> {
    if (!cluster.length) return [];

    const representative = cluster[0];
    const coords = this.getCoordinatesCached(representative.title);
    
    if (!coords) {
      return this.createFallbackCluster(cluster);
    }

    try {
      console.log(`🔄 Processing cluster ${clusterIndex + 1}: ${cluster.length} activities near ${representative.title}`);
      
      const trafficAnalysis = await agenticTrafficAnalyzer.analyzeActivityTraffic(
        representative.title,
        representative.title,
        coords.lat,
        coords.lon,
        representative.peakHours || '',
        {
          currentTime: new Date(),
          dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          isWeekend: [0, 6].includes(new Date().getDay()),
          userPreferences: {
            avoidCrowds: true,
            flexibleTiming: true,
            prioritizeTraffic: true
          }
        }
      );

      const enhancedCluster = cluster.map(activity => {
        const activityCoords = this.getCoordinatesCached(activity.title) || coords;
        
        const enhanced = {
          ...activity,
          trafficAnalysis,
          combinedTrafficScore: trafficAnalysis.combinedScore,
          trafficRecommendation: trafficAnalysis.recommendation,
          crowdLevel: trafficAnalysis.crowdLevel,
          lat: activityCoords.lat,
          lon: activityCoords.lon
        };

        if (this.options.enableResultCaching) {
          smartCacheManager.cacheTrafficData(activityCoords.lat, activityCoords.lon, trafficAnalysis);
        }

        return enhanced;
      });

      console.log(`✅ Cluster ${clusterIndex + 1}: Enhanced ${enhancedCluster.length} activities with traffic level ${trafficAnalysis.realTimeTraffic?.trafficLevel || 'UNKNOWN'}`);
      
      return enhancedCluster;

    } catch (error) {
      console.error(`❌ Cluster ${clusterIndex + 1} processing failed:`, error);
      return this.createFallbackCluster(cluster);
    }
  }

  private createFallbackCluster(cluster: Activity[]): Activity[] {
    console.log(`⚠️ FALLBACK CLUSTER: Using safe moderate traffic data for ${cluster.length} activities`);
    return cluster.map(activity => {
      const coords = this.getCoordinatesCached(activity.title);
      const fallbackTraffic = {
        realTimeTraffic: {
          lat: coords?.lat ?? 0,
          lon: coords?.lon ?? 0,
          incidents: [],
          trafficLevel: 'MODERATE' as const,
          congestionScore: 55,
          recommendationScore: 60,
          lastUpdated: new Date()
        }
      };

      return {
        ...activity,
        trafficAnalysis: fallbackTraffic,
        combinedTrafficScore: 58,
        trafficRecommendation: 'PLAN_LATER' as any,
        crowdLevel: 'MODERATE' as any,
        lat: coords?.lat ?? 0,
        lon: coords?.lon ?? 0
      };
    });
  }

  private async waitForTrafficDataCompletion(): Promise<void> {
    return;
  }

  private preloadCoordinates(): void {
    const activities = sampleItineraryCombined.items[0].activities;
    let loaded = 0;

    activities.forEach(activity => {
      const coords = getActivityCoordinates(activity.title);
      if (coords) {
        this.locationCache.set(activity.title, coords);
        loaded++;
      }
    });

    console.log(`📍 COORDINATES PRELOAD: Cached ${loaded}/${activities.length} activity coordinates`);
  }

  private getCoordinatesCached(title: string): { lat: number; lon: number } | null {
    return this.locationCache.get(title) || null;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private createEmptyMetrics(): TrafficProcessingMetrics {
    return {
      totalActivities: 0,
      processedActivities: 0,
      apiCallsReduced: 0,
      processingTime: 0,
      cacheHits: 0,
      clustersCreated: 0
    };
  }

  private applyStrictTrafficFiltering(activities: any[]): any[] {
    console.log(`\n🚦 STRICT TRAFFIC FILTERING: Starting with ${activities.length} activities`);
    
    const filtered = activities.filter(activity => {
      const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
      const crowdLevel = activity.crowdLevel;
      const recommendation = activity.trafficRecommendation;
      
      if (trafficLevel && !['VERY_LOW', 'LOW', 'MODERATE'].includes(trafficLevel)) {
        console.log(`🚫 EXCLUDING HIGH TRAFFIC: "${activity.title}" - Traffic Level: ${trafficLevel} (FORBIDDEN)`);
        return false;
      }
      
      if (!trafficLevel || trafficLevel === 'UNKNOWN') {
        console.log(`🚫 EXCLUDING UNKNOWN TRAFFIC: "${activity.title}" - Traffic Level: ${trafficLevel || 'UNKNOWN'} (CONSERVATIVE EXCLUSION)`);
        return false;
      }
      
      if (crowdLevel === 'HIGH' || crowdLevel === 'VERY_HIGH') {
        console.log(`🚫 EXCLUDING HIGH CROWDS: "${activity.title}" - Crowd Level: ${crowdLevel}`);
        return false;
      }
      
      if (recommendation === 'AVOID_NOW') {
        console.log(`🚫 EXCLUDING AVOID_NOW: "${activity.title}" - Recommendation: ${recommendation}`);
        return false;
      }
      
      const tags = [...(activity.tags || [])];
      if (trafficLevel === 'VERY_LOW' || trafficLevel === 'LOW') {
        if (!tags.includes('low-traffic')) {
          tags.push('low-traffic');
        }
      } else if (trafficLevel === 'MODERATE') {
        if (!tags.includes('moderate-traffic')) {
          tags.push('moderate-traffic');
        }
      }
      
      activity.tags = tags;
      
      console.log(`✅ TRAFFIC APPROVED: "${activity.title}" - Traffic: ${trafficLevel}, Crowd: ${crowdLevel || 'UNKNOWN'}, Recommendation: ${recommendation || 'UNKNOWN'}`);
      return true;
    });
    
    console.log(`🚫 EXCLUDED ACTIVITIES: ${activities.length - filtered.length}`);
    activities.forEach(activity => {
      const trafficLevel = activity.trafficAnalysis?.realTimeTraffic?.trafficLevel;
      const isExcluded = !filtered.find(f => f.title === activity.title);
      if (isExcluded) {
        console.log(`   - ${activity.title}: ${trafficLevel || 'UNKNOWN'} traffic`);
      }
    });
    
    console.log(`🎯 STRICT FILTERING COMPLETE: ${filtered.length}/${activities.length} activities passed`);
    console.log(`===============================================\n`);
    
    return filtered;
  }

  getPerformanceStats(): {
    activeRequests: number;
    cacheSize: number;
    coordinatesCacheSize: number;
    averageClusterSize: number;
  } {
    return {
      activeRequests: this.activeSemaphore.getActiveCount(),
      cacheSize: smartCacheManager.getStats().totalEntries,
      coordinatesCacheSize: this.locationCache.size,
      averageClusterSize: 0 
    };
  }
}

class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];
  private activeCount = 0;

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        this.activeCount++;
        this.executeTask(task, resolve, reject);
      } else {
        this.queue.push(() => {
          this.permits--;
          this.activeCount++;
          this.executeTask(task, resolve, reject);
        });
      }
    });
  }

  private async executeTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason: any) => void
  ): Promise<void> {
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.permits++;
      this.activeCount--;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next();
      }
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }
}

export const parallelTrafficProcessor = ParallelTrafficProcessor.getInstance();
