
import { createHash } from "crypto";
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  popularity: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageResponseTime: number;
  popularQueries: Array<{ query: string; count: number; avgTime: number }>;
}

export interface SmartCacheConfig {
  maxMemoryMB: number;
  defaultTTL: number;
  maxEntries: number;
  popularityThreshold: number;
  warmupEnabled: boolean;
}

export class SmartCacheManager {
  private static instance: SmartCacheManager;
  
  private hotCache = new Map<string, CacheEntry<any>>(); 
  private warmCache = new Map<string, CacheEntry<any>>(); 
  private coldCache = new Map<string, CacheEntry<any>>(); 
  private warmupPromise: Promise<void> | null = null;
  private warmupInitialized = false;
  private lastWarmupTimestamp = 0;
  
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    averageResponseTime: 0,
    popularQueries: []
  };

  private readonly config: SmartCacheConfig = {
    maxMemoryMB: 100,
    defaultTTL: 30 * 60 * 1000, 
    maxEntries: 1000,
    popularityThreshold: 5,
    warmupEnabled: true
  };

  private constructor() {
    if (this.config.warmupEnabled) {
      this.ensureWarmup();
    }
  }

  static getInstance(): SmartCacheManager {
    if (!SmartCacheManager.instance) {
      SmartCacheManager.instance = new SmartCacheManager();
    }
    return SmartCacheManager.instance;
  }

  get<T>(key: string): T | null {
    const startTime = Date.now();
    
    let entry = this.hotCache.get(key);
    let tier = 'hot';
    
    if (!entry) {
      entry = this.warmCache.get(key);
      tier = 'warm';
      
      if (!entry) {
        entry = this.coldCache.get(key);
        tier = 'cold';
      }
    }

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.evict(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    entry.accessCount++;
    entry.lastAccessed = Date.now();
    entry.popularity = this.calculatePopularity(entry);

    if (tier !== 'hot' && entry.popularity > this.config.popularityThreshold) {
      this.promoteToHotCache(key, entry);
    }

    this.stats.hits++;
    this.updateHitRate();
    
    const responseTime = Date.now() - startTime;
    this.updateAverageResponseTime(responseTime);

    console.log(`⚡ CACHE HIT: ${key.substring(0, 20)}... from ${tier} cache (${responseTime}ms)`);
    return entry.data;
  }

  set<T>(key: string, data: T, customTTL?: number): void {
    const size = this.estimateSize(data);
    
    let effectiveTTL = customTTL || this.config.defaultTTL;
    
    if (key.startsWith('traffic:') || key.includes('location_') || key.includes('_traffic')) {
      effectiveTTL = 3 * 60 * 1000; 
    }
    else if (key.startsWith('search_') || key.startsWith('activity_') || key.includes('results')) {
      effectiveTTL = customTTL || 30 * 60 * 1000; 
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      ttl: effectiveTTL,
      popularity: 1,
      size
    };

    if (this.getTotalSize() + size > this.config.maxMemoryMB * 1024 * 1024) {
      this.evictLeastPopular();
    }

    this.warmCache.set(key, entry);
    this.updateStats();

    const ttlMinutes = Math.round(effectiveTTL / 60000);
    console.log(`💾 CACHE SET: ${key.substring(0, 20)}... (${Math.round(size/1024)}KB, TTL: ${ttlMinutes}min) in warm cache`);
  }

  cacheSearchResults(query: string, context: any, results: any[]): void {
    const key = this.generateSearchKey(query, context);
    
    const uniqueResults = this.deduplicateResults(results);
    
    this.set(key, {
      query,
      context,
      results: uniqueResults,
      timestamp: Date.now(),
      resultCount: uniqueResults.length
    });
  }

  getCachedSearchResults(query: string, context: any): any[] | null {
    const key = this.generateSearchKey(query, context);
    const cached = this.get<{
      query: string;
      context: any;
      results: any[];
      timestamp: number;
      resultCount: number;
    }>(key);
    
    if (cached && cached.results) {
      console.log(`🎯 SEARCH CACHE HIT: "${query}" (${cached.results.length} results)`);
      return cached.results;
    }
    
    return null;
  }

  cacheTrafficData(lat: number, lon: number, data: any): void {
    const key = this.generateLocationKey(lat, lon);
    this.set(key, data, 3 * 60 * 1000); 
  }

  getCachedTrafficData(lat: number, lon: number): any | null {
    const key = this.generateLocationKey(lat, lon);
    return this.get(key);
  }

  async batchSet<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    const startTime = Date.now();
    
    const totalSize = entries.reduce((sum, entry) => sum + this.estimateSize(entry.data), 0);
    if (this.getTotalSize() + totalSize > this.config.maxMemoryMB * 1024 * 1024) {
      await this.evictForSpace(totalSize);
    }

    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });

    const batchTime = Date.now() - startTime;
    console.log(`📦 BATCH CACHE: Set ${entries.length} entries in ${batchTime}ms`);
  }

  private async initializeWarmup(): Promise<void> {
    this.warmupInitialized = true;
    const commonPatterns = [
      { query: 'nature', interests: ['Nature', 'Adventure'] },
      { query: 'food', interests: ['Food', 'Local Cuisine'] },
      { query: 'culture', interests: ['Culture', 'History'] },
      { query: 'family', interests: ['Family-friendly'] },
      { query: 'romantic', interests: ['Romantic'] },
      { query: 'budget', interests: ['Budget-friendly'] }
    ];

    for (const pattern of commonPatterns) {
      const key = this.generateSearchKey(pattern.query, { interests: pattern.interests });
      
      this.set(key, {
        query: pattern.query,
        context: { interests: pattern.interests },
        results: [],
        timestamp: Date.now(),
        resultCount: 0,
        warmed: true
      }, 30 * 60 * 1000); 
    }

    console.log(`🔥 CACHE WARMUP: Pre-warmed ${commonPatterns.length} common patterns`);
  }

  private ensureWarmup(): void {
    if (this.warmupPromise) {
      return;
    }

    const ttl = this.config.defaultTTL;
    const now = Date.now();
    if (this.warmupInitialized && now - this.lastWarmupTimestamp < ttl) {
      return;
    }

    this.warmupPromise = this.initializeWarmup()
      .finally(() => {
        this.lastWarmupTimestamp = Date.now();
        this.warmupPromise = null;
      });
  }

  private promoteToHotCache(key: string, entry: CacheEntry<any>): void {
    this.warmCache.delete(key);
    this.coldCache.delete(key);
    
    this.hotCache.set(key, entry);
    
    if (this.hotCache.size > 100) {
      const oldestKey = this.findOldestEntry(this.hotCache);
      if (oldestKey) {
        const demoted = this.hotCache.get(oldestKey)!;
        this.hotCache.delete(oldestKey);
        this.warmCache.set(oldestKey, demoted);
      }
    }
  }

  private calculatePopularity(entry: CacheEntry<any>): number {
    const age = Date.now() - entry.timestamp;
    const recency = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); 
    return entry.accessCount * recency;
  }

  private async evictForSpace(requiredSpace: number): Promise<void> {
    let freedSpace = 0;
    const allEntries = [
      ...Array.from(this.coldCache.entries()),
      ...Array.from(this.warmCache.entries()),
      ...Array.from(this.hotCache.entries())
    ];

    allEntries.sort((a, b) => a[1].popularity - b[1].popularity);

    for (const [key, entry] of allEntries) {
      if (freedSpace >= requiredSpace) break;
      
      this.evict(key);
      freedSpace += entry.size;
    }

    console.log(`🗑️ CACHE EVICTION: Freed ${Math.round(freedSpace/1024)}KB for new entries`);
  }

  private evict(key: string): void {
    this.hotCache.delete(key);
    this.warmCache.delete(key);
    this.coldCache.delete(key);
  }

  private findOldestEntry(cache: Map<string, CacheEntry<any>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private generateSearchKey(query: string, context: any): string {
    const normalized = {
      query: query.toLowerCase().trim(),
      interests: (context.interests || []).sort(),
      weather: context.weatherCondition || 'clear',
      timeOfDay: context.timeOfDay || 'anytime'
    };
    return createHash('md5').update(JSON.stringify(normalized)).digest('hex');
  }

  private generateLocationKey(lat: number, lon: number): string {
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLon = Math.round(lon * 10000) / 10000;
    return `traffic:${roundedLat},${roundedLon}`;
  }

  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.activity?.title || result.title || JSON.stringify(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; 
  }

  private getTotalSize(): number {
    let total = 0;
    
    [this.hotCache, this.warmCache, this.coldCache].forEach(cache => {
      for (const entry of cache.values()) {
        total += entry.size;
      }
    });
    
    return total;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.averageResponseTime = ((this.stats.averageResponseTime * (total - 1)) + responseTime) / total;
  }

  private updateStats(): void {
    this.stats.totalEntries = this.hotCache.size + this.warmCache.size + this.coldCache.size;
    this.stats.totalSize = this.getTotalSize();
  }

  private evictLeastPopular(): void {
    let leastPopularKey: string | null = null;
    let leastPopularity = Infinity;
    let targetCache: Map<string, CacheEntry<any>> | null = null;

    const caches: Array<Map<string, CacheEntry<any>>> = [this.coldCache, this.warmCache, this.hotCache];
    caches.forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (entry.popularity < leastPopularity) {
          leastPopularity = entry.popularity;
          leastPopularKey = key;
          targetCache = cache;
        }
      }
    });

    if (leastPopularKey && targetCache) {
      (targetCache as Map<string, CacheEntry<any>>).delete(leastPopularKey);
      console.log(`🗑️ EVICTED: Least popular entry (popularity: ${leastPopularity.toFixed(2)})`);
    }
  }

  getStats(): CacheStats {
    this.updateStats();
    
    const queryStats = new Map<string, { count: number; totalTime: number }>();
    
    [this.hotCache, this.warmCache, this.coldCache].forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (entry.data.query) {
          const existing = queryStats.get(entry.data.query) || { count: 0, totalTime: 0 };
          existing.count += entry.accessCount;
          queryStats.set(entry.data.query, existing);
        }
      }
    });

    this.stats.popularQueries = Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgTime: stats.totalTime / stats.count || 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { ...this.stats };
  }

  clearAll(): void {
    this.hotCache.clear();
    this.warmCache.clear();
    this.coldCache.clear();
    
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      averageResponseTime: 0,
      popularQueries: []
    };

    console.log('🧹 CACHE CLEARED: All tiers reset');
  }

  clearByPrefix(prefix: string): number {
    let cleared = 0;
    for (const cache of [this.hotCache, this.warmCache, this.coldCache] as const) {
      for (const key of Array.from(cache.keys())) {
        if (key.startsWith(prefix)) {
          cache.delete(key as string);
          cleared++;
        }
      }
    }
    if (cleared > 0) {
      this.stats.totalEntries = this.hotCache.size + this.warmCache.size + this.coldCache.size;
    }
    return cleared;
  }

  clearForUser(userId: string): number {
    return this.clearByPrefix(`optimized:${userId}:`) + this.clearByPrefix(`${userId}:`);
  }

  optimize(): void {
    const startTime = Date.now();
    
    const warmEntries = Array.from(this.warmCache.entries());
    warmEntries.forEach(([key, entry]) => {
      if (entry.popularity > this.config.popularityThreshold) {
        this.promoteToHotCache(key, entry);
      }
    });

    const hotEntries = Array.from(this.hotCache.entries());
    hotEntries.forEach(([key, entry]) => {
      if (entry.popularity < this.config.popularityThreshold / 2) {
        this.hotCache.delete(key);
        this.warmCache.set(key, entry);
      }
    });

    this.cleanExpiredEntries();

    const optimizationTime = Date.now() - startTime;
    console.log(`⚡ CACHE OPTIMIZATION: Completed in ${optimizationTime}ms`);
  }

  private cleanExpiredEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    [this.hotCache, this.warmCache, this.coldCache].forEach(cache => {
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > entry.ttl) {
          cache.delete(key);
          cleaned++;
        }
      }
    });

    if (cleaned > 0) {
      console.log(`🧹 CACHE CLEANUP: Removed ${cleaned} expired entries`);
    }
  }

  getHealthMetrics(): {
    health: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
    tierDistribution: { hot: number; warm: number; cold: number };
    memoryUsage: number;
  } {
    const stats = this.getStats();
    let health: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    const recommendations: string[] = [];

    if (stats.hitRate > 0.8 && stats.averageResponseTime < 10) {
      health = 'excellent';
    } else if (stats.hitRate > 0.6 && stats.averageResponseTime < 50) {
      health = 'good';
    } else if (stats.hitRate > 0.3) {
      health = 'fair';
      recommendations.push('Consider cache warming or optimization');
    } else {
      health = 'poor';
      recommendations.push('Cache hit rate too low - review caching strategy');
    }

    const memoryUsagePercent = (stats.totalSize / (this.config.maxMemoryMB * 1024 * 1024)) * 100;
    if (memoryUsagePercent > 80) {
      recommendations.push('High memory usage - consider increasing cache size or TTL optimization');
    }

    return {
      health,
      recommendations,
      tierDistribution: {
        hot: this.hotCache.size,
        warm: this.warmCache.size,
        cold: this.coldCache.size
      },
      memoryUsage: memoryUsagePercent
    };
  }
  getCacheStats(): any {
    const stats = this.getStats();
    return {
      ...stats,
      searchResults: { totalEntries: stats.totalEntries, totalSize: stats.totalSize },
      totalMemoryUsage: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
    };
  }

  cacheEmbedding(key: string, embedding: number[]): void {
    this.set(`emb:${key}`, embedding, 60 * 60 * 1000);
  }

  getCachedEmbedding(key: string): number[] | null {
    return this.get<number[]>(`emb:${key}`);
  }

  warmupCache(..._args: any[]): Promise<void> {
    return (this as any).ensureWarmup?.(..._args) ?? Promise.resolve();
  }
}

export const smartCacheManager = SmartCacheManager.getInstance();

if (!(smartCacheManager as any).getCacheStats) {
  (smartCacheManager as any).getCacheStats = () => (smartCacheManager as any).getStats();
}
if (!(smartCacheManager as any).warmupCache) {
  (smartCacheManager as any).warmupCache = (...args: any[]) => (smartCacheManager as any).ensureWarmup?.(...args) ?? Promise.resolve();
}
