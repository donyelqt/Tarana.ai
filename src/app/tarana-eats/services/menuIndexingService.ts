// ====================================================================
// MENU INDEXING SERVICE
// ====================================================================
// Advanced indexing and search capabilities for menu items
// Implements semantic search, filtering, and intelligent ranking
// ====================================================================

import { MenuItem } from "@/types/tarana-eats";
import { FullMenu, RestaurantData } from "../data/types";

// Extended menu item with additional metadata
export interface IndexedMenuItem extends MenuItem {
  restaurantName: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';
  cuisine: string[];
  tags: string[];
  searchableText: string; // Concatenated searchable fields
  popularity?: number;
  dietaryLabels?: string[];
}

// Search and filter options
export interface MenuSearchOptions {
  category?: string[];
  priceRange?: { min: number; max: number };
  keywords?: string[];
  cuisine?: string[];
  dietary?: string[];
  sortBy?: 'price' | 'popularity' | 'relevance';
  limit?: number;
}

export class MenuIndexingService {
  private static instance: MenuIndexingService;
  private indexedMenus: Map<string, IndexedMenuItem[]> = new Map();
  private globalIndex: IndexedMenuItem[] = [];
  private searchIndex: Map<string, Set<number>> = new Map(); // word -> item indices

  private constructor() {}

  public static getInstance(): MenuIndexingService {
    if (!MenuIndexingService.instance) {
      MenuIndexingService.instance = new MenuIndexingService();
    }
    return MenuIndexingService.instance;
  }

  /**
   * Index all menu items from restaurants for fast searching
   */
  public indexRestaurants(restaurants: RestaurantData[]): void {
    console.log('🔍 Indexing restaurant menus...');
    this.globalIndex = [];
    this.indexedMenus.clear();
    this.searchIndex.clear();

    restaurants.forEach(restaurant => {
      const indexedItems = this.indexRestaurantMenu(restaurant);
      this.indexedMenus.set(restaurant.name, indexedItems);
      this.globalIndex.push(...indexedItems);
    });

    // Build search index for O(1) keyword lookups
    this.buildSearchIndex();
    
    console.log(`✅ Indexed ${this.globalIndex.length} menu items from ${restaurants.length} restaurants`);
  }

  /**
   * Index a single restaurant's menu
   */
  private indexRestaurantMenu(restaurant: RestaurantData): IndexedMenuItem[] {
    const indexed: IndexedMenuItem[] = [];
    const categories: (keyof FullMenu)[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'];

    categories.forEach(category => {
      const items = restaurant.fullMenu[category] || [];
      items.forEach(item => {
        const indexedItem: IndexedMenuItem = {
          ...item,
          restaurantName: restaurant.name,
          category,
          cuisine: restaurant.cuisine,
          tags: restaurant.tags || [],
          searchableText: this.createSearchableText(item, restaurant, category),
          popularity: this.calculatePopularity(item, restaurant),
          dietaryLabels: this.extractDietaryLabels(item, restaurant)
        };
        indexed.push(indexedItem);
      });
    });

    return indexed;
  }

  /**
   * Create searchable text for efficient keyword matching
   */
  private createSearchableText(
    item: MenuItem,
    restaurant: RestaurantData,
    category: string
  ): string {
    return [
      item.name,
      item.description,
      category,
      restaurant.name,
      restaurant.cuisine.join(' '),
      restaurant.tags.join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  /**
   * Calculate popularity score based on various factors
   */
  private calculatePopularity(item: MenuItem, restaurant: RestaurantData): number {
    let score = 50; // Base score

    // Restaurant rating influence
    if (restaurant.ratings) {
      score += restaurant.ratings * 10;
    }

    // Price point influence (mid-range items slightly favored)
    const avgRestaurantPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    const priceDiff = Math.abs(item.price - avgRestaurantPrice);
    score += Math.max(0, 20 - priceDiff / 10);

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Extract dietary labels from item description
   */
  private extractDietaryLabels(item: MenuItem, restaurant: RestaurantData): string[] {
    const labels: string[] = [];
    const text = `${item.name} ${item.description}`.toLowerCase();

    // Check restaurant-level dietary options
    labels.push(...restaurant.dietaryOptions);

    // Check item-level indicators
    if (text.includes('vegetarian') || text.includes('veggie')) labels.push('Vegetarian');
    if (text.includes('vegan')) labels.push('Vegan');
    if (text.includes('halal')) labels.push('Halal');
    if (text.includes('gluten-free') || text.includes('gluten free')) labels.push('Gluten-Free');
    if (text.includes('spicy') || text.includes('hot')) labels.push('Spicy');

    return [...new Set(labels)]; // Remove duplicates
  }

  /**
   * Build inverted index for fast keyword search
   */
  private buildSearchIndex(): void {
    this.globalIndex.forEach((item, index) => {
      const words = item.searchableText.split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) { // Skip very short words
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word)!.add(index);
        }
      });
    });
  }

