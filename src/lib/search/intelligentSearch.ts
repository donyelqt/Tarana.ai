/**
 * Intelligent Search Engine for Itinerary Generation
 * Combines semantic search, fuzzy matching, NLP analysis, and ML-based scoring
 * 
 * @author Doniele Arys Antonioo
 * @version 2.0.0
 */

import { generateEmbedding } from '../ai/embeddings';
import { supabaseAdmin } from '../data/supabaseAdmin';
import { isCurrentlyPeakHours, getManilaTime } from '../traffic/peakHours';
import { tomtomTrafficService } from '../traffic/tomtomTraffic';
import { getActivityCoordinates } from '../data/baguioCoordinates';
import type { Activity } from '../../app/itinerary-generator/data/itineraryData';
import { sampleItineraryCombined } from '../../app/itinerary-generator/data/itineraryData';

// Advanced search configuration
export interface IntelligentSearchConfig {
  semanticWeight: number;
  vectorWeight: number;
  fuzzyWeight: number;
  contextWeight: number;
  temporalWeight: number;
  diversityWeight: number;
  enableFuzzyMatching: boolean;
  enableContextualAnalysis: boolean;
  enableTemporalOptimization: boolean;
  enableDiversityBoost: boolean;
  maxResults: number;
  minSimilarityThreshold: number;
}

export const DEFAULT_SEARCH_CONFIG: IntelligentSearchConfig = {
  semanticWeight: 0.25,
  vectorWeight: 0.25,
  fuzzyWeight: 0.15,
  contextWeight: 0.15,
  temporalWeight: 0.15,
  diversityWeight: 0.05,
  enableFuzzyMatching: true,
  enableContextualAnalysis: true,
  enableTemporalOptimization: true,
  enableDiversityBoost: true,
  maxResults: 50,
  minSimilarityThreshold: 0.1
};

export interface SearchContext {
  interests: string[];
  weatherCondition: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'anytime';
  budget: 'budget' | 'mid-range' | 'luxury';
  groupSize: number;
  duration: number;
  currentTime: Date;
  userPreferences?: Record<string, any>;
}

export interface IntelligentSearchResult {
  activity: Activity;
  scores: {
    semantic: number;
    vector: number;
    fuzzy: number;
    contextual: number;
    temporal: number;
    diversity: number;
    composite: number;
  };
  reasoning: string[];
  confidence: number;
  metadata: {
    searchQuery: string;
    matchedTerms: string[];
    contextFactors: string[];
    temporalFactors: string[];
  };
}

/**
 * Advanced fuzzy string matching with multiple algorithms
 */
class FuzzyMatcher {
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // insertion
          matrix[j - 1][i] + 1, // deletion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[b.length][a.length];
  }

  private static jaroWinklerSimilarity(s1: string, s2: string): number {
    const jaro = this.jaroSimilarity(s1, s2);
    if (jaro < 0.7) return jaro;
    
    let prefix = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length, 4); i++) {
      if (s1[i] === s2[i]) prefix++;
      else break;
    }
    
    return jaro + (0.1 * prefix * (1 - jaro));
  }

  private static jaroSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    const maxDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    const match1 = new Array(len1).fill(false);
    const match2 = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - maxDistance);
      const end = Math.min(i + maxDistance + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (match2[j] || s1[i] !== s2[j]) continue;
        match1[i] = match2[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!match1[i]) continue;
      while (!match2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
    
    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  }

  static calculateFuzzyScore(query: string, target: string): number {
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedTarget = target.toLowerCase().trim();
    
    // Exact match
    if (normalizedQuery === normalizedTarget) return 1.0;
    
    // Contains match
    if (normalizedTarget.includes(normalizedQuery)) {
      return 0.9 - (normalizedTarget.length - normalizedQuery.length) / normalizedTarget.length * 0.3;
    }
    
    // Jaro-Winkler similarity
    const jaroWinkler = this.jaroWinklerSimilarity(normalizedQuery, normalizedTarget);
    
    // Levenshtein distance normalized
    const maxLen = Math.max(normalizedQuery.length, normalizedTarget.length);
    const levenshtein = 1 - this.levenshteinDistance(normalizedQuery, normalizedTarget) / maxLen;
    
    // Token-based similarity
    const queryTokens = normalizedQuery.split(/\s+/);
    const targetTokens = normalizedTarget.split(/\s+/);
    const tokenMatches = queryTokens.filter(token => 
      targetTokens.some(targetToken => targetToken.includes(token) || token.includes(targetToken))
    ).length;
    const tokenSimilarity = tokenMatches / Math.max(queryTokens.length, targetTokens.length);
    
    // Weighted combination
    return (jaroWinkler * 0.4 + levenshtein * 0.3 + tokenSimilarity * 0.3);
  }
}

