// ====================================================================
// RECOMMENDATION ENGINE
// ====================================================================
// Advanced recommendation system with multi-factor scoring
// Combines menu data, user preferences, and AI insights
// ====================================================================

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
  
  // Weight configuration for scoring (totals to 100)
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

  /**
   * Generate recommendations based on user preferences
   */
  public generateRecommendations(
    restaurants: RestaurantData[],
    preferences: TaranaEatsFormValues,
    limit: number = 5
  ): RecommendationScore[] {
    console.log('🎯 Generating intelligent recommendations...');
    
    // Score all restaurants
    const scored = restaurants.map(restaurant => 
      this.scoreRestaurant(restaurant, preferences)
    );

    // Sort by total score and return top matches
    const topRecommendations = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`✅ Generated ${topRecommendations.length} recommendations`);
    return topRecommendations;
  }

  /**
   * Score a single restaurant based on all factors
   */
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

    // Calculate weighted total score
    const score = Object.entries(factors).reduce((total, [key, value]) => {
      const weight = this.WEIGHTS[key as keyof typeof this.WEIGHTS];
      return total + (value * weight / 100);
    }, 0);

    // Get recommended menu items
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

  /**
   * Score budget compatibility (0-100)
   */
  private scoreBudgetMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.budget) return 50; // Neutral score if no budget specified

    const userBudget = parseInt(preferences.budget.replace(/[^\d]/g, ''));
    if (!userBudget || userBudget <= 0) return 50;

    const groupSize = preferences.pax || 2;
    const perPersonBudget = userBudget / groupSize;
    const restaurantAvg = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;

    // Calculate match percentage
    const diff = Math.abs(perPersonBudget - restaurantAvg);
    const maxDiff = perPersonBudget; // Maximum acceptable difference
    const matchPercentage = Math.max(0, 100 - (diff / maxDiff * 100));

    return Math.min(100, matchPercentage);
  }

  /**
   * Score cuisine preference match (0-100)
   */
  private scoreCuisineMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.cuisine || preferences.cuisine === "Show All") {
      return 50; // Neutral score
    }

    const cuisineMatch = restaurant.cuisine.some(c =>
      c.toLowerCase().includes(preferences.cuisine!.toLowerCase()) ||
      preferences.cuisine!.toLowerCase().includes(c.toLowerCase())
    );

    return cuisineMatch ? 100 : 0;
  }

  /**
   * Score meal type compatibility (0-100)
   */
  private scoreMealTypeMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.mealType || preferences.mealType.length === 0) {
      return 50; // Neutral score
    }

    // Check if restaurant is popular for requested meal types
    const matchCount = preferences.mealType.filter(mt =>
      restaurant.popularFor.includes(mt)
    ).length;

    return (matchCount / preferences.mealType.length) * 100;
  }

  /**
   * Score dietary requirements match (0-100)
   */
  private scoreDietaryMatch(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    if (!preferences.restrictions || preferences.restrictions.length === 0) {
      return 100; // Perfect score if no restrictions
    }

    const matchCount = preferences.restrictions.filter(restriction =>
      restaurant.dietaryOptions.includes(restriction)
    ).length;

    return (matchCount / preferences.restrictions.length) * 100;
  }

  /**
   * Score restaurant popularity (0-100)
   */
  private scorePopularity(restaurant: RestaurantData): number {
    if (restaurant.ratings) {
      return (restaurant.ratings / 5) * 100;
    }
    return 50; // Neutral score if no ratings
  }

  /**
   * Score menu diversity (0-100)
   */
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

    // Score based on both category coverage and total items
    const categoryScore = (categoriesWithItems / categories.length) * 50;
    const itemScore = Math.min(50, totalItems / 2); // 1 point per 2 items, max 50

    return categoryScore + itemScore;
  }

  /**
   * Score value for money (0-100)
   */
  private scoreValue(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): number {
    const avgPrice = (restaurant.priceRange.min + restaurant.priceRange.max) / 2;
    const rating = restaurant.ratings || 3;

    // Calculate value score: high rating + reasonable price = high value
    const priceScore = Math.max(0, 100 - (avgPrice / 10)); // Lower price = higher score
    const ratingScore = (rating / 5) * 100;

    return (priceScore + ratingScore) / 2;
  }

  /**
   * Get recommended menu items for a restaurant
   */
  private getRecommendedMenuItems(
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): IndexedMenuItem[] {
    const restaurantItems = menuIndexingService.getRestaurantMenu(restaurant.name);

    // Filter by meal type if specified
    let filteredItems = restaurantItems;
    if (preferences.mealType && preferences.mealType.length > 0) {
      filteredItems = restaurantItems.filter(item =>
        preferences.mealType!.includes(item.category)
      );
    }

    // Filter by dietary requirements
    if (preferences.restrictions && preferences.restrictions.length > 0) {
      filteredItems = filteredItems.filter(item =>
        preferences.restrictions!.every(r =>
          item.dietaryLabels?.includes(r)
        )
      );
    }

    // Sort by popularity and return top items
    return filteredItems
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 10); // Top 10 items per restaurant
  }

  /**
   * Calculate estimated total cost
   */
  private calculateEstimatedTotal(
    items: IndexedMenuItem[],
    preferences: TaranaEatsFormValues
  ): number {
    if (items.length === 0) return 0;

    const groupSize = preferences.pax || 2;
    
    // Estimate based on average price of top items
    const avgItemPrice = items.slice(0, 5).reduce((sum, item) => sum + item.price, 0) / Math.min(5, items.length);
    
    // Estimate 2 items per person as baseline
    return Math.round(avgItemPrice * 2 * groupSize);
  }

  /**
   * Generate human-readable match reasons
   */
  private generateMatchReasons(
    factors: ScoreFactors,
    restaurant: RestaurantData,
    preferences: TaranaEatsFormValues
  ): string[] {
    const reasons: string[] = [];

    // Budget match
    if (factors.budgetMatch >= 80) {
      reasons.push(`Perfect fit for your ₱${preferences.budget} budget`);
    } else if (factors.budgetMatch >= 60) {
      reasons.push(`Good value within your budget range`);
    }

    // Cuisine match
    if (factors.cuisineMatch === 100) {
      reasons.push(`Specializes in ${preferences.cuisine} cuisine`);
    }

    // Meal type match
    if (factors.mealTypeMatch >= 80 && preferences.mealType && preferences.mealType.length > 0) {
      reasons.push(`Popular for ${preferences.mealType.join(' and ')}`);
    }

    // Dietary match
    if (factors.dietaryMatch === 100 && preferences.restrictions && preferences.restrictions.length > 0) {
      reasons.push(`Offers ${preferences.restrictions.join(', ')} options`);
    }

    // Popularity
    if (factors.popularityScore >= 80) {
      reasons.push(`Highly rated (${restaurant.ratings}★)`);
    }

    // Diversity
    if (factors.diversityScore >= 80) {
      reasons.push(`Extensive menu with many options`);
    }

    // Fallback reason
    if (reasons.length === 0) {
      reasons.push(`Quality ${restaurant.cuisine.join(', ')} restaurant`);
    }

    return reasons;
  }

  /**
   * Get personalized menu suggestions based on budget allocation
   */
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

    // Filter by meal type
    let availableItems = restaurantItems;
    if (preferences.mealType && preferences.mealType.length > 0) {
      availableItems = restaurantItems.filter(item =>
        preferences.mealType!.includes(item.category)
      );
    }

    // Sort by value (price/popularity ratio)
    const sortedItems = availableItems.sort((a, b) => {
      const valueA = (a.popularity || 50) / Math.max(1, a.price / 100);
      const valueB = (b.popularity || 50) / Math.max(1, b.price / 100);
      return valueB - valueA;
    });

    // Greedy algorithm to select items within budget
    const selected: IndexedMenuItem[] = [];
    let total = 0;

    for (const item of sortedItems) {
      if (total + item.price <= targetBudget) {
        selected.push(item);
        total += item.price;
        
        // Stop if we have enough items (2-3 per person)
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

// Export singleton instance
export const recommendationEngine = RecommendationEngine.getInstance();
