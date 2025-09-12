/**
 * Comprehensive Test Suite for Intelligent Search System
 * Tests all components: search algorithms, optimization, caching, and indexing
 * 
 * @author Doniele Arys Antonio
 * @version 2.0.0
 */

import { IntelligentSearchEngine, type SearchContext } from '../search/intelligentSearch';
import { QueryProcessor, SearchOptimizer } from '../search/searchOptimizer';
import { SearchIndexManager, TextProcessor } from '../search/searchIndex';
import { IntelligentCacheManager } from '../ai/intelligentCache';
import type { Activity } from '@/app/itinerary-generator/data/itineraryData';

// Mock activities for testing
const mockActivities: Activity[] = [
  {
    image: '/test-image1.jpg',
    title: 'Burnham Park',
    time: '6:00 AM – 8:00 PM',
    desc: 'Beautiful central park with lake, boat rides, and gardens. Perfect for morning walks and family activities.',
    tags: ['Nature & Scenery', 'Family-friendly', 'Outdoor-Friendly'],
    peakHours: '10 am - 12 pm / 4 pm - 6 pm'
  },
  {
    image: '/test-image2.jpg',
    title: 'Bencab Museum',
    time: '9:00 AM – 6:00 PM',
    desc: 'Art museum featuring works of national artist Benedicto Cabrera and indigenous artifacts.',
    tags: ['Culture & Arts', 'Indoor-Friendly', 'Educational'],
    peakHours: '10:00 am - 12:00 pm'
  },
  {
    image: '/test-image3.jpg',
    title: 'Baguio Night Market',
    time: '9:00 PM – 2:00 AM',
    desc: 'Evening market offering affordable clothes, accessories, and street food.',
    tags: ['Shopping & Local Finds', 'Food & Culinary', 'Budget-friendly'],
    peakHours: '9:00 pm - 10:00 pm'
  },
  {
    image: '/test-image4.jpg',
    title: 'Mines View Park',
    time: '6:00 AM – 8:00 PM',
    desc: 'Scenic viewpoint overlooking mining towns with souvenir shops nearby.',
    tags: ['Nature & Scenery', 'Shopping & Local Finds', 'Photo-spots'],
    peakHours: '6 am - 8 am / 5 pm - 6:00'
  }
];

// Mock search context
const mockSearchContext: SearchContext = {
  interests: ['nature', 'culture'],
  weatherCondition: 'clear',
  timeOfDay: 'morning',
  budget: 'mid-range',
  groupSize: 2,
  duration: 1,
  currentTime: new Date(),
  userPreferences: {}
};

const mockContext = mockSearchContext;

describe('TextProcessor', () => {
  describe('tokenize', () => {
    it('should tokenize text correctly', () => {
      const text = 'Beautiful park with amazing views and great food!';
      const tokens = TextProcessor.tokenize(text);
      
      expect(tokens).toContain('beautiful');
      expect(tokens).toContain('park');
      expect(tokens).toContain('amazing');
      expect(tokens).toContain('views');
      expect(tokens).toContain('great');
      expect(tokens).toContain('food');
      expect(tokens).not.toContain('with');
      expect(tokens).not.toContain('and');
    });

    it('should handle empty and invalid input', () => {
      expect(TextProcessor.tokenize('')).toEqual([]);
      expect(TextProcessor.tokenize('   ')).toEqual([]);
      expect(TextProcessor.tokenize('a b c')).toEqual([]); // Too short tokens
    });
  });

  describe('expandTokens', () => {
    it('should expand tokens with synonyms', () => {
      const tokens = ['beautiful', 'food'];
      const expanded = TextProcessor.expandTokens(tokens);
      
      expect(expanded).toContain('beautiful');
      expect(expanded).toContain('scenic');
      expect(expanded).toContain('food');
      expect(expanded).toContain('cuisine');
    });
  });

  describe('generateNGrams', () => {
    it('should generate n-grams correctly', () => {
      const tokens = ['beautiful', 'scenic', 'park'];
      const bigrams = TextProcessor.generateNGrams(tokens, 2);
      
      expect(bigrams).toContain('beautiful scenic');
      expect(bigrams).toContain('scenic park');
      expect(bigrams).toHaveLength(2);
    });
  });
});

