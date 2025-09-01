/**
 * Intelligent Caching System with Multi-Layer Architecture
 * Provides advanced caching strategies, cache warming, and performance optimization
 * 
 * @author Doniele Arys Antonio
 * @version 2.0.0
 */

import type { IntelligentSearchResult, SearchContext } from "../search/intelligentSearch";
import type { IndexedActivity } from "../search/searchIndex";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  ttl: number;
  tags: string[];
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalEntries: number;
  totalSize: number;
  averageAccessTime: number;
  topQueries: Array<{ query: string; count: number }>;
}

export interface CacheConfig {
  maxSize: number; // Maximum cache size in bytes
  defaultTTL: number; // Default time-to-live in milliseconds
  maxEntries: number; // Maximum number of entries
  compressionThreshold: number; // Compress entries larger than this size
  enableAnalytics: boolean;
  warmupQueries: string[]; // Queries to warm up on startup
}

/**
 * LRU Cache with intelligent eviction policies
 */
class IntelligentLRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private currentSize = 0;
  private accessCounter = 0;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalEntries: 0,
    totalSize: 0,
    averageAccessTime: 0,
    topQueries: []
  };

  constructor(private config: CacheConfig) {}

  set(key: string, value: T, ttl?: number, tags: string[] = []): void {
    const now = Date.now();
    const entryTTL = ttl || this.config.defaultTTL;
    const size = this.calculateSize(value);
    
    // Remove existing entry if it exists
    if (this.cache.has(key)) {
      this.delete(key);
    }
    
    // Check if we need to make space
    this.ensureCapacity(size);
    
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      ttl: entryTTL,
      tags,
      size
    };
    
    this.cache.set(key, entry);
    this.accessOrder.set(key, this.accessCounter++);
    this.currentSize += size;
    this.updateStats();
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    const now = Date.now();
    
    if (!entry) {
      this.stats.misses++;
      this.updateStats();
      return null;
    }
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.delete(key);
      this.stats.misses++;
      this.updateStats();
      return null;
    }
    
    // Update access information
    entry.accessCount++;
    entry.lastAccessed = now;
    this.accessOrder.set(key, this.accessCounter++);
    
    this.stats.hits++;
    this.updateStats();
    
    return entry.data;
  }

  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    this.cache.delete(key);
    this.accessOrder.delete(key);
    this.currentSize -= entry.size;
    this.updateStats();
    
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.currentSize = 0;
    this.accessCounter = 0;
    this.resetStats();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private ensureCapacity(newEntrySize: number): void {
    // Check size limit
    while (this.currentSize + newEntrySize > this.config.maxSize && this.cache.size > 0) {
      this.evictLRU();
    }
    
    // Check entry count limit
    while (this.cache.size >= this.config.maxEntries && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;
    
    // Find least recently used entry with lowest access count
    for (const [key, accessTime] of this.accessOrder.entries()) {
      const entry = this.cache.get(key);
      if (entry && accessTime < oldestAccess) {
        // Prefer entries with lower access count for eviction
        const score = accessTime / Math.max(entry.accessCount, 1);
        if (score < oldestAccess) {
          oldestAccess = score;
          oldestKey = key;
        }
      }
    }
    
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private calculateSize(value: T): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1000; // Default size for non-serializable objects
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size;
    this.stats.totalSize = this.currentSize;
    this.stats.hitRate = this.stats.hits / Math.max(this.stats.hits + this.stats.misses, 1);
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      totalSize: 0,
      averageAccessTime: 0,
      topQueries: []
    };
  }
}

/**
 * Multi-layer intelligent caching system
 */
export class IntelligentCacheManager {
  private searchResultsCache: IntelligentLRUCache<IntelligentSearchResult[]>;
  private activityCache: IntelligentLRUCache<IndexedActivity[]>;
  private embeddingCache: IntelligentLRUCache<number[]>;
  private queryAnalysisCache: IntelligentLRUCache<any>;
  
  private readonly DEFAULT_CONFIG: CacheConfig = {
    maxSize: 50 * 1024 * 1024, // 50MB
    defaultTTL: 30 * 60 * 1000, // 30 minutes
    maxEntries: 1000,
    compressionThreshold: 10 * 1024, // 10KB
    enableAnalytics: true,
    warmupQueries: [
      'beautiful places baguio',
      'food restaurants baguio',
      'nature scenic views',
      'adventure hiking trails',
      'cultural heritage sites',
      'shopping markets baguio'
    ]
  };

  constructor(config: Partial<CacheConfig> = {}) {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    this.searchResultsCache = new IntelligentLRUCache(finalConfig);
    this.activityCache = new IntelligentLRUCache(finalConfig);
    this.embeddingCache = new IntelligentLRUCache({
      ...finalConfig,
      defaultTTL: 60 * 60 * 1000 // 1 hour for embeddings
    });
    this.queryAnalysisCache = new IntelligentLRUCache({
      ...finalConfig,
      defaultTTL: 15 * 60 * 1000 // 15 minutes for query analysis
    });
  }

  /**
   * Cache search results with intelligent key generation
   */
  cacheSearchResults(
    query: string,
    context: SearchContext,
    results: IntelligentSearchResult[],
    ttl?: number
  ): void {
    const cacheKey = this.generateSearchResultsKey(query, context);
    const tags = this.generateTags(query, context);
    
    this.searchResultsCache.set(cacheKey, results, ttl, tags);
  }

