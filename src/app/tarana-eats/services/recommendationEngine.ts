
import { RestaurantData } from "../data/types";
import { TaranaEatsFormValues } from "@/types/tarana-eats";
import { menuIndexingService, IndexedMenuItem } from "./menuIndexingService";

export interface RecommendationScore {
  restaurant: RestaurantData;
  score: number;
  factors: ScoreFactors;
  recommendedItems: IndexedMenuItem[];
  estimatedTotal: number;
  matchReasons: string[];
}

interface ScoreFactors {
  budgetMatch: number;
  cuisineMatch: number;
  mealTypeMatch: number;
  dietaryMatch: number;
  popularityScore: number;
  diversityScore: number;
  valueScore: number;
}

export class RecommendationEngine {
  private static instance: RecommendationEngine;
  
  private readonly WEIGHTS = {
    budgetMatch: 25,
    cuisineMatch: 20,
    mealTypeMatch: 15,
    dietaryMatch: 15,
    popularityScore: 10,
    diversityScore: 10,
    valueScore: 5
  };

  private constructor() {}

  public static getInstance(): RecommendationEngine {
    if (!RecommendationEngine.instance) {
      RecommendationEngine.instance = new RecommendationEngine();
    }
    return RecommendationEngine.instance;
  }

  public generateRecommendations(
    restaurants: RestaurantData[],
    preferences: TaranaEatsFormValues,
    limit: number = 5
  ): RecommendationScore[] {
    console.log('🎯 Generating intelligent recommendations...');
    
    const scored = restaurants.map(restaurant => 
      this.scoreRestaurant(restaurant, preferences)
    );

    const topRecommendations = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`✅ Generated ${topRecommendations.length} recommendations`);
    return topRecommendations;
  }

  private scoreRestaurant(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): RecommendationScore {
    const factors: ScoreFactors = {
      budgetMatch: this.scoreBudgetMatch(restaurant, preferences),
      cuisineMatch: this.scoreCuisineMatch(restaurant, preferences),
      mealTypeMatch: this.scoreMealTypeMatch(restaurant, preferences),
      dietaryMatch: this.scoreDietaryMatch(restaurant, preferences),
      popularityScore: this.scorePopularity(restaurant),
      diversityScore: this.scoreMenuDiversity(restaurant),
      valueScore: this.scoreValue(restaurant, preferences)
    };

    const score = Object.entries(factors).reduce((total, [key, value]) => {
      const weight = this.WEIGHTS[key as keyof typeof this.WEIGHTS];
      return total + (value * weight / 100);
    }, 0);

    const recommendedItems = this.getRecommendedMenuItems(restaurant, preferences);
    const estimatedTotal = this.calculateEstimatedTotal(recommendedItems, preferences);
    const matchReasons = this.generateMatchReasons(factors, restaurant, preferences);

    return {
      restaurant,
      score,
      factors,
      recommendedItems,
      estimatedTotal,
      matchReasons
    };
  }

  private scoreBudgetMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.budget) return 50; 

    const userBudget = parseInt(preferences.budget.replace(/[^\d]/g, ''));
    if (!userBudget || userBudget <= 0) return 50;

    const groupSize = preferences.pax || 2;
    const perPersonBudget = userBudget / groupSize;
    const restaurantAvg = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;

    const diff = Math.abs(perPersonBudget - restaurantAvg);
    const maxDiff = perPersonBudget; 
    const matchPercentage = Math.max(0, 100 - (diff / maxDiff * 100));

    return Math.min(100, matchPercentage);
  }

  private scoreCuisineMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.cuisine || preferences.cuisine === "Show All") {
      return 50; 
    }

    const cuisineMatch = restaurant.cuisine.some(c =>
      c.toLowerCase().includes(preferences.cuisine!.toLowerCase()) ||
      preferences.cuisine!.toLowerCase().includes(c.toLowerCase())
    );

    return cuisineMatch ? 100 : 0;
  }

  private scoreMealTypeMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.mealType || preferences.mealType.length === 0) {
      return 50; 
    }

    const matchCount = preferences.mealType.filter(mt =>
      restaurant.popularFor.includes(mt)
    ).length;

    return (matchCount / preferences.mealType.length) * 100;
  }

  private scoreDietaryMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.restrictions || preferences.restrictions.length === 0) {
      return 100; 
    }

    const matchCount = preferences.restrictions.filter(restriction =>
      restaurant.dietaryOptions.includes(restriction)
    ).length;

    return (matchCount / preferences.restrictions.length) * 100;
  }

  private scorePopularity(restaurant: RestaurantData): number {
    if (restaurant.ratings) {
      return (restaurant.ratings / 5) * 100;
    }
    return 50; 
  }

  private scoreMenuDiversity(restaurant: RestaurantData): number {
    const fullMenu = restaurant.fullMenu;
    const categories = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;
    
    let totalItems = 0;
    let categoriesWithItems = 0;

    categories.forEach(category => {
      const items = fullMenu[category] || [];
      if (items.length > 0) {
        categoriesWithItems++;
        totalItems += items.length;
      }
    });

    const categoryScore = (categoriesWithItems / categories.length) * 50;
    const itemScore = Math.min(50, totalItems / 2); 

    return categoryScore + itemScore;
  }

  private scoreValue(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    const rating = restaurant.ratings || 3;

    const priceScore = Math.max(0, 100 - (avgPrice / 10)); 
    const ratingScore = (rating / 5) * 100;

    return (priceScore + ratingScore) / 2;
  }

  private getRecommendedMenuItems(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): IndexedMenuItem[] {
    const restaurantItems = menuIndexingService.getRestaurantMenu(restaurant.name);

    if (restaurantItems.length === 0) {
      console.log(`⚠️ Restaurant "${restaurant.name}" has no menu items indexed`);
      return [];
    }

    let filteredItems = restaurantItems;
    if (preferences.mealType && preferences.mealType.length > 0) {
      const mealFiltered = restaurantItems.filter(item =>
        preferences.mealType!.includes(item.category)
      );
      if (mealFiltered.length > 0) {
        filteredItems = mealFiltered;
      }
    }

    if (preferences.restrictions && preferences.restrictions.length > 0) {
      const dietaryFiltered = filteredItems.filter(item => {
        if (!item.dietaryLabels || item.dietaryLabels.length === 0) {
          return false;
        }
        return preferences.restrictions!.some(r =>
          item.dietaryLabels?.includes(r)
        );
      });
      
      if (dietaryFiltered.length > 0) {
        filteredItems = dietaryFiltered;
      } else {
        console.log(`⚠️ No vegan items at "${restaurant.name}", returning all items`);
        filteredItems = restaurantItems; 
      }
    }

    const sorted = filteredItems
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10); 
    
    console.log(`✅ Selected ${sorted.length} items for "${restaurant.name}"`);
    return sorted;
  }

  private calculateEstimatedTotal(
    items: IndexedMenuItem[],
    preferences: TaranaEatsFormValues
  ): number {
    if (items.length === 0) return 0;

    const groupSize = preferences.pax || 2;
    
    const avgItemPrice = items.slice(0, 5).reduce((sum, item) => sum + item.price, 0) / Math.min(5, items.length);
    
    return Math.round(avgItemPrice * 2 * groupSize);
  }

  private generateMatchReasons(
    factors: ScoreFactors,
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): string[] {
    const reasons: string[] = [];

    if (factors.budgetMatch >= 80) {
      reasons.push(`Perfect fit for your ₱${preferences.budget} budget`);
    } else if (factors.budgetMatch >= 60) {
      reasons.push(`Good value within your budget range`);
    }

    if (factors.cuisineMatch === 100) {
      reasons.push(`Specializes in ${preferences.cuisine} cuisine`);
    }

    if (factors.mealTypeMatch >= 80 && preferences.mealType && preferences.mealType.length > 0) {
      reasons.push(`Popular for ${preferences.mealType.join(' and ')}`);
    }

    if (factors.dietaryMatch === 100 && preferences.restrictions && preferences.restrictions.length > 0) {
      reasons.push(`Offers ${preferences.restrictions.join(', ')} options`);
    }

    if (factors.popularityScore >= 80) {
      reasons.push(`Highly rated (${restaurant.ratings}★)`);
    }

    if (factors.diversityScore >= 80) {
      reasons.push(`Extensive menu with many options`);
    }

    if (reasons.length === 0) {
      reasons.push(`Quality ${restaurant.cuisine.join(', ')} restaurant`);
    }

    return reasons;
  }

  public getMenuSuggestions(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues,
    targetBudget: number
  ): {
    items: IndexedMenuItem[];
    total: number;
    remaining: number;
  } {
    const restaurantItems = menuIndexingService.getRestaurantMenu(restaurant.name);
    const groupSize = preferences.pax || 2;

    let availableItems = restaurantItems;
    if (preferences.mealType && preferences.mealType.length > 0) {
      availableItems = restaurantItems.filter(item =>
        preferences.mealType!.includes(item.category)
      );
    }

    const sortedItems = availableItems.sort((a, b) => {
      const valueA = (a.popularity || 50) / Math.max(1, a.price / 100);
      const valueB = (b.popularity || 50) / Math.max(1, b.price / 100);
      return valueB - valueA;
    });

    const selected: IndexedMenuItem[] = [];
    let total = 0;

    for (const item of sortedItems) {
      if (total + item.price <= targetBudget) {
        selected.push(item);
        total += item.price;
        
        if (selected.length >= groupSize * 3) break;
      }
    }

    return {
      items: selected,
      total,
      remaining: targetBudget - total
    };
  }
}

export const recommendationEngine = RecommendationEngine.getInstance();