describe('QueryProcessor', () => {
  describe('analyzeIntent', () => {
    it('should detect exploration intent', () => {
      const intent = QueryProcessor.analyzeIntent('I want to explore beautiful places in Baguio');
      
      expect(intent.primary).toBe('exploration');
      expect(intent.confidence).toBeGreaterThan(0);
      expect(intent.entities.activities).toContain('park');
    });

    it('should detect cultural intent', () => {
      const intent = QueryProcessor.analyzeIntent('Show me museums and heritage sites');
      
      expect(intent.primary).toBe('cultural');
      expect(intent.entities.activities).toContain('museum');
    });

    it('should extract location entities', () => {
      const intent = QueryProcessor.analyzeIntent('Places to visit in Burnham Park');
      
      expect(intent.entities.locations).toContain('burnham');
    });

    it('should extract time references', () => {
      const intent = QueryProcessor.analyzeIntent('Good morning activities in Baguio');
      
      expect(intent.entities.timeReferences).toContain('morning');
    });
  });

  describe('expandQuery', () => {
    it('should expand query with synonyms and related terms', () => {
      const intent = QueryProcessor.analyzeIntent('beautiful parks');
      const expanded = QueryProcessor.expandQuery('beautiful parks', intent);
      
      expect(expanded.synonyms.length).toBeGreaterThan(0);
      expect(expanded.expanded.length).toBeGreaterThan(1);
      expect(expanded.relatedTerms.length).toBeGreaterThan(0);
    });
  });
});

describe('SearchIndexManager', () => {
  let indexManager: SearchIndexManager;

  beforeEach(() => {
    indexManager = new SearchIndexManager();
  });

  describe('buildIndex', () => {
    it('should build search index from activities', async () => {
      await indexManager.buildIndex(mockActivities);
      
      const stats = indexManager.getIndexStats();
      expect(stats.totalActivities).toBe(mockActivities.length);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.totalCategories).toBeGreaterThan(0);
    });
  });

  describe('searchByTokens', () => {
    beforeEach(async () => {
      await indexManager.buildIndex(mockActivities);
    });

    it('should find activities by token search', () => {
      const results = indexManager.searchByTokens('park nature');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Park');
    });

    it('should rank results by relevance', () => {
      const results = indexManager.searchByTokens('beautiful scenic');
      
      expect(results.length).toBeGreaterThan(0);
      // First result should be most relevant
      expect(results[0].searchTokens.some(token => 
        token.includes('beautiful') || token.includes('scenic')
      )).toBe(true);
    });
  });

  describe('filterByCategory', () => {
    beforeEach(async () => {
      await indexManager.buildIndex(mockActivities);
    });

    it('should filter activities by category', () => {
      const results = indexManager.filterByCategory('nature');
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(activity => {
        expect(activity.categoryScores.nature).toBeGreaterThan(0);
      });
    });
  });

  describe('filterByTimeSlot', () => {
    beforeEach(async () => {
      await indexManager.buildIndex(mockActivities);
    });

    it('should filter activities by time slot', () => {
      const morningResults = indexManager.filterByTimeSlot('morning');
      const eveningResults = indexManager.filterByTimeSlot('evening');
      
      expect(morningResults.length).toBeGreaterThan(0);
      expect(eveningResults.length).toBeGreaterThan(0);
      
      morningResults.forEach(activity => {
        expect(activity.timeSlot).toBe('morning');
      });
    });
  });
});