/**
 * NLP-based contextual analysis engine
 */
class ContextualAnalyzer {
  private static readonly INTEREST_KEYWORDS = {
    'Nature & Scenery': ['nature', 'scenery', 'view', 'mountain', 'park', 'garden', 'outdoor', 'landscape', 'scenic'],
    'Food & Culinary': ['food', 'eat', 'restaurant', 'cuisine', 'dining', 'taste', 'local', 'delicacy', 'market'],
    'Culture & Arts': ['culture', 'art', 'museum', 'heritage', 'history', 'traditional', 'gallery', 'craft'],
    'Shopping & Local Finds': ['shop', 'market', 'buy', 'souvenir', 'local', 'handicraft', 'store', 'mall'],
    'Adventure': ['adventure', 'hiking', 'trail', 'climb', 'explore', 'trek', 'outdoor', 'activity']
  };

  private static readonly WEATHER_KEYWORDS = {
    'rainy': ['indoor', 'covered', 'shelter', 'mall', 'museum', 'gallery'],
    'sunny': ['outdoor', 'park', 'garden', 'view', 'hiking', 'trail'],
    'cold': ['warm', 'indoor', 'hot', 'cozy', 'shelter'],
    'cloudy': ['flexible', 'indoor', 'outdoor', 'covered']
  };

  private static readonly TIME_KEYWORDS = {
    'morning': ['sunrise', 'early', 'fresh', 'quiet', 'peaceful'],
    'afternoon': ['lunch', 'busy', 'active', 'warm'],
    'evening': ['sunset', 'dinner', 'night', 'romantic', 'calm']
  };

  static analyzeContextualRelevance(
    query: string,
    activity: Activity,
    context: SearchContext
  ): { score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 0;

    const queryLower = query.toLowerCase();
    const titleLower = activity.title.toLowerCase();
    const descLower = activity.desc.toLowerCase();
    const tags = activity.tags || [];

    // Interest matching
    for (const interest of context.interests) {
      const keywords = this.INTEREST_KEYWORDS[interest as keyof typeof this.INTEREST_KEYWORDS] || [];
      const matchCount = keywords.filter(keyword => 
        queryLower.includes(keyword) || titleLower.includes(keyword) || descLower.includes(keyword)
      ).length;
      
      if (matchCount > 0) {
        score += (matchCount / keywords.length) * 0.3;
        factors.push(`Interest match: ${interest} (${matchCount} keywords)`);
      }
    }

    // Weather appropriateness
    const weatherKeywords = this.WEATHER_KEYWORDS[context.weatherCondition as keyof typeof this.WEATHER_KEYWORDS] || [];
    const weatherMatches = weatherKeywords.filter(keyword =>
      tags.some(tag => tag.toLowerCase().includes(keyword)) ||
      descLower.includes(keyword)
    ).length;
    
    if (weatherMatches > 0) {
      score += (weatherMatches / weatherKeywords.length) * 0.2;
      factors.push(`Weather appropriate: ${context.weatherCondition} (${weatherMatches} matches)`);
    }

    // Time of day relevance
    const timeKeywords = this.TIME_KEYWORDS[context.timeOfDay as keyof typeof this.TIME_KEYWORDS] || [];
    const timeMatches = timeKeywords.filter((keyword: string) =>
      titleLower.includes(keyword) || descLower.includes(keyword)
    ).length;
    
    if (timeMatches > 0) {
      score += (timeMatches / timeKeywords.length) * 0.15;
      factors.push(`Time relevance: ${context.timeOfDay} (${timeMatches} matches)`);
    }

    // Budget appropriateness
    const budgetScore = this.calculateBudgetScore(activity, context.budget);
    score += budgetScore * 0.2;
    if (budgetScore > 0) {
      factors.push(`Budget appropriate: ${context.budget}`);
    }

    // Group size appropriateness
    const groupScore = this.calculateGroupSizeScore(activity, context.groupSize);
    score += groupScore * 0.15;
    if (groupScore > 0) {
      factors.push(`Group size appropriate: ${context.groupSize} people`);
    }

    return { score: Math.min(score, 1.0), factors };
  }

  private static calculateBudgetScore(activity: Activity, budget: string): number {
    const desc = activity.desc.toLowerCase();
    
    switch (budget) {
      case 'budget':
        return desc.includes('free') ? 1.0 : desc.includes('₱') && !desc.includes('₱1') ? 0.3 : 0.7;
      case 'mid-range':
        return 0.8; // Most activities fit mid-range
      case 'luxury':
        return desc.includes('premium') || desc.includes('luxury') ? 1.0 : 0.6;
      default:
        return 0.5;
    }
  }

