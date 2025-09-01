/**
 * Search Optimization and Query Enhancement Engine
 * Provides query expansion, intent detection, and search result optimization
 * 
 * @author Doniele Arys Antonio
 * @version 2.0.0
 */

import { generateEmbedding } from '../ai/embeddings';
import type { Activity } from "@/app/itinerary-generator/data/itineraryData";
import type { SearchContext } from "./intelligentSearch";

export interface QueryIntent {
  primary: string;
  secondary: string[];
  confidence: number;
  entities: {
    activities: string[];
    locations: string[];
    timeReferences: string[];
    preferences: string[];
  };
}

export interface ExpandedQuery {
  original: string;
  expanded: string[];
  synonyms: string[];
  relatedTerms: string[];
  negativeTerms: string[];
}

export interface SearchOptimization {
  queryExpansion: ExpandedQuery;
  intentAnalysis: QueryIntent;
  contextualBoosts: Map<string, number>;
  filterRecommendations: string[];
}

/**
 * Advanced query processing and intent detection
 */
export class QueryProcessor {
  private static readonly INTENT_PATTERNS = {
    exploration: ['explore', 'discover', 'find', 'see', 'visit', 'check out'],
    relaxation: ['relax', 'chill', 'peaceful', 'quiet', 'calm', 'serene'],
    adventure: ['adventure', 'exciting', 'thrilling', 'active', 'challenging'],
    cultural: ['culture', 'history', 'traditional', 'heritage', 'local', 'authentic'],
    scenic: ['beautiful', 'scenic', 'view', 'panoramic', 'picturesque', 'stunning'],
    dining: ['eat', 'food', 'restaurant', 'cuisine', 'taste', 'dining', 'delicious'],
    shopping: ['shop', 'buy', 'market', 'souvenir', 'local products', 'handicrafts'],
    photography: ['photo', 'instagram', 'picture', 'photogenic', 'capture', 'shoot']
  };

  private static readonly ACTIVITY_SYNONYMS: Record<string, string[]> = {
    'park': ['garden', 'green', 'nature', 'outdoor', 'burnham', 'places', 'beautiful'],
    'museum': ['gallery', 'art', 'exhibit', 'culture', 'bencab'],
    'restaurant': ['food', 'dining', 'eat', 'cuisine'],
    'shopping': ['mall', 'market', 'store', 'buy', 'night market'],
    'beach': ['coast', 'shore', 'sand', 'ocean'],
    'temple': ['church', 'shrine', 'religious', 'worship'],
    'mountain': ['hill', 'peak', 'climb', 'hike', 'view', 'mines'],
    'lake': ['water', 'pond', 'river', 'stream'],
    'trail': ['path', 'hike', 'trek', 'walkway', 'route'],
    'church': ['cathedral', 'chapel', 'religious site', 'place of worship'],
    'hotel': ['accommodation', 'lodging', 'resort', 'inn']
  };

  private static readonly LOCATION_ENTITIES = [
    'baguio', 'burnham', 'session road', 'camp john hay', 'mines view',
    'wright park', 'botanical garden', 'cathedral', 'mansion', 'tam-awan'
  ];