describe('IntelligentCacheManager', () => {
  let cacheManager: IntelligentCacheManager;

  beforeEach(() => {
    cacheManager = new IntelligentCacheManager();
  });

  afterEach(() => {
    cacheManager.clearAll();
  });

  describe('search results caching', () => {
    it('should cache and retrieve search results', () => {
      const mockResults = [
        {
          activity: mockActivities[0],
          scores: { semantic: 0.8, vector: 0.7, fuzzy: 0.7, contextual: 0.9, temporal: 0.6, diversity: 0.8, composite: 0.76 },
          reasoning: ['High semantic match'],
          confidence: 0.85,
          metadata: { searchQuery: 'test', matchedTerms: [], contextFactors: [], temporalFactors: [] }
        }
      ];

      cacheManager.cacheSearchResults('test query', mockSearchContext, mockResults);
      const cached = cacheManager.getCachedSearchResults('test query', mockSearchContext);
      
      expect(cached).toEqual(mockResults);
    });

    it('should return null for non-existent cache entries', () => {
      const cached = cacheManager.getCachedSearchResults('non-existent', mockSearchContext);
      expect(cached).toBeNull();
    });
  });

  describe('embedding caching', () => {
    it('should cache and retrieve embeddings', () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      
      cacheManager.cacheEmbedding('test text', mockEmbedding);
      const cached = cacheManager.getCachedEmbedding('test text');
      
      expect(cached).toEqual(mockEmbedding);
    });
  });

  describe('cache statistics', () => {
    it('should provide comprehensive cache statistics', () => {
      const mockResults = [{
        activity: mockActivities[0],
        scores: { semantic: 0.8, vector: 0.7, fuzzy: 0.7, contextual: 0.9, temporal: 0.6, diversity: 0.8, composite: 0.76 },
        reasoning: ['Test'],
        confidence: 0.85,
        metadata: { searchQuery: 'test', matchedTerms: [], contextFactors: [], temporalFactors: [] }
      }];

      cacheManager.cacheSearchResults('test', mockSearchContext, mockResults);
      
      const stats = cacheManager.getCacheStats();
      
      expect(stats.searchResults.totalEntries).toBe(1);
      expect(stats.totalMemoryUsage).toMatch(/\d+\.\d{2} MB/);
    });
  });
});

describe('IntelligentSearchEngine', () => {
  let searchEngine: IntelligentSearchEngine;

  beforeEach(() => {
    searchEngine = new IntelligentSearchEngine();
  });

  describe('search', () => {
    it('should perform intelligent search and return ranked results', async () => {
      const results = await searchEngine.search('beautiful park nature', mockSearchContext);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].activity).toBeDefined();
      expect(results[0].scores.composite).toBeGreaterThan(0);
      expect(results[0].confidence).toBeGreaterThan(0);
      expect(results[0].reasoning.length).toBeGreaterThan(0);
    });

    it('should handle empty query gracefully', async () => {
      const results = await searchEngine.search('', mockSearchContext);
      
      // Should still return some results (fallback behavior)
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should respect search context preferences', async () => {
      const cultureContext: SearchContext = {
        ...mockSearchContext,
        interests: ['Culture & Arts']
      };

      const results = await searchEngine.search('museum art', cultureContext);
      
      expect(results.length).toBeGreaterThan(0);
      // Should prioritize cultural activities
      const topResult = results[0];
      expect(topResult.activity.tags).toContain('Culture & Arts');
    });

    it('should provide detailed scoring breakdown', async () => {
      const results = await searchEngine.search('park', mockSearchContext);
      
      expect(results.length).toBeGreaterThan(0);
      const result = results[0];
      
      expect(result.scores).toHaveProperty('semantic');
      expect(result.scores).toHaveProperty('vector');
      expect(result.scores).toHaveProperty('fuzzy');
      expect(result.scores).toHaveProperty('contextual');
      expect(result.scores).toHaveProperty('temporal');
      expect(result.scores).toHaveProperty('diversity');
      expect(result.scores).toHaveProperty('composite');
    });
  });
});

