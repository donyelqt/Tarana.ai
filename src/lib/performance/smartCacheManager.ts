/**
 * Smart Cache Manager for Ultra-Fast Itinerary Generation
 * Multi-tier caching with intelligent eviction and predictive warming
 * 
 * @author Doniele Arys Antonio
 * @version 3.0.0
 */

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

/**
 * Enterprise-grade smart cache with predictive algorithms
 */
export class SmartCacheManager {
  private static instance: SmartCacheManager;
  
  // Multi-tier cache structure
  private hotCache = new Map<string, CacheEntry<any>>(); // Frequently accessed
  private warmCache = new Map<string, CacheEntry<any>>(); // Moderately accessed
  private coldCache = new Map<string, CacheEntry<any>>(); // Rarely accessed
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
    defaultTTL: 30 * 60 * 1000, // 30 minutes - activities don't change often (Week 1 optimization)
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

  /**
   * Get cached data with intelligent tier promotion
   */
  get<T>(key: string): T | null {
    const startTime = Date.now();
    
    // Check hot cache first (fastest)
    let entry = this.hotCache.get(key);
    let tier = 'hot';
    
    if (!entry) {
      // Check warm cache
      entry = this.warmCache.get(key);
      tier = 'warm';
      
      if (!entry) {
        // Check cold cache
        entry = this.coldCache.get(key);
        tier = 'cold';
      }
    }

    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.evict(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access metrics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    entry.popularity = this.calculatePopularity(entry);

    // Promote to higher tier if popular
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

  /**
   * Set cached data with intelligent tier placement
   */
  set<T>(key: string, data: T, customTTL?: number): void {
    const size = this.estimateSize(data);
    
    // Intelligent TTL detection (Week 1 optimization)
    let effectiveTTL = customTTL || this.config.defaultTTL;
    
    // Traffic data needs short TTL (changes frequently)
    if (key.startsWith('traffic:') || key.includes('location_') || key.includes('_traffic')) {
      effectiveTTL = 3 * 60 * 1000; // 3 minutes for traffic
    }
    // Search/activity data can have longer TTL
    else if (key.startsWith('search_') || key.startsWith('activity_') || key.includes('results')) {
      effectiveTTL = customTTL || 30 * 60 * 1000; // 30 minutes for activities
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

    // Check memory limits before adding
    if (this.getTotalSize() + size > this.config.maxMemoryMB * 1024 * 1024) {
      this.evictLeastPopular();
    }

    // Place in warm cache initially (will be promoted if popular)
    this.warmCache.set(key, entry);
    this.updateStats();

    const ttlMinutes = Math.round(effectiveTTL / 60000);
    console.log(`💾 CACHE SET: ${key.substring(0, 20)}... (${Math.round(size/1024)}KB, TTL: ${ttlMinutes}min) in warm cache`);
  }

  /**
   * Cache search results with deduplication
   */
  cacheSearchResults(query: string, context: any, results: any[]): void {
    const key = this.generateSearchKey(query, context);
    
    // Deduplicate results
    const uniqueResults = this.deduplicateResults(results);
    
    this.set(key, {
      query,
      context,
      results: uniqueResults,
      timestamp: Date.now(),
      resultCount: uniqueResults.length
    });
  }

  /**
   * Get cached search results
   */
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

  /**
   * Cache traffic data with location-based keys
   */
  cacheTrafficData(lat: number, lon: number, data: any): void {
    const key = this.generateLocationKey(lat, lon);
    this.set(key, data, 3 * 60 * 1000); // 3-minute TTL for traffic data
  }

  /**
   * Get cached traffic data
   */
  getCachedTrafficData(lat: number, lon: number): any | null {
    const key = this.generateLocationKey(lat, lon);
    return this.get(key);
  }

  /**
   * Batch cache operations for better performance
   */
  async batchSet<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    const startTime = Date.now();
    
    // Check memory limits for batch
    const totalSize = entries.reduce((sum, entry) => sum + this.estimateSize(entry.data), 0);
    if (this.getTotalSize() + totalSize > this.config.maxMemoryMB * 1024 * 1024) {
      await this.evictForSpace(totalSize);
    }

    // Set all entries
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });

    const batchTime = Date.now() - startTime;
    console.log(`📦 BATCH CACHE: Set ${entries.length} entries in ${batchTime}ms`);
  }

  /**
   * Predictive cache warming for common patterns
   */
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
      
      // Pre-warm with empty results to establish cache structure
      this.set(key, {
        query: pattern.query,
        context: { interests: pattern.interests },
        results: [],
        timestamp: Date.now(),
        resultCount: 0,
        warmed: true
      }, 30 * 60 * 1000); // 30-minute TTL for warmed entries
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