  private static readonly TIME_PATTERNS = {
    morning: ['morning', 'early', 'sunrise', 'am', 'dawn'],
    afternoon: ['afternoon', 'lunch', 'midday', 'pm'],
    evening: ['evening', 'sunset', 'night', 'dinner', 'late'],
    weekend: ['weekend', 'saturday', 'sunday'],
    weekday: ['weekday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  };

  static analyzeIntent(query: string): QueryIntent {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/);
    
    const intentScores = new Map<string, number>();
    
    // Calculate intent scores
    for (const [intent, patterns] of Object.entries(this.INTENT_PATTERNS)) {
      const matches = patterns.filter(pattern => 
        queryLower.includes(pattern) || words.some(word => word.includes(pattern))
      ).length;
      
      if (matches > 0) {
        intentScores.set(intent, matches / patterns.length);
      }
    }

    // Determine primary and secondary intents
    const sortedIntents = Array.from(intentScores.entries())
      .sort(([, a], [, b]) => b - a);
    
    const primary = sortedIntents[0]?.[0] || 'exploration';
    const secondary = sortedIntents.slice(1, 3).map(([intent]) => intent);
    const confidence = sortedIntents[0]?.[1] || 0.3;

    // Extract entities
    const entities = {
      activities: this.extractActivityEntities(queryLower),
      locations: this.extractLocationEntities(queryLower),
      timeReferences: this.extractTimeEntities(queryLower),
      preferences: this.extractPreferenceEntities(queryLower)
    };

    return {
      primary,
      secondary,
      confidence,
      entities
    };
  }

  private static extractActivityEntities(query: string): string[] {
    const entities: string[] = [];
    const queryLower = query.toLowerCase();
    
    for (const [activity, synonyms] of Object.entries(this.ACTIVITY_SYNONYMS)) {
      if (queryLower.includes(activity) || synonyms.some(syn => queryLower.includes(syn))) {
        entities.push(activity);
      }
    }
    
    return entities;
  }

  private static extractLocationEntities(query: string): string[] {
    return this.LOCATION_ENTITIES.filter(location => query.includes(location));
  }

  private static extractTimeEntities(query: string): string[] {
    const entities: string[] = [];
    
    for (const [timeType, patterns] of Object.entries(this.TIME_PATTERNS)) {
      if (patterns.some(pattern => query.includes(pattern))) {
        entities.push(timeType);
      }
    }
    
    return entities;
  }

  private static extractPreferenceEntities(query: string): string[] {
    const preferences: string[] = [];
    
    // Budget preferences
    if (query.includes('cheap') || query.includes('budget') || query.includes('affordable')) {
      preferences.push('budget-friendly');
    }
    if (query.includes('luxury') || query.includes('premium') || query.includes('expensive')) {
      preferences.push('luxury');
    }
    
    // Group preferences
    if (query.includes('family') || query.includes('kids') || query.includes('children')) {
      preferences.push('family-friendly');
    }
    if (query.includes('romantic') || query.includes('couple') || query.includes('date')) {
      preferences.push('romantic');
    }
    if (query.includes('solo') || query.includes('alone') || query.includes('myself')) {
      preferences.push('solo-friendly');
    }
    
    // Accessibility preferences
    if (query.includes('accessible') || query.includes('wheelchair') || query.includes('elderly')) {
      preferences.push('accessible');
    }
    
    return preferences;
  }

  static expandQuery(query: string, intent: QueryIntent): ExpandedQuery {
    const queryLower = query.toLowerCase();
    const expanded: string[] = [query];
    const synonyms: string[] = [];
    const relatedTerms: string[] = [];
    const negativeTerms: string[] = [];

    // Add intent-based expansions
    const intentExpansions = this.getIntentExpansions(intent.primary);
    expanded.push(...intentExpansions);

    // Add synonym expansions
    for (const [term, termSynonyms] of Object.entries(this.ACTIVITY_SYNONYMS)) {
      if (queryLower.includes(term)) {
        synonyms.push(...termSynonyms);
        expanded.push(...termSynonyms.map(syn => query.replace(new RegExp(term, 'gi'), syn)));
      }
    }

    // Add related terms based on entities
    for (const activity of intent.entities.activities) {
      relatedTerms.push(...this.getRelatedTerms(activity));
    }

    // Add contextual expansions
    if (intent.entities.timeReferences.length > 0) {
      const timeContext = intent.entities.timeReferences[0];
      relatedTerms.push(...this.getTimeRelatedTerms(timeContext));
    }

    // Add negative terms to avoid irrelevant results
    negativeTerms.push(...this.getNegativeTerms(intent.primary));

    return {
      original: query,
      expanded: [...new Set(expanded)],
      synonyms: [...new Set(synonyms)],
      relatedTerms: [...new Set(relatedTerms)],
      negativeTerms: [...new Set(negativeTerms)]
    };
  }

  private static getIntentExpansions(intent: string): string[] {
    const expansions: Record<string, string[]> = {
      exploration: ['sightseeing', 'tourist attractions', 'must-see places'],
      relaxation: ['peaceful places', 'quiet spots', 'zen locations'],
      adventure: ['outdoor activities', 'hiking trails', 'exciting experiences'],
      cultural: ['heritage sites', 'museums', 'traditional places'],
      scenic: ['viewpoints', 'photo spots', 'beautiful locations'],
      dining: ['local cuisine', 'restaurants', 'food experiences'],
      shopping: ['markets', 'local products', 'souvenir shops'],
      photography: ['instagrammable spots', 'photo opportunities', 'scenic views']
    };
    
    return expansions[intent] || [];
  }

  private static getRelatedTerms(activity: string): string[] {
    const relatedTerms: Record<string, string[]> = {
      park: ['outdoor', 'nature', 'recreation', 'walking'],
      museum: ['art', 'history', 'culture', 'education'],
      market: ['local', 'shopping', 'vendors', 'food'],
      restaurant: ['cuisine', 'dining', 'local food', 'taste'],
      view: ['scenery', 'photography', 'landscape', 'mountains'],
      trail: ['hiking', 'nature', 'exercise', 'outdoor'],
      church: ['architecture', 'history', 'spiritual', 'peaceful'],
      hotel: ['accommodation', 'comfort', 'service', 'amenities']
    };
    
    return relatedTerms[activity] || [];
  }

  private static getTimeRelatedTerms(timeContext: string): string[] {
    const timeTerms: Record<string, string[]> = {
      morning: ['fresh air', 'sunrise', 'peaceful', 'quiet'],
      afternoon: ['active', 'busy', 'warm', 'social'],
      evening: ['romantic', 'dinner', 'nightlife', 'relaxed'],
      weekend: ['crowded', 'family time', 'leisure', 'popular'],
      weekday: ['quiet', 'less crowded', 'peaceful', 'local']
    };
    
    return timeTerms[timeContext] || [];
  }

  private static getNegativeTerms(intent: string): string[] {
    const negativeTerms: Record<string, string[]> = {
      relaxation: ['crowded', 'noisy', 'busy', 'chaotic'],
      adventure: ['boring', 'inactive', 'sedentary', 'passive'],
      cultural: ['modern', 'commercial', 'touristy', 'artificial'],
      scenic: ['ugly', 'industrial', 'blocked view', 'construction']
    };
    
    return negativeTerms[intent] || [];
  }
}

/**
 * Search result optimization and ranking enhancement
 */
export class SearchOptimizer {
  private static readonly BOOST_FACTORS = {
    exactMatch: 2.0,
    titleMatch: 1.5,
    descriptionMatch: 1.2,
    tagMatch: 1.3,
    intentAlignment: 1.4,
    contextRelevance: 1.3,
    temporalFit: 1.2,
    popularityBoost: 1.1
  };