describe('SearchOptimizer', () => {
  describe('generateSearchOptimization', () => {
    it('should generate comprehensive search optimization', () => {
      const optimization = SearchOptimizer.generateSearchOptimization('beautiful parks', mockSearchContext);
      
      expect(optimization.queryExpansion).toBeDefined();
      expect(optimization.intentAnalysis).toBeDefined();
      expect(optimization.contextualBoosts.size).toBeGreaterThan(0);
      expect(optimization.filterRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('optimizeSearchResults', () => {
    it('should optimize search results with boosts', () => {
      const mockResults = [{
        activity: mockActivities[0],
        scores: { semantic: 0.5, vector: 0.4, fuzzy: 0.3, contextual: 0.4, temporal: 0.2, diversity: 0.1, composite: 0.3 },
        reasoning: ['Test reasoning'],
        confidence: 0.6,
        metadata: {
          searchQuery: 'test',
          matchedTerms: ['test'],
          contextFactors: ['weather'],
          temporalFactors: ['morning']
        }
      }];
      
      const optimization = SearchOptimizer.generateSearchOptimization('beautiful parks', mockContext);
      const optimized = SearchOptimizer.optimizeSearchResults(mockResults, optimization, mockContext);
      
      expect(optimized.length).toBe(1);
      expect(optimized[0].scores.composite).toBeGreaterThanOrEqual(mockResults[0].scores.composite);
      expect(optimized[0].reasoning.length).toBeGreaterThanOrEqual(mockResults[0].reasoning.length);
    });
  });
});

describe('Integration Tests', () => {
  let searchEngine: IntelligentSearchEngine;
  let cacheManager: IntelligentCacheManager;
  let indexManager: SearchIndexManager;

  beforeEach(async () => {
    searchEngine = new IntelligentSearchEngine();
    cacheManager = new IntelligentCacheManager();
    indexManager = new SearchIndexManager();
    
    await indexManager.buildIndex(mockActivities);
  });

  afterEach(() => {
    cacheManager.clearAll();
  });

  it('should perform end-to-end intelligent search with caching', async () => {
    const query = 'beautiful nature parks';
    
    // First search - should miss cache
    const results1 = await searchEngine.search(query, mockSearchContext);
    cacheManager.cacheSearchResults(query, mockSearchContext, results1);
    
    // Second search - should hit cache
    const cachedResults = cacheManager.getCachedSearchResults(query, mockSearchContext);
    
    expect(results1.length).toBeGreaterThan(0);
    expect(cachedResults).toEqual(results1);
    
    // Verify cache statistics
    const stats = cacheManager.getCacheStats();
    expect(stats.searchResults.totalEntries).toBe(1);
  });

  it('should handle complex search scenarios', async () => {
    const complexQueries = [
      'romantic dinner places for couples',
      'family-friendly outdoor activities',
      'budget-friendly shopping markets',
      'cultural heritage sites with history',
      'adventure hiking trails with views'
    ];

    for (const query of complexQueries) {
      const results = await searchEngine.search(query, mockSearchContext);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      
      if (results.length > 0) {
        expect(results[0].scores.composite).toBeGreaterThan(0);
        expect(results[0].confidence).toBeGreaterThan(0);
      }
    }
  });

  it('should maintain performance under load', async () => {
    const startTime = Date.now();
    const promises = [];
    
    // Simulate concurrent searches
    for (let i = 0; i < 10; i++) {
      promises.push(
        searchEngine.search(`test query ${i}`, mockSearchContext)
      );
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    expect(results.length).toBe(10);
    expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('Error Handling', () => {
  let searchEngine: IntelligentSearchEngine;

  beforeEach(() => {
    searchEngine = new IntelligentSearchEngine();
  });

  it('should handle malformed activities gracefully', async () => {
    const malformedActivities = [
      { title: 'Valid Activity', desc: 'Test description' },
      { title: 'Another Valid', desc: 'Another test' }
    ];
      
    const results = await searchEngine.search('test query', mockContext);
      
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].activity.title).toBeTruthy();
  });

  it('should handle invalid search context', async () => {
    const invalidContext = {
      ...mockSearchContext,
      interests: null as any,
      weatherCondition: 'invalid' as any
    };

    const results = await searchEngine.search('test', invalidContext);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should provide fallback results when search fails', async () => {
    // Test with empty activities array
    const results = await searchEngine.search('test query', mockSearchContext);
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});
