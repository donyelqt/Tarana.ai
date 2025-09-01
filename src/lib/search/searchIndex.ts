/**
 * Advanced Search Index and Data Structures
 * Provides optimized indexing, caching, and data access patterns for intelligent search
 * 
 * @author Doniele Arys Antonio
 * @version 2.0.0
 */

import type { Activity } from "@/app/itinerary-generator/data/itineraryData";
import { generateEmbedding } from '../ai/embeddings';

export interface IndexedActivity extends Activity {
  id: string;
  searchTokens: string[];
  categoryScores: Record<string, number>;
  timeSlot: 'morning' | 'afternoon' | 'evening' | 'anytime';
  popularityScore: number;
  lastUpdated: number;
}

export interface SearchIndex {
  tokenIndex: Map<string, Set<string>>; // token -> activity IDs
  categoryIndex: Map<string, Set<string>>; // category -> activity IDs
  timeSlotIndex: Map<string, Set<string>>; // timeSlot -> activity IDs
  tagIndex: Map<string, Set<string>>; // tag -> activity IDs
  embeddings: Map<string, number[]>; // activity ID -> embedding vector
  activities: Map<string, IndexedActivity>; // activity ID -> full activity data
  metadata: {
    totalActivities: number;
    lastIndexed: number;
    version: string;
  };
}

/**
 * Advanced text tokenization and preprocessing
 */
export class TextProcessor {
  private static readonly STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'must', 'shall'
  ]);

  private static readonly SYNONYMS = new Map([
    ['beautiful', ['scenic', 'stunning', 'picturesque', 'gorgeous']],
    ['food', ['cuisine', 'dining', 'restaurant', 'eat', 'meal']],
    ['view', ['scenery', 'vista', 'panorama', 'overlook', 'viewpoint']],
    ['walk', ['stroll', 'hike', 'trek', 'trail', 'path']],
    ['shop', ['market', 'store', 'buy', 'purchase', 'shopping']],
    ['old', ['historic', 'heritage', 'traditional', 'ancient', 'vintage']],
    ['fun', ['exciting', 'entertaining', 'enjoyable', 'amusing']],
    ['quiet', ['peaceful', 'calm', 'serene', 'tranquil', 'relaxing']]
  ]);

  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !this.STOP_WORDS.has(token))
      .map(token => token.trim())
      .filter(token => token.length > 0);
  }

  static expandTokens(tokens: string[]): string[] {
    const expanded = new Set(tokens);
    
    for (const token of tokens) {
      const synonyms = this.SYNONYMS.get(token);
      if (synonyms) {
        synonyms.forEach(synonym => expanded.add(synonym));
      }
    }
    
    return Array.from(expanded);
  }

  static generateNGrams(tokens: string[], n: number = 2): string[] {
    const ngrams: string[] = [];
    
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  }

  static calculateTFIDF(tokens: string[], documentFrequencies: Map<string, number>, totalDocuments: number): Map<string, number> {
    const tokenCounts = new Map<string, number>();
    const tfidf = new Map<string, number>();
    
    // Calculate term frequency
    for (const token of tokens) {
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
    
    // Calculate TF-IDF
    for (const [token, count] of tokenCounts.entries()) {
      const tf = count / tokens.length;
      const df = documentFrequencies.get(token) || 1;
      const idf = Math.log(totalDocuments / df);
      tfidf.set(token, tf * idf);
    }
    
    return tfidf;
  }
}

/**
 * High-performance search index with advanced data structures
 */
export class SearchIndexManager {
  private index: SearchIndex;
  private documentFrequencies: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly INDEX_VERSION = '2.0.0';

  constructor() {
    this.index = this.createEmptyIndex();
  }

  private createEmptyIndex(): SearchIndex {
    return {
      tokenIndex: new Map(),
      categoryIndex: new Map(),
      timeSlotIndex: new Map(),
      tagIndex: new Map(),
      embeddings: new Map(),
      activities: new Map(),
      metadata: {
        totalActivities: 0,
        lastIndexed: 0,
        version: this.INDEX_VERSION
      }
    };
  }

  /**
   * Build comprehensive search index from activities
   */
  async buildIndex(activities: Activity[]): Promise<void> {
    console.log('Building intelligent search index...');
    const startTime = Date.now();
    
    // Reset index
    this.index = this.createEmptyIndex();
    this.documentFrequencies.clear();
    
    // First pass: collect document frequencies
    const allTokens = new Set<string>();
    for (const activity of activities) {
      const text = `${activity.title} ${activity.desc} ${(activity.tags || []).join(' ')}`;
      const tokens = TextProcessor.tokenize(text);
      const expandedTokens = TextProcessor.expandTokens(tokens);
      
      expandedTokens.forEach(token => allTokens.add(token));
    }
    
    // Calculate document frequencies
    for (const token of allTokens) {
      let count = 0;
      for (const activity of activities) {
        const text = `${activity.title} ${activity.desc} ${(activity.tags || []).join(' ')}`;
        if (text.toLowerCase().includes(token)) {
          count++;
        }
      }
      this.documentFrequencies.set(token, count);
    }
    
    // Second pass: build index
    for (let i = 0; i < activities.length; i++) {
      const activity = activities[i];
      await this.indexActivity(activity, i.toString());
    }
    
    this.index.metadata = {
      totalActivities: activities.length,
      lastIndexed: Date.now(),
      version: this.INDEX_VERSION
    };
    
    console.log(`Search index built in ${Date.now() - startTime}ms for ${activities.length} activities`);
  }