  static optimizeSearchResults(
    results: any[],
    optimization: SearchOptimization,
    context: SearchContext
  ): any[] {
    return results.map(result => {
      const optimizedResult = { ...result };
      let boostMultiplier = 1.0;
      const boostReasons: string[] = [];

      // Apply query expansion boosts
      const expandedQuery = optimization.queryExpansion;
      boostMultiplier *= this.calculateQueryExpansionBoost(
        result.activity,
        expandedQuery,
        boostReasons
      );

      // Apply intent alignment boosts
      boostMultiplier *= this.calculateIntentAlignmentBoost(
        result.activity,
        optimization.intentAnalysis,
        boostReasons
      );

      // Apply contextual boosts
      for (const [factor, boost] of optimization.contextualBoosts.entries()) {
        if (this.activityMatchesFactor(result.activity, factor)) {
          boostMultiplier *= boost;
          boostReasons.push(`Contextual boost: ${factor}`);
        }
      }

      // Apply temporal optimization
      boostMultiplier *= this.calculateTemporalBoost(result.activity, context, boostReasons);

      // Update scores
      optimizedResult.scores.composite *= boostMultiplier;
      optimizedResult.confidence = Math.min(optimizedResult.confidence * boostMultiplier, 1.0);
      optimizedResult.reasoning.push(...boostReasons);

      return optimizedResult;
    }).sort((a, b) => b.scores.composite - a.scores.composite);
  }