  /**
   * Retrieve cached search results
   */
  getCachedSearchResults(query: string, context: SearchContext): IntelligentSearchResult[] | null {
    const cacheKey = this.generateSearchResultsKey(query, context);
    return this.searchResultsCache.get(cacheKey);
  }

  /**
   * Cache activity data
   */
  cacheActivities(key: string, activities: IndexedActivity[], ttl?: number): void {
    this.activityCache.set(key, activities, ttl);
  }

  /**
   * Get cached activities
   */
  getCachedActivities(key: string): IndexedActivity[] | null {
    return this.activityCache.get(key);
  }

  /**
   * Cache embeddings
   */
  cacheEmbedding(text: string, embedding: number[], ttl?: number): void {
    const key = this.hashString(text);
    this.embeddingCache.set(key, embedding, ttl);
  }

  /**
   * Get cached embedding
   */
  getCachedEmbedding(text: string): number[] | null {
    const key = this.hashString(text);
    return this.embeddingCache.get(key);
  }

  /**
   * Cache query analysis results
   */
  cacheQueryAnalysis(query: string, analysis: any, ttl?: number): void {
    const key = `analysis_${this.hashString(query)}`;
    this.queryAnalysisCache.set(key, analysis, ttl);
  }

  /**
   * Get cached query analysis
   */
  getCachedQueryAnalysis(query: string): any | null {
    const key = `analysis_${this.hashString(query)}`;
    return this.queryAnalysisCache.get(key);
  }

  /**
   * Warm up cache with common queries
   */
  async warmupCache(searchFunction: (query: string, context: SearchContext) => Promise<IntelligentSearchResult[]>): Promise<void> {
    console.log('Warming up intelligent cache...');
    
    const defaultContext: SearchContext = {
      interests: ['Nature & Scenery'],
      weatherCondition: 'clear',
      timeOfDay: 'anytime',
      budget: 'mid-range',
      groupSize: 2,
      duration: 2,
      currentTime: new Date()
    };

    const warmupPromises = this.DEFAULT_CONFIG.warmupQueries.map(async (query) => {
      try {
        const results = await searchFunction(query, defaultContext);
        this.cacheSearchResults(query, defaultContext, results);
      } catch (error) {
        console.warn(`Failed to warm up cache for query: ${query}`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('Cache warmup completed');
  }

  /**
   * Invalidate cache entries by tags
   */
  invalidateByTags(tags: string[]): void {
    // This would require extending the cache implementation to support tag-based invalidation
    // For now, we'll clear relevant caches
    if (tags.includes('activities')) {
      this.activityCache.clear();
    }
    if (tags.includes('search')) {
      this.searchResultsCache.clear();
    }
  }

  /**
   * Get comprehensive cache statistics
   */
  getCacheStats(): {
    searchResults: CacheStats;
    activities: CacheStats;
    embeddings: CacheStats;
    queryAnalysis: CacheStats;
    totalMemoryUsage: string;
  } {
    const searchStats = this.searchResultsCache.getStats();
    const activityStats = this.activityCache.getStats();
    const embeddingStats = this.embeddingCache.getStats();
    const queryStats = this.queryAnalysisCache.getStats();
    
    const totalSize = searchStats.totalSize + activityStats.totalSize + 
                     embeddingStats.totalSize + queryStats.totalSize;
    
    return {
      searchResults: searchStats,
      activities: activityStats,
      embeddings: embeddingStats,
      queryAnalysis: queryStats,
      totalMemoryUsage: `${(totalSize / 1024 / 1024).toFixed(2)} MB`
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.searchResultsCache.clear();
    this.activityCache.clear();
    this.embeddingCache.clear();
    this.queryAnalysisCache.clear();
  }

  /**
   * Optimize cache performance
   */
  optimize(): void {
    // This could include:
    // - Compressing large entries
    // - Pre-computing popular queries
    // - Adjusting TTL based on usage patterns
    console.log('Optimizing cache performance...');
    
    // For now, we'll just log the current state
    const stats = this.getCacheStats();
    console.log('Cache optimization completed:', stats);
  }

  private generateSearchResultsKey(query: string, context: SearchContext): string {
    const contextKey = {
      interests: context.interests.sort(),
      weather: context.weatherCondition,
      time: context.timeOfDay,
      budget: context.budget,
      group: context.groupSize,
      duration: context.duration
    };
    
    return `search_${this.hashString(query)}_${this.hashString(JSON.stringify(contextKey))}`;
  }

  private generateTags(query: string, context: SearchContext): string[] {
    const tags = ['search'];
    
    // Add interest-based tags
    tags.push(...context.interests.map((interest: string) => `interest_${interest.toLowerCase().replace(/\s+/g, '_')}`));
    
    // Add context-based tags
    tags.push(`weather_${context.weatherCondition}`);
    tags.push(`time_${context.timeOfDay}`);
    tags.push(`budget_${context.budget}`);
    tags.push(`duration_${context.duration}`);
    
    return tags;
  }

  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const intelligentCacheManager = new IntelligentCacheManager();
