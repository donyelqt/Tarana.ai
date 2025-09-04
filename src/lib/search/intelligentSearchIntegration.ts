/**
 * Intelligent Search Integration Layer
 * Orchestrates all intelligent search components and provides unified API
 * 
 * @author Doniele Arys Antonio
 * @version 2.0.0
 */

import { intelligentSearchEngine, type SearchContext, type IntelligentSearchResult } from './intelligentSearch';
import { searchOptimizer, queryProcessor } from './searchOptimizer';
import { searchIndexManager } from './searchIndex';
import { intelligentCacheManager } from '../ai/intelligentCache';
import { sampleItineraryCombined } from '@/app/itinerary-generator/data/itineraryData';
import { getManilaTime } from '../traffic/peakHours';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

export interface IntelligentSearchConfig {
  enableCaching: boolean;
  enableIndexing: boolean;
  enableOptimization: boolean;
  maxResults: number;
  cacheWarmup: boolean;
  performanceMode: 'fast' | 'balanced' | 'comprehensive';
}

export interface SearchPerformanceMetrics {
  searchTime: number;
  cacheHitRate: number;
  indexUtilization: number;
  resultsCount: number;
  confidenceScore: number;
  optimizationApplied: boolean;
}

export interface EnhancedSearchResult extends IntelligentSearchResult {
  performanceMetrics: SearchPerformanceMetrics;
  searchMethod: 'intelligent' | 'semantic' | 'fallback';
  optimizationDetails: {
    queryExpansion: string[];
    intentDetected: string;
    contextualBoosts: string[];
    filterRecommendations: string[];
  };
}

/**
 * Main Intelligent Search Orchestrator
 */
export class IntelligentSearchOrchestrator {
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  
  private readonly defaultConfig: IntelligentSearchConfig = {
    enableCaching: true,
    enableIndexing: true,
    enableOptimization: true,
    maxResults: 50,
    cacheWarmup: true,
    performanceMode: 'balanced'
  };

  constructor(private config: Partial<IntelligentSearchConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Initialize the intelligent search system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._performInitialization();
    await this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    console.log('🚀 Initializing Intelligent Search System...');
    const startTime = Date.now();

    try {
      // Step 1: Build search index if enabled
      if (this.config.enableIndexing) {
        console.log('📊 Building search index...');
        const activities = sampleItineraryCombined.items[0].activities;
        await searchIndexManager.buildIndex(activities);
        console.log('✅ Search index built successfully');
      }

      // Step 2: Warm up cache if enabled
      if (this.config.enableCaching && this.config.cacheWarmup) {
        console.log('🔥 Warming up cache...');
        await intelligentCacheManager.warmupCache(this.performSearch.bind(this));
        console.log('✅ Cache warmed up successfully');
      }

      // Step 3: Optimize cache performance
      if (this.config.enableCaching) {
        intelligentCacheManager.optimize();
      }

      this.isInitialized = true;
      const initTime = Date.now() - startTime;
      console.log(`🎉 Intelligent Search System initialized in ${initTime}ms`);

    } catch (error) {
      console.error('❌ Failed to initialize Intelligent Search System:', error);
      // Continue with degraded functionality
      this.isInitialized = true;
    }
  }