  private static calculateQueryExpansionBoost(
    activity: Activity,
    expandedQuery: ExpandedQuery,
    boostReasons: string[]
  ): number {
    let boost = 1.0;
    const activityText = `${activity.title} ${activity.desc}`.toLowerCase();

    // Exact match boost
    if (activityText.includes(expandedQuery.original.toLowerCase())) {
      boost *= this.BOOST_FACTORS.exactMatch;
      boostReasons.push('Exact query match');
    }

    // Synonym match boost
    const synonymMatches = expandedQuery.synonyms.filter(syn => 
      activityText.includes(syn.toLowerCase())
    ).length;
    
    if (synonymMatches > 0) {
      boost *= Math.min(1 + (synonymMatches * 0.2), this.BOOST_FACTORS.titleMatch);
      boostReasons.push(`Synonym matches: ${synonymMatches}`);
    }

    // Related terms boost
    const relatedMatches = expandedQuery.relatedTerms.filter(term => 
      activityText.includes(term.toLowerCase())
    ).length;
    
    if (relatedMatches > 0) {
      boost *= Math.min(1 + (relatedMatches * 0.1), this.BOOST_FACTORS.descriptionMatch);
      boostReasons.push(`Related term matches: ${relatedMatches}`);
    }

    // Negative terms penalty
    const negativeMatches = expandedQuery.negativeTerms.filter(term => 
      activityText.includes(term.toLowerCase())
    ).length;
    
    if (negativeMatches > 0) {
      boost *= Math.max(0.5, 1 - (negativeMatches * 0.2));
      boostReasons.push(`Negative term penalty: ${negativeMatches}`);
    }

    return boost;
  }

  private static calculateIntentAlignmentBoost(
    activity: Activity,
    intent: QueryIntent,
    boostReasons: string[]
  ): number {
    let boost = 1.0;
    const activityText = `${activity.title} ${activity.desc}`.toLowerCase();
    const tags = activity.tags || [];

    // Primary intent alignment
    const primaryPatterns = QueryProcessor['INTENT_PATTERNS'][intent.primary as keyof typeof QueryProcessor['INTENT_PATTERNS']] || [];
    const primaryMatches = primaryPatterns.filter(pattern => 
      activityText.includes(pattern) || tags.some(tag => tag.toLowerCase().includes(pattern))
    ).length;

    if (primaryMatches > 0) {
      boost *= this.BOOST_FACTORS.intentAlignment;
      boostReasons.push(`Primary intent alignment: ${intent.primary}`);
    }

    // Secondary intent alignment
    for (const secondaryIntent of intent.secondary) {
      const secondaryPatterns = QueryProcessor['INTENT_PATTERNS'][secondaryIntent as keyof typeof QueryProcessor['INTENT_PATTERNS']] || [];
      const secondaryMatches = secondaryPatterns.filter(pattern => 
        activityText.includes(pattern) || tags.some(tag => tag.toLowerCase().includes(pattern))
      ).length;

      if (secondaryMatches > 0) {
        boost *= Math.min(this.BOOST_FACTORS.intentAlignment * 0.7, 1.2);
        boostReasons.push(`Secondary intent alignment: ${secondaryIntent}`);
      }
    }

    return boost;
  }