  /**
   * Search menu items with advanced filtering and ranking
   */
  public searchMenuItems(options: MenuSearchOptions): IndexedMenuItem[] {
    let results = [...this.globalIndex];

    // Filter by category
    if (options.category && options.category.length > 0) {
      results = results.filter(item => 
        options.category!.includes(item.category)
      );
    }

    // Filter by price range
    if (options.priceRange) {
      results = results.filter(item => 
        item.price >= options.priceRange!.min &&
        item.price <= options.priceRange!.max
      );
    }

    // Filter by cuisine
    if (options.cuisine && options.cuisine.length > 0) {
      results = results.filter(item =>
        item.cuisine.some(c => 
          options.cuisine!.some(oc => 
            c.toLowerCase().includes(oc.toLowerCase())
          )
        )
      );
    }

    // Filter by dietary requirements
    if (options.dietary && options.dietary.length > 0) {
      results = results.filter(item =>
        options.dietary!.every(d => 
          item.dietaryLabels?.includes(d)
        )
      );
    }

    // Keyword search using inverted index
    if (options.keywords && options.keywords.length > 0) {
      const matchingIndices = this.findMatchingIndices(options.keywords);
      results = results.filter((_, index) => 
        matchingIndices.has(this.globalIndex.indexOf(results[index]))
      );
    }

    // Sort results
    results = this.sortMenuItems(results, options.sortBy || 'relevance');

    // Limit results
    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Find menu item indices matching keywords using inverted index
   */
  private findMatchingIndices(keywords: string[]): Set<number> {
    const allMatches: Set<number>[] = [];

    keywords.forEach(keyword => {
      const word = keyword.toLowerCase();
      if (this.searchIndex.has(word)) {
        allMatches.push(this.searchIndex.get(word)!);
      }
    });

    if (allMatches.length === 0) return new Set();

    // Return intersection of all matches (AND logic)
    return allMatches.reduce((acc, curr) => {
      const intersection = new Set<number>();
      curr.forEach(index => {
        if (acc.has(index)) intersection.add(index);
      });
      return intersection;
    });
  }

  /**
   * Sort menu items by specified criteria
   */
  private sortMenuItems(
    items: IndexedMenuItem[],
    sortBy: 'price' | 'popularity' | 'relevance'
  ): IndexedMenuItem[] {
    switch (sortBy) {
      case 'price':
        return items.sort((a, b) => a.price - b.price);
      
      case 'popularity':
        return items.sort((a, b) => 
          (b.popularity || 0) - (a.popularity || 0)
        );
      
      case 'relevance':
      default:
        // Relevance sorting combines popularity and other factors
        return items.sort((a, b) => {
          const scoreA = (a.popularity || 0) * 0.7 + (a.price > 0 ? 30 : 0);
          const scoreB = (b.popularity || 0) * 0.7 + (b.price > 0 ? 30 : 0);
          return scoreB - scoreA;
        });
    }
  }

  /**
   * Get menu items for a specific restaurant
   */
  public getRestaurantMenu(restaurantName: string): IndexedMenuItem[] {
    return this.indexedMenus.get(restaurantName) || [];
  }

  /**
   * Get menu items by category across all restaurants
   */
  public getMenuItemsByCategory(category: string): IndexedMenuItem[] {
    return this.globalIndex.filter(item => item.category === category);
  }

  /**
   * Get statistics about indexed menus
   */
  public getIndexStats() {
    const stats = {
      totalItems: this.globalIndex.length,
      totalRestaurants: this.indexedMenus.size,
      categoryCounts: {} as Record<string, number>,
      priceDistribution: {
        budget: 0,      // < 200
        midRange: 0,    // 200-500
        premium: 0      // > 500
      }
    };

    // Calculate category counts
    this.globalIndex.forEach(item => {
      stats.categoryCounts[item.category] = 
        (stats.categoryCounts[item.category] || 0) + 1;

      // Calculate price distribution
      if (item.price < 200) stats.priceDistribution.budget++;
      else if (item.price <= 500) stats.priceDistribution.midRange++;
      else stats.priceDistribution.premium++;
    });

    return stats;
  }
}

// Export singleton instance
export const menuIndexingService = MenuIndexingService.getInstance();