  private async indexActivity(activity: Activity, id: string): Promise<void> {
    const text = `${activity.title} ${activity.desc} ${(activity.tags || []).join(' ')}`;
    const tokens = TextProcessor.tokenize(text);
    const expandedTokens = TextProcessor.expandTokens(tokens);
    const ngrams = TextProcessor.generateNGrams(tokens, 2);
    const allTokens = [...expandedTokens, ...ngrams];
    
    // Calculate category scores using TF-IDF
    const tfidf = TextProcessor.calculateTFIDF(tokens, this.documentFrequencies, this.index.metadata.totalActivities || 1);
    const categoryScores = this.calculateCategoryScores(activity, tfidf);
    
    // Determine time slot
    const timeSlot = this.determineTimeSlot(activity.time);
    
    // Calculate popularity score
    const popularityScore = this.calculatePopularityScore(activity);
    
    // Create indexed activity
    const indexedActivity: IndexedActivity = {
      ...activity,
      id,
      searchTokens: allTokens,
      categoryScores,
      timeSlot,
      popularityScore,
      lastUpdated: Date.now()
    };
    
    // Store in main activities map
    this.index.activities.set(id, indexedActivity);
    
    // Build token index
    for (const token of allTokens) {
      if (!this.index.tokenIndex.has(token)) {
        this.index.tokenIndex.set(token, new Set());
      }
      this.index.tokenIndex.get(token)!.add(id);
    }
    
    // Build category index
    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > 0.1) { // Only index significant category matches
        if (!this.index.categoryIndex.has(category)) {
          this.index.categoryIndex.set(category, new Set());
        }
        this.index.categoryIndex.get(category)!.add(id);
      }
    }
    
    // Build time slot index
    if (!this.index.timeSlotIndex.has(timeSlot)) {
      this.index.timeSlotIndex.set(timeSlot, new Set());
    }
    this.index.timeSlotIndex.get(timeSlot)!.add(id);
    
    // Build tag index
    for (const tag of activity.tags || []) {
      const normalizedTag = tag.toLowerCase();
      if (!this.index.tagIndex.has(normalizedTag)) {
        this.index.tagIndex.set(normalizedTag, new Set());
      }
      this.index.tagIndex.get(normalizedTag)!.add(id);
    }
    
    // Generate and store embedding (async, non-blocking)
    try {
      const embedding = await generateEmbedding(text);
      this.index.embeddings.set(id, embedding);
    } catch (error) {
      console.warn(`Failed to generate embedding for activity ${id}:`, error);
    }
  }

  private calculateCategoryScores(activity: Activity, tfidf: Map<string, number>): Record<string, number> {
    const categories = {
      'nature': ['nature', 'park', 'garden', 'mountain', 'view', 'scenic', 'outdoor', 'burnham', 'mines'],
      'culture': ['museum', 'heritage', 'history', 'traditional', 'art', 'culture', 'bencab'],
      'food': ['food', 'restaurant', 'cuisine', 'dining', 'eat', 'taste', 'market'],
      'shopping': ['shop', 'market', 'buy', 'store', 'souvenir', 'night'],
      'adventure': ['adventure', 'hiking', 'trail', 'climb', 'explore', 'trek'],
      'relaxation': ['peaceful', 'quiet', 'calm', 'serene', 'relaxing']
    };
    
    const scores: Record<string, number> = {};
    const text = `${activity.title} ${activity.desc}`.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;
      
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score += 0.5; // Fixed score instead of relying on TF-IDF which might be 0
        }
      }
      
      // Ensure minimum score for any matches
      if (score > 0) {
        scores[category] = Math.min(score / keywords.length + 0.1, 1.0);
      } else {
        scores[category] = 0;
      }
    }
    
    return scores;
  }

  private determineTimeSlot(timeString: string): 'morning' | 'afternoon' | 'evening' | 'anytime' {
    const time = timeString.toLowerCase();
    
    if (time.includes('24 hours') || time.includes('anytime')) return 'anytime';
    
    // Check for specific time patterns
    if (time.includes('6:00 am') || time.includes('morning') || time.match(/[6-9]:\d{2}\s*am/)) return 'morning';
    if (time.includes('9:00 pm') || time.includes('night') || time.match(/(?:9|1[0-2]):\d{2}\s*pm/) || time.includes('2:00 am')) return 'evening';
    if (time.includes('pm') || time.includes('afternoon')) return 'afternoon';
    if (time.includes('am')) return 'morning';
    
    // Default based on common activity patterns
    return 'anytime';
  }

  private calculatePopularityScore(activity: Activity): number {
    let score = 0.5; // Base score
    
    // Boost for free activities
    if (activity.desc.toLowerCase().includes('free')) score += 0.2;
    
    // Boost for highly rated or famous places
    const famousKeywords = ['famous', 'popular', 'must-see', 'iconic', 'landmark'];
    const desc = activity.desc.toLowerCase();
    const matchCount = famousKeywords.filter(keyword => desc.includes(keyword)).length;
    score += matchCount * 0.1;
    
    // Boost for central locations
    if (desc.includes('center') || desc.includes('central')) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Fast token-based search with ranking
   */
  searchByTokens(query: string, limit: number = 50): IndexedActivity[] {
    const tokens = TextProcessor.tokenize(query);
    const expandedTokens = TextProcessor.expandTokens(tokens);
    const activityScores = new Map<string, number>();
    
    // Score activities based on token matches
    for (const token of expandedTokens) {
      const activityIds = this.index.tokenIndex.get(token);
      if (activityIds) {
        for (const activityId of activityIds) {
          const currentScore = activityScores.get(activityId) || 0;
          activityScores.set(activityId, currentScore + 1);
        }
      }
    }
    
    // Convert to activities with scores
    const results: Array<{ activity: IndexedActivity; score: number }> = [];
    
    for (const [activityId, score] of activityScores.entries()) {
      const activity = this.index.activities.get(activityId);
      if (activity) {
        // Normalize score and add popularity boost
        const normalizedScore = (score / expandedTokens.length) + (activity.popularityScore * 0.2);
        results.push({ activity, score: normalizedScore });
      }
    }
    
    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.activity);
  }

  /**
   * Category-based filtering
   */
  filterByCategory(category: string): IndexedActivity[] {
    const activityIds = this.index.categoryIndex.get(category.toLowerCase());
    if (!activityIds) return [];
    
    return Array.from(activityIds)
      .map(id => this.index.activities.get(id))
      .filter((activity): activity is IndexedActivity => activity !== undefined)
      .sort((a, b) => (b.categoryScores[category] || 0) - (a.categoryScores[category] || 0));
  }

  /**
   * Time slot filtering
   */
  filterByTimeSlot(timeSlot: string): IndexedActivity[] {
    const activityIds = this.index.timeSlotIndex.get(timeSlot);
    if (!activityIds) return [];
    
    return Array.from(activityIds)
      .map(id => this.index.activities.get(id))
      .filter((activity): activity is IndexedActivity => activity !== undefined)
      .sort((a, b) => b.popularityScore - a.popularityScore);
  }

  /**
   * Tag-based filtering
   */
  filterByTags(tags: string[]): IndexedActivity[] {
    const normalizedTags = tags.map(tag => tag.toLowerCase());
    const activityIds = new Set<string>();
    
    for (const tag of normalizedTags) {
      const tagActivityIds = this.index.tagIndex.get(tag);
      if (tagActivityIds) {
        tagActivityIds.forEach(id => activityIds.add(id));
      }
    }
    
    return Array.from(activityIds)
      .map(id => this.index.activities.get(id))
      .filter((activity): activity is IndexedActivity => activity !== undefined)
      .sort((a, b) => b.popularityScore - a.popularityScore);
  }

  /**
   * Get embedding for similarity search
   */
  getEmbedding(activityId: string): number[] | null {
    return this.index.embeddings.get(activityId) || null;
  }

  /**
   * Get all activities
   */
  getAllActivities(): IndexedActivity[] {
    return Array.from(this.index.activities.values());
  }

  /**
   * Get activity by ID
   */
  getActivity(id: string): IndexedActivity | null {
    return this.index.activities.get(id) || null;
  }

  /**
   * Get index statistics
   */
  getIndexStats(): {
    totalActivities: number;
    totalTokens: number;
    totalCategories: number;
    totalTags: number;
    indexSize: string;
    lastIndexed: Date;
  } {
    const indexSize = JSON.stringify(this.index).length;
    
    return {
      totalActivities: this.index.metadata.totalActivities,
      totalTokens: this.index.tokenIndex.size,
      totalCategories: this.index.categoryIndex.size,
      totalTags: this.index.tagIndex.size,
      indexSize: `${(indexSize / 1024).toFixed(2)} KB`,
      lastIndexed: new Date(this.index.metadata.lastIndexed)
    };
  }

  /**
   * Check if index needs rebuilding
   */
  needsRebuilding(): boolean {
    const age = Date.now() - this.index.metadata.lastIndexed;
    return age > this.CACHE_DURATION || this.index.metadata.version !== this.INDEX_VERSION;
  }
}

// Export singleton instance
export const searchIndexManager = new SearchIndexManager();
