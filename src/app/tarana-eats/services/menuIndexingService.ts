
import { MenuItem } from "@/types/tarana-eats";
import { FullMenu, RestaurantData } from "../data/types";

export interface IndexedMenuItem extends MenuItem {
  restaurantName: string;
  category: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';
  cuisine: string[];
  tags: string[];
  searchableText: string; 
  popularity?: number;
  dietaryLabels?: string[];
}

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
  private searchIndex: Map<string, Set<number>> = new Map(); 

  private constructor() {}

  public static getInstance(): MenuIndexingService {
    if (!MenuIndexingService.instance) {
      MenuIndexingService.instance = new MenuIndexingService();
    }
    return MenuIndexingService.instance;
  }

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

    this.buildSearchIndex();
    
    console.log(`✅ Indexed ${this.globalIndex.length} menu items from ${restaurants.length} restaurants`);
  }

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

  private calculatePopularity(item: MenuItem, restaurant: RestaurantData): number {
    let score = 50; 

    if (restaurant.ratings) {
      score += restaurant.ratings * 10;
    }

    const avgRestaurantPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    const priceDiff = Math.abs(item.price - avgRestaurantPrice);
    score += Math.max(0, 20 - priceDiff / 10);

    return Math.min(100, Math.max(0, score));
  }

  private extractDietaryLabels(item: MenuItem, restaurant: RestaurantData): string[] {
    const labels: string[] = [];
    const text = `${item.name} ${item.description}`.toLowerCase();

    labels.push(...restaurant.dietaryOptions);

    if (text.includes('vegetarian') || text.includes('veggie')) labels.push('Vegetarian');
    if (text.includes('vegan')) labels.push('Vegan');
    if (text.includes('halal')) labels.push('Halal');
    if (text.includes('gluten-free') || text.includes('gluten free')) labels.push('Gluten-Free');
    if (text.includes('spicy') || text.includes('hot')) labels.push('Spicy');

    return [...new Set(labels)]; 
  }

  private buildSearchIndex(): void {
    this.globalIndex.forEach((item, index) => {
      const words = item.searchableText.split(/\s+/);
      words.forEach(word => {
        if (word.length > 2) { 
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, new Set());
          }
          this.searchIndex.get(word)!.add(index);
        }
      });
    });
  }

  public searchMenuItems(options: MenuSearchOptions): IndexedMenuItem[] {
    let results = [...this.globalIndex];

    if (options.category && options.category.length > 0) {
      results = results.filter(item => 
        options.category!.includes(item.category)
      );
    }

    if (options.priceRange) {
      results = results.filter(item => 
        item.price >= options.priceRange!.min &&
        item.price <= options.priceRange!.max
      );
    }

    if (options.cuisine && options.cuisine.length > 0) {
      results = results.filter(item =>
        item.cuisine.some(c => 
          options.cuisine!.some(oc => 
            c.toLowerCase().includes(oc.toLowerCase())
          )
        )
      );
    }

    if (options.dietary && options.dietary.length > 0) {
      results = results.filter(item =>
        options.dietary!.every(d => 
          item.dietaryLabels?.includes(d)
        )
      );
    }

    if (options.keywords && options.keywords.length > 0) {
      const matchingIndices = this.findMatchingIndices(options.keywords);
      results = results.filter((_, index) => 
        matchingIndices.has(this.globalIndex.indexOf(results[index]))
      );
    }

    results = this.sortMenuItems(results, options.sortBy || 'relevance');

    if (options.limit && options.limit > 0) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  private findMatchingIndices(keywords: string[]): Set<number> {
    const allMatches: Set<number>[] = [];

    keywords.forEach(keyword => {
      const word = keyword.toLowerCase();
      if (this.searchIndex.has(word)) {
        allMatches.push(this.searchIndex.get(word)!);
      }
    });

    if (allMatches.length === 0) return new Set();

    return allMatches.reduce((acc, curr) => {
      const intersection = new Set<number>();
      curr.forEach(index => {
        if (acc.has(index)) intersection.add(index);
      });
      return intersection;
    });
  }

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
        return items.sort((a, b) => {
          const scoreA = (a.popularity || 0) * 0.7 + (a.price > 0 ? 30 : 0);
          const scoreB = (b.popularity || 0) * 0.7 + (b.price > 0 ? 30 : 0);
          return scoreB - scoreA;
        });
    }
  }

  public getRestaurantMenu(restaurantName: string): IndexedMenuItem[] {
    return this.indexedMenus.get(restaurantName) || [];
  }

  public getMenuItemsByCategory(category: string): IndexedMenuItem[] {
    return this.globalIndex.filter(item => item.category === category);
  }

  public getIndexStats() {
    const stats = {
      totalItems: this.globalIndex.length,
      totalRestaurants: this.indexedMenus.size,
      categoryCounts: {} as Record<string, number>,
      priceDistribution: {
        budget: 0,      
        midRange: 0,    
        premium: 0      
      }
    };

    this.globalIndex.forEach(item => {
      stats.categoryCounts[item.category] = 
        (stats.categoryCounts[item.category] || 0) + 1;

      if (item.price < 200) stats.priceDistribution.budget++;
      else if (item.price <= 500) stats.priceDistribution.midRange++;
      else stats.priceDistribution.premium++;
    });

    return stats;
  }
}

export const menuIndexingService = MenuIndexingService.getInstance();