  /**
   * Perform intelligent search with full orchestration
   */
  async search(
    query: string,
    interests: string[] = [],
    weatherCondition: string = 'clear',
    budget: string = 'mid-range',
    groupSize: number = 2,
    duration: number = 2,
    additionalContext: Record<string, any> = {}
  ): Promise<EnhancedSearchResult[]> {
    await this.initialize();

    const startTime = Date.now();
    let searchMethod: 'intelligent' | 'semantic' | 'fallback' = 'intelligent';
    let cacheHit = false;

    try {
      // Build search context
      const searchContext: SearchContext = {
        interests,
        weatherCondition,
        timeOfDay: this.determineTimeOfDay(),
        budget: this.normalizeBudget(budget),
        groupSize,
        duration,
        currentTime: getManilaTime(),
        userPreferences: additionalContext
      };

      // Check cache first if enabled
      let results: IntelligentSearchResult[] = [];
      if (this.config.enableCaching) {
        const cachedResults = intelligentCacheManager.getCachedSearchResults(query, searchContext);
        if (cachedResults) {
          results = cachedResults;
          cacheHit = true;
        }
      }

      // Perform search if not cached
      if (results.length === 0) {
        const activities = this.getActivities();
        
        // Generate search optimization if enabled
        let optimization;
        if (this.config.enableOptimization) {
          optimization = searchOptimizer.generateSearchOptimization(query, searchContext);
        }

        // Perform intelligent search
        results = await intelligentSearchEngine.search(query, searchContext, activities);
        
        // Apply optimization if enabled and results found
        if (this.config.enableOptimization && optimization && results.length > 0) {
          results = searchOptimizer.optimizeSearchResults(results, optimization, searchContext);
        }

        // Cache results if enabled
        if (this.config.enableCaching && results.length > 0) {
          intelligentCacheManager.cacheSearchResults(query, searchContext, results);
        }

        // Fallback if no results
        if (results.length === 0) {
          results = await this.performFallbackSearch(query, activities);
          searchMethod = 'fallback';
        }
      }

      // Limit results based on configuration
      const limitedResults = results.slice(0, this.config.maxResults || 50);

      // Calculate performance metrics
      const searchTime = Date.now() - startTime;
      const cacheStats = this.config.enableCaching ? intelligentCacheManager.getCacheStats() : null;
      const indexStats = this.config.enableIndexing ? searchIndexManager.getIndexStats() : null;

      // Convert to enhanced results
      const enhancedResults: EnhancedSearchResult[] = limitedResults.map((result, index) => {
        const performanceMetrics: SearchPerformanceMetrics = {
          searchTime: index === 0 ? searchTime : 0, // Only report for first result
          cacheHitRate: cacheStats?.searchResults.hitRate || 0,
          indexUtilization: indexStats ? 1.0 : 0,
          resultsCount: limitedResults.length,
          confidenceScore: result.confidence,
          optimizationApplied: this.config.enableOptimization || false
        };

        const optimizationDetails = this.config.enableOptimization ? 
          this.extractOptimizationDetails(query, searchContext) : 
          { queryExpansion: [], intentDetected: 'unknown', contextualBoosts: [], filterRecommendations: [] };

        return {
          ...result,
          performanceMetrics,
          searchMethod,
          optimizationDetails
        };
      });

      return enhancedResults;

    } catch (error) {
      console.error('Intelligent search failed:', error);
      
      // Ultimate fallback
      const activities = this.getActivities();
      const fallbackResults = await this.performFallbackSearch(query, activities);
      
      return fallbackResults.map(result => ({
        ...result,
        performanceMetrics: {
          searchTime: Date.now() - startTime,
          cacheHitRate: 0,
          indexUtilization: 0,
          resultsCount: fallbackResults.length,
          confidenceScore: 0.3,
          optimizationApplied: false
        },
        searchMethod: 'fallback' as const,
        optimizationDetails: {
          queryExpansion: [],
          intentDetected: 'error',
          contextualBoosts: [],
          filterRecommendations: []
        }
      }));
    }
  }

  /**
   * Get system performance statistics
   */
  getPerformanceStats(): {
    cacheStats: any;
    indexStats: any;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
    recommendations: string[];
  } {
    const cacheStats = this.config.enableCaching ? intelligentCacheManager.getCacheStats() : null;
    const indexStats = this.config.enableIndexing ? searchIndexManager.getIndexStats() : null;
    
    // Determine system health
    let systemHealth: 'excellent' | 'good' | 'fair' | 'poor' = 'good';
    const recommendations: string[] = [];

    if (cacheStats) {
      if (cacheStats.searchResults.hitRate > 0.8) {
        systemHealth = 'excellent';
      } else if (cacheStats.searchResults.hitRate < 0.3) {
        systemHealth = 'fair';
        recommendations.push('Consider cache warmup or longer TTL');
      }
    }

    if (indexStats && indexStats.totalActivities === 0) {
      systemHealth = 'poor';
      recommendations.push('Search index needs to be rebuilt');
    }

    if (!this.isInitialized) {
      systemHealth = 'poor';
      recommendations.push('System not properly initialized');
    }

    return {
      cacheStats,
      indexStats,
      systemHealth,
      recommendations
    };
  }