  private static calculateGroupSizeScore(activity: Activity, groupSize: number): number {
    const desc = activity.desc.toLowerCase();
    const tags = activity.tags || [];
    
    if (groupSize === 1) {
      return desc.includes('solo') || tags.includes('Solo-friendly') ? 1.0 : 0.7;
    } else if (groupSize === 2) {
      return desc.includes('couple') || tags.includes('Romantic') ? 1.0 : 0.8;
    } else if (groupSize <= 5) {
      return tags.includes('Family-friendly') ? 1.0 : 0.8;
    } else {
      return tags.includes('Group-friendly') || desc.includes('group') ? 1.0 : 0.6;
    }
  }
}

/**
 * Temporal optimization engine with real-time traffic integration
 */
class TemporalOptimizer {
  static async calculateTemporalScore(activity: Activity, context: SearchContext): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Get activity coordinates for traffic data
    const coordinates = getActivityCoordinates(activity.title);
    let realTimeTrafficScore = 0;
    
    if (coordinates) {
      try {
        // Fetch real-time traffic data
        const trafficData = await tomtomTrafficService.getLocationTrafficData(coordinates.lat, coordinates.lon);
        if (trafficData) {
          const { trafficLevel, recommendationScore } = trafficData;
          
          // Convert traffic level to score bonus/penalty
          switch (trafficLevel) {
            case 'LOW':
              realTimeTrafficScore = 0.3;
              factors.push(`Real-time traffic: ${trafficLevel} (${Math.round(recommendationScore)}% optimal)`);
              break;
            case 'MODERATE':
              realTimeTrafficScore = 0.1;
              factors.push(`Real-time traffic: ${trafficLevel} (${Math.round(recommendationScore)}% optimal)`);
              break;
            case 'HIGH':
              realTimeTrafficScore = -0.2;
              factors.push(`Real-time traffic: ${trafficLevel} (${Math.round(recommendationScore)}% optimal)`);
              break;
            case 'SEVERE':
              realTimeTrafficScore = -0.4;
              factors.push(`Real-time traffic: ${trafficLevel} (${Math.round(recommendationScore)}% optimal)`);
              break;
          }
        }
      } catch (error) {
        console.warn(`Traffic data unavailable for ${activity.title}:`, error);
        factors.push('Traffic data unavailable - using peak hours only');
      }
    }

    // Combine real-time traffic with peak hours data
    if (activity.peakHours) {
      const isCurrentlyPeak = isCurrentlyPeakHours(activity.peakHours);
      if (!isCurrentlyPeak) {
        score += 0.4;
        factors.push('Currently outside peak hours');
      } else {
        score -= 0.3;
        factors.push('Currently in peak hours');
      }
    } else {
      score += 0.2;
      factors.push('No peak hour restrictions');
    }

    // Add real-time traffic score
    score += realTimeTrafficScore;

    // Time of day alignment
    const activityTime = activity.time.toLowerCase();
    const timeAlignment = this.calculateTimeAlignment(activityTime, context.timeOfDay);
    score += timeAlignment * 0.3;
    if (timeAlignment > 0.5) {
      factors.push(`Good time alignment: ${context.timeOfDay}`);
    }

    // Duration appropriateness
    const durationScore = this.calculateDurationScore(activity, context.duration);
    score += durationScore * 0.3;
    if (durationScore > 0.5) {
      factors.push(`Duration appropriate: ${context.duration} days`);
    }

    return { score: Math.max(0, Math.min(score, 1.0)), factors };
  }

  private static calculateTimeAlignment(activityTime: string, preferredTime: string): number {
    const timeMap: Record<string, string[]> = {
      morning: ['am', 'morning', '6:00', '7:00', '8:00', '9:00', '10:00', '11:00'],
      afternoon: ['pm', 'afternoon', '12:00', '1:00', '2:00', '3:00', '4:00', '5:00'],
      evening: ['evening', 'night', '6:00 pm', '7:00 pm', '8:00 pm', '9:00 pm'],
      anytime: ['24 hours', 'anytime', 'flexible']
    };

    const preferredKeywords = timeMap[preferredTime] || [];
    const matches = preferredKeywords.filter((keyword: string) =>
      activityTime.includes(keyword)
    ).length;
    
    return matches > 0 ? Math.min(matches / preferredKeywords.length * 2, 1.0) : 0.3;
  }

  private static calculateDurationScore(activity: Activity, duration: number): number {
    // Longer trips can accommodate more diverse activities
    if (duration === 1) return 0.8; // Prioritize must-see attractions
    if (duration === 2) return 0.9; // Good balance
    if (duration >= 3) return 1.0; // Can include everything
    return 0.7;
  }
}