  /**
   * Promote entry to hot cache for faster access
   */
  private promoteToHotCache(key: string, entry: CacheEntry<any>): void {
    // Remove from current tier
    this.warmCache.delete(key);
    this.coldCache.delete(key);
    
    // Add to hot cache
    this.hotCache.set(key, entry);
    
    // Ensure hot cache doesn't exceed limits
    if (this.hotCache.size > 100) {
      const oldestKey = this.findOldestEntry(this.hotCache);
      if (oldestKey) {
        const demoted = this.hotCache.get(oldestKey)!;
        this.hotCache.delete(oldestKey);
        this.warmCache.set(oldestKey, demoted);
      }
    }
  }

  /**
   * Calculate popularity score for cache promotion
   */
  private calculatePopularity(entry: CacheEntry<any>): number {
    const age = Date.now() - entry.timestamp;
    const recency = Math.max(0, 1 - (age / (24 * 60 * 60 * 1000))); // Decay over 24 hours
    return entry.accessCount * recency;
  }

  /**
   * Evict least popular entries to free space
   */
  private async evictForSpace(requiredSpace: number): Promise<void> {
    let freedSpace = 0;
    const allEntries = [
      ...Array.from(this.coldCache.entries()),
      ...Array.from(this.warmCache.entries()),
      ...Array.from(this.hotCache.entries())
    ];

    // Sort by popularity (ascending - least popular first)
    allEntries.sort((a, b) => a[1].popularity - b[1].popularity);

    for (const [key, entry] of allEntries) {
      if (freedSpace >= requiredSpace) break;
      
      this.evict(key);
      freedSpace += entry.size;
    }

    console.log(`🗑️ CACHE EVICTION: Freed ${Math.round(freedSpace/1024)}KB for new entries`);
  }

  /**
   * Evict entry from all cache tiers
   */
  private evict(key: string): void {
    this.hotCache.delete(key);
    this.warmCache.delete(key);
    this.coldCache.delete(key);
  }

  /**
   * Find oldest entry in a cache tier
   */
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

  /**
   * Generate search cache key
   */
  private generateSearchKey(query: string, context: any): string {
    const normalized = {
      query: query.toLowerCase().trim(),
      interests: (context.interests || []).sort(),
      weather: context.weatherCondition || 'clear',
      timeOfDay: context.timeOfDay || 'anytime'
    };
    return createHash('md5').update(JSON.stringify(normalized)).digest('hex');
  }

  /**
   * Generate location-based cache key
   */
  private generateLocationKey(lat: number, lon: number): string {
    // Round to 4 decimal places for location clustering
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLon = Math.round(lon * 10000) / 10000;
    return `traffic:${roundedLat},${roundedLon}`;
  }

  /**
   * Deduplicate search results
   */
  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.activity?.title || result.title || JSON.stringify(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Estimate memory size of data
   */
  private estimateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate
  }

  /**
   * Get total cache size across all tiers
   */
  private getTotalSize(): number {
    let total = 0;
    
    [this.hotCache, this.warmCache, this.coldCache].forEach(cache => {
      for (const entry of cache.values()) {
        total += entry.size;
      }
    });
    
    return total;
  }

  /**
   * Update hit rate statistics
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(responseTime: number): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.averageResponseTime = ((this.stats.averageResponseTime * (total - 1)) + responseTime) / total;
  }

  /**
   * Update general statistics
   */
  private updateStats(): void {
    this.stats.totalEntries = this.hotCache.size + this.warmCache.size + this.coldCache.size;
    this.stats.totalSize = this.getTotalSize();
  }

  /**
   * Evict least popular entries
   */
  private evictLeastPopular(): void {
    // Find least popular entry across all tiers
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

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    this.updateStats();
    
    // Update popular queries
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

  /**
   * Clear all cache tiers
   */
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

  /**
   * Optimize cache performance
   */
  optimize(): void {
    const startTime = Date.now();
    
    // Move popular warm cache entries to hot cache
    const warmEntries = Array.from(this.warmCache.entries());
    warmEntries.forEach(([key, entry]) => {
      if (entry.popularity > this.config.popularityThreshold) {
        this.promoteToHotCache(key, entry);
      }
    });

    // Move unpopular hot cache entries to warm cache
    const hotEntries = Array.from(this.hotCache.entries());
    hotEntries.forEach(([key, entry]) => {
      if (entry.popularity < this.config.popularityThreshold / 2) {
        this.hotCache.delete(key);
        this.warmCache.set(key, entry);
      }
    });

    // Clean expired entries
    this.cleanExpiredEntries();

    const optimizationTime = Date.now() - startTime;
    console.log(`⚡ CACHE OPTIMIZATION: Completed in ${optimizationTime}ms`);
  }

  /**
   * Clean expired entries from all tiers
   */
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

  /**
   * Get cache health metrics
   */
  getHealthMetrics(): {
    health: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
    tierDistribution: { hot: number; warm: number; cold: number };
    memoryUsage: number;
  } {
    const stats = this.getStats();
    let health: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    const recommendations: string[] = [];

    // Determine health based on hit rate and response time
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

    // Memory usage recommendations
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
}

// Export singleton instance
export const smartCacheManager = SmartCacheManager.getInstance();