  /**
   * Clear all caches and rebuild index
   */
  async reset(): Promise<void> {
    console.log('🔄 Resetting Intelligent Search System...');
    
    if (this.config.enableCaching) {
      intelligentCacheManager.clearAll();
    }
    
    this.isInitialized = false;
    this.initializationPromise = null;
    
    await this.initialize();
    console.log('✅ System reset completed');
  }

  private getActivities(): Activity[] {
    if (this.config.enableIndexing) {
      const indexedActivities = searchIndexManager.getAllActivities();
      if (indexedActivities.length > 0) {
        return indexedActivities;
      }
    }
    
    return sampleItineraryCombined.items[0].activities;
  }

  private async performFallbackSearch(query: string, activities: Activity[]): Promise<IntelligentSearchResult[]> {
    const queryLower = query.toLowerCase();
    
    const matches = activities
      .filter(activity => 
        activity.title.toLowerCase().includes(queryLower) ||
        activity.desc.toLowerCase().includes(queryLower) ||
        (activity.tags || []).some(tag => tag.toLowerCase().includes(queryLower))
      )
      .slice(0, 20)
      .map(activity => ({
        activity,
        scores: {
          semantic: 0,
          vector: 0,
          fuzzy: 0.5,
          contextual: 0.3,
          temporal: 0.5,
          diversity: 1,
          composite: 0.46
        },
        reasoning: ['Fallback text matching'],
        confidence: 0.4,
        metadata: {
          searchQuery: query,
          matchedTerms: ['title', 'description', 'tags'],
          contextFactors: [],
          temporalFactors: []
        }
      }));

    return matches;
  }

  private determineTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const manilaTime = getManilaTime();
    const hour = manilaTime.getHours();
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 || hour < 6) return 'evening';
    return 'anytime';
  }

  private normalizeBudget(budget: string): 'budget' | 'mid-range' | 'luxury' {
    const budgetLower = budget.toLowerCase();
    if (budgetLower.includes('budget') || budgetLower.includes('cheap') || budgetLower.includes('3000')) {
      return 'budget';
    }
    if (budgetLower.includes('luxury') || budgetLower.includes('premium') || budgetLower.includes('10000')) {
      return 'luxury';
    }
    return 'mid-range';
  }

  private extractOptimizationDetails(query: string, context: SearchContext) {
    const intent = queryProcessor.analyzeIntent(query);
    const expansion = queryProcessor.expandQuery(query, intent);
    
    return {
      queryExpansion: expansion.expanded.slice(0, 5),
      intentDetected: intent.primary,
      contextualBoosts: context.interests,
      filterRecommendations: [`Filter by ${context.weatherCondition} weather`, `Optimize for ${context.timeOfDay}`]
    };
  }

  private async performSearch(query: string, context: SearchContext): Promise<IntelligentSearchResult[]> {
    const activities = this.getActivities();
    return intelligentSearchEngine.search(query, context, activities);
  }
}

// Export singleton instance
export const intelligentSearchOrchestrator = new IntelligentSearchOrchestrator();

/**
 * Simplified API for easy integration
 */
export async function performIntelligentSearch(
  query: string,
  options: {
    interests?: string[];
    weather?: string;
    budget?: string;
    groupSize?: number;
    duration?: number;
    maxResults?: number;
  } = {}
): Promise<EnhancedSearchResult[]> {
  return intelligentSearchOrchestrator.search(
    query,
    options.interests || [],
    options.weather || 'clear',
    options.budget || 'mid-range',
    options.groupSize || 2,
    options.duration || 2
  );
}

/**
 * Get system health and performance metrics
 */
export function getSearchSystemHealth() {
  return intelligentSearchOrchestrator.getPerformanceStats();
}

/**
 * Initialize the search system (call this on app startup)
 */
export async function initializeIntelligentSearch() {
  await intelligentSearchOrchestrator.initialize();
}

/**
 * Reset and rebuild the search system
 */
export async function resetIntelligentSearch() {
  await intelligentSearchOrchestrator.reset();
}