/**
 * Diversity engine to ensure varied recommendations
 */
class DiversityEngine {
  static calculateDiversityScore(
    activity: Activity,
    existingResults: IntelligentSearchResult[],
    context: SearchContext
  ): { score: number; factors: string[] } {
    const factors: string[] = [];
    let score = 1.0;

    // Tag diversity
    const activityTags = new Set(activity.tags || []);
    const existingTags = new Set(
      existingResults.flatMap(result => result.activity.tags || [])
    );

    const tagOverlap = [...activityTags].filter(tag => existingTags.has(tag)).length;
    const tagDiversityScore = 1 - (tagOverlap / Math.max(activityTags.size, 1));
    score *= tagDiversityScore;

    if (tagDiversityScore > 0.7) {
      factors.push('High tag diversity');
    } else if (tagOverlap > 0) {
      factors.push(`Some tag overlap: ${tagOverlap} tags`);
    }

    // Location diversity (if available)
    // Time slot diversity
    const activityTimeSlot = this.extractTimeSlot(activity.time);
    const existingTimeSlots = existingResults.map(r => this.extractTimeSlot(r.activity.time));
    const timeSlotCount = existingTimeSlots.filter(slot => slot === activityTimeSlot).length;
    
    if (timeSlotCount === 0) {
      score *= 1.1; // Bonus for new time slot
      factors.push(`New time slot: ${activityTimeSlot}`);
    } else if (timeSlotCount > 2) {
      score *= 0.8; // Penalty for overused time slot
      factors.push(`Overused time slot: ${activityTimeSlot}`);
    }

    return { score: Math.max(0.1, Math.min(score, 1.0)), factors };
  }

  private static extractTimeSlot(timeString: string): string {
    const time = timeString.toLowerCase();
    if (time.includes('am') || time.includes('morning')) return 'morning';
    if (time.includes('pm') || time.includes('afternoon')) return 'afternoon';
    if (time.includes('evening') || time.includes('night')) return 'evening';
    return 'anytime';
  }
}

/**
 * Main Intelligent Search Engine
 */
export class IntelligentSearchEngine {
  private config: IntelligentSearchConfig;
  private cache: Map<string, IntelligentSearchResult[]> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  constructor(config: Partial<IntelligentSearchConfig> = {}) {
    this.config = { ...DEFAULT_SEARCH_CONFIG, ...config };
  }