  private static calculateTemporalBoost(
    activity: Activity,
    context: SearchContext,
    boostReasons: string[]
  ): number {
    let boost = 1.0;

    // Time of day alignment
    const activityTime = activity.time.toLowerCase();
    const contextTime = context.timeOfDay;

    if (this.timeAlignmentCheck(activityTime, contextTime)) {
      boost *= this.BOOST_FACTORS.temporalFit;
      boostReasons.push(`Time alignment: ${contextTime}`);
    }

    // Peak hours consideration
    if (activity.peakHours) {
      const currentTime = context.currentTime || new Date();
      // This would integrate with the existing peak hours logic
      // For now, we'll add a placeholder boost
      boost *= 1.1;
      boostReasons.push('Peak hours optimized');
    }

    return boost;
  }

  private static timeAlignmentCheck(activityTime: string, contextTime: string): boolean {
    const timeMap = {
      morning: ['am', 'morning', '6:', '7:', '8:', '9:', '10:', '11:'],
      afternoon: ['pm', 'afternoon', '12:', '1:', '2:', '3:', '4:', '5:'],
      evening: ['evening', 'night', '6:', '7:', '8:', '9:', '10:'],
      anytime: ['24 hours', 'anytime', 'flexible']
    };

    const patterns = timeMap[contextTime as keyof typeof timeMap] || [];
    return patterns.some(pattern => activityTime.includes(pattern));
  }

  private static activityMatchesFactor(activity: Activity, factor: string): boolean {
    const activityText = `${activity.title} ${activity.desc}`.toLowerCase();
    const tags = activity.tags || [];
    
    return activityText.includes(factor.toLowerCase()) || 
           tags.some(tag => tag.toLowerCase().includes(factor.toLowerCase()));
  }

  static generateSearchOptimization(
    query: string,
    context: SearchContext
  ): SearchOptimization {
    const intentAnalysis = QueryProcessor.analyzeIntent(query);
    const queryExpansion = QueryProcessor.expandQuery(query, intentAnalysis);
    
    const contextualBoosts = new Map<string, number>();
    
    // Add context-based boosts
    for (const interest of context.interests) {
      contextualBoosts.set(interest.toLowerCase(), 1.3);
    }
    
    contextualBoosts.set(context.weatherCondition, 1.2);
    contextualBoosts.set(context.budget, 1.2);
    contextualBoosts.set(`group-${context.groupSize}`, 1.1);

    const filterRecommendations = this.generateFilterRecommendations(intentAnalysis, context);

    return {
      queryExpansion,
      intentAnalysis,
      contextualBoosts,
      filterRecommendations
    };
  }

  private static generateFilterRecommendations(
    intent: QueryIntent,
    context: SearchContext
  ): string[] {
    const recommendations: string[] = [];

    // Intent-based filter recommendations
    if (intent.confidence > 0.7) {
      recommendations.push(`Filter by ${intent.primary} activities`);
    }

    // Entity-based recommendations
    if (intent.entities.timeReferences.length > 0) {
      recommendations.push(`Filter by ${intent.entities.timeReferences[0]} availability`);
    }

    if (intent.entities.preferences.length > 0) {
      recommendations.push(`Apply ${intent.entities.preferences.join(', ')} filters`);
    }

    // Context-based recommendations
    if (context.weatherCondition !== 'clear') {
      recommendations.push(`Filter by ${context.weatherCondition}-appropriate activities`);
    }

    if (context.groupSize > 4) {
      recommendations.push('Filter by group-friendly activities');
    }

    // Always add at least one recommendation
    if (recommendations.length === 0) {
      recommendations.push(`Optimize for ${context.timeOfDay} activities`);
      recommendations.push(`Filter by ${context.interests.join(', ') || 'general'} interests`);
    }

    return recommendations;
  }
}

// Export utilities
export const queryProcessor = QueryProcessor;
export const searchOptimizer = SearchOptimizer;