  async search(
    query: string,
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    const cacheKey = this.generateCacheKey(query, context);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cacheKey)) {
      return cached;
    }

    try {
      // Multi-stage intelligent search
      const results = await this.performIntelligentSearch(query, context);
      
      // Cache results
      this.cache.set(cacheKey, results);
      this.cleanupCache();
      
      return results;
    } catch (error) {
      console.error('Intelligent search failed:', error);
      // If intelligent search fails, return an empty array as we rely on the database.
      return [];
    }
  }

  private async performIntelligentSearch(
    query: string,
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    const results: IntelligentSearchResult[] = [];
    const processedActivities = new Set<string>();

    // Stage 1: Semantic search with embeddings
    let semanticResults: any[] = [];
    if (supabaseAdmin) {
      try {
        const queryEmbedding = await generateEmbedding(query);
        const { data } = await supabaseAdmin.rpc("match_activity_embeddings", {
          query_embedding: queryEmbedding,
          match_count: this.config.maxResults * 2,
        });
        semanticResults = data || [];
      } catch (error) {
        console.warn('Semantic search failed, continuing with other methods:', error);
      }
    }

    // Stage 2: Process each activity from the database with multi-dimensional scoring
    const activities = semanticResults.map((r: any) => r.metadata as Activity);
    for (const activity of activities) {
      if (processedActivities.has(activity.title)) continue;
      processedActivities.add(activity.title);

      const scores = {
        semantic: 0,
        vector: 0,
        fuzzy: 0,
        contextual: 0,
        temporal: 0,
        diversity: 0,
        composite: 0
      };

      const reasoning: string[] = [];
      const metadata = {
        searchQuery: query,
        matchedTerms: [] as string[],
        contextFactors: [] as string[],
        temporalFactors: [] as string[]
      };

      // Vector similarity scoring (dedicated vector search)
      if (this.config.vectorWeight > 0) {
        const vectorMatch = semanticResults.find(r => 
          r.metadata?.title === activity.title || r.activity_id === activity.title
        );
        scores.vector = vectorMatch ? vectorMatch.similarity : 0;
        if (scores.vector > 0.7) {
          reasoning.push(`High vector similarity: ${(scores.vector * 100).toFixed(1)}%`);
        }
      }

      // Semantic scoring (content-based matching)
      if (this.config.semanticWeight > 0) {
        // Use title and description matching for semantic scoring
        const titleMatch = activity.title.toLowerCase().includes(query.toLowerCase()) ? 0.8 : 0;
        const descMatch = activity.desc.toLowerCase().includes(query.toLowerCase()) ? 0.6 : 0;
        const tagMatch = activity.tags.some(tag => 
          tag.toLowerCase().includes(query.toLowerCase()) || 
          query.toLowerCase().includes(tag.toLowerCase())
        ) ? 0.7 : 0;
        
        scores.semantic = Math.max(titleMatch, descMatch, tagMatch);
        if (scores.semantic > 0.5) {
          reasoning.push(`Content match: ${(scores.semantic * 100).toFixed(1)}%`);
        }
      }

      // Fuzzy matching
      if (this.config.enableFuzzyMatching && this.config.fuzzyWeight > 0) {
        const titleScore = FuzzyMatcher.calculateFuzzyScore(query, activity.title);
        const descScore = FuzzyMatcher.calculateFuzzyScore(query, activity.desc);
        scores.fuzzy = Math.max(titleScore, descScore * 0.7);
        
        if (scores.fuzzy > 0.6) {
          reasoning.push(`Good fuzzy match: ${(scores.fuzzy * 100).toFixed(1)}%`);
          metadata.matchedTerms.push(titleScore > descScore ? 'title' : 'description');
        }
      }

      // Contextual analysis
      if (this.config.enableContextualAnalysis && this.config.contextWeight > 0) {
        const contextResult = ContextualAnalyzer.analyzeContextualRelevance(query, activity, context);
        scores.contextual = contextResult.score;
        metadata.contextFactors = contextResult.factors;
        
        if (scores.contextual > 0.5) {
          reasoning.push(`Strong contextual relevance: ${contextResult.factors.join(', ')}`);
        }
      }

      // Temporal optimization is deferred to the main pipeline to avoid excessive API calls.
      scores.temporal = 0.5; // Assign a neutral score
      metadata.temporalFactors.push('Real-time traffic analysis deferred');

      // Diversity scoring
      if (this.config.diversityWeight > 0) {
        const diversityResult = DiversityEngine.calculateDiversityScore(activity, results, context);
        scores.diversity = diversityResult.score;
        
        if (diversityResult.factors.length > 0) {
          reasoning.push(`Diversity: ${diversityResult.factors.join(', ')}`);
        }
      }

      // Calculate composite score
      scores.composite = (
        scores.semantic * this.config.semanticWeight +
        scores.vector * this.config.vectorWeight +
        scores.fuzzy * this.config.fuzzyWeight +
        scores.contextual * this.config.contextWeight +
        scores.temporal * this.config.temporalWeight +
        scores.diversity * this.config.diversityWeight
      );

      // Confidence calculation
      const confidence = this.calculateConfidence(scores, reasoning.length);

      // Only include results above threshold
      if (scores.composite >= this.config.minSimilarityThreshold) {
        results.push({
          activity,
          scores,
          reasoning,
          confidence,
          metadata
        });
      }
    }

    // Sort by composite score and apply final ranking
    return results
      .sort((a, b) => b.scores.composite - a.scores.composite)
      .slice(0, this.config.maxResults);
  }


  private calculateConfidence(scores: any, reasoningCount: number): number {
    const scoreVariance = this.calculateVariance(Object.values(scores).slice(0, -1) as number[]);
    const consistencyBonus = scoreVariance < 0.1 ? 0.2 : 0;
    const reasoningBonus = Math.min(reasoningCount * 0.1, 0.3);
    
    return Math.min(scores.composite + consistencyBonus + reasoningBonus, 1.0);
  }

  private calculateVariance(scores: number[]): number {
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    return variance;
  }

  private generateCacheKey(query: string, context: SearchContext): string {
    return `${query}_${JSON.stringify(context)}_${Date.now()}`;
  }

  private isCacheValid(cacheKey: string): boolean {
    const timestamp = parseInt(cacheKey.split('_').pop() || '0');
    return Date.now() - timestamp < this.CACHE_TTL;
  }

  private cleanupCache(): void {
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      const validEntries = entries.filter(([key]) => this.isCacheValid(key));
      this.cache.clear();
      validEntries.forEach(([key, value]) => this.cache.set(key, value));
    }
  }
}

// Export singleton instance
export const intelligentSearchEngine = new IntelligentSearchEngine();
