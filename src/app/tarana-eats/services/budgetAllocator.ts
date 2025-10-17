// ====================================================================
// BUDGET ALLOCATION SERVICE
// ====================================================================
// Intelligent budget allocation across menu items
// Optimizes selection for best value and satisfaction
// ====================================================================

import { IndexedMenuItem } from "./menuIndexingService";
import { TaranaEatsFormValues } from "@/types/tarana-eats";

export interface BudgetAllocation {
  selectedItems: IndexedMenuItem[];
  totalCost: number;
  remainingBudget: number;
  utilizationRate: number; // Percentage of budget used
  valueScore: number; // Overall value score
  nutritionalBalance: number; // How well balanced the selection is
  recommendations: string[];
}

export interface AllocationConstraints {
  minItemsPerPerson?: number;
  maxItemsPerPerson?: number;
  preferredCategories?: string[];
  avoidCategories?: string[];
  prioritizePopular?: boolean;
}

export class BudgetAllocator {
  private static instance: BudgetAllocator;

  private constructor() {}

  public static getInstance(): BudgetAllocator {
    if (!BudgetAllocator.instance) {
      BudgetAllocator.instance = new BudgetAllocator();
    }
    return BudgetAllocator.instance;
  }

  /**
   * Allocate budget optimally across menu items
   * Uses dynamic programming approach for optimal selection
   */
  public allocateBudget(
    availableItems: IndexedMenuItem[],
    totalBudget: number,
    groupSize: number,
    preferences?: TaranaEatsFormValues,
    constraints?: AllocationConstraints
  ): BudgetAllocation {
    console.log('💰 Allocating budget intelligently...');

    // Apply constraints and filters
    let eligibleItems = this.filterItemsByConstraints(
      availableItems,
      preferences,
      constraints
    );

    // Calculate optimal selection using value-based algorithm
    const selected = this.selectOptimalItems(
      eligibleItems,
      totalBudget,
      groupSize,
      constraints
    );

    const totalCost = selected.reduce((sum, item) => sum + item.price, 0);
    const utilizationRate = (totalCost / totalBudget) * 100;
    const valueScore = this.calculateValueScore(selected);
    const nutritionalBalance = this.calculateNutritionalBalance(selected);
    const recommendations = this.generateRecommendations(
      selected,
      totalBudget,
      totalCost,
      groupSize
    );

    console.log(`✅ Selected ${selected.length} items using ${utilizationRate.toFixed(1)}% of budget`);

    return {
      selectedItems: selected,
      totalCost,
      remainingBudget: totalBudget - totalCost,
      utilizationRate,
      valueScore,
      nutritionalBalance,
      recommendations
    };
  }

  /**
   * Filter items based on constraints and preferences
   */
  private filterItemsByConstraints(
    items: IndexedMenuItem[],
    preferences?: TaranaEatsFormValues,
    constraints?: AllocationConstraints
  ): IndexedMenuItem[] {
    let filtered = [...items];

    // Filter by meal type preferences
    if (preferences?.mealType && preferences.mealType.length > 0) {
      filtered = filtered.filter(item =>
        preferences.mealType!.includes(item.category)
      );
    }

    // Filter by dietary restrictions
    if (preferences?.restrictions && preferences.restrictions.length > 0) {
      filtered = filtered.filter(item =>
        preferences.restrictions!.every(r =>
          item.dietaryLabels?.includes(r)
        )
      );
    }

    // Apply category constraints
    if (constraints?.avoidCategories && constraints.avoidCategories.length > 0) {
      filtered = filtered.filter(item =>
        !constraints.avoidCategories!.includes(item.category)
      );
    }

    return filtered;
  }

  /**
   * Select optimal items using value-based greedy algorithm with diversity
   */
  private selectOptimalItems(
    items: IndexedMenuItem[],
    budget: number,
    groupSize: number,
    constraints?: AllocationConstraints
  ): IndexedMenuItem[] {
    // Calculate value score for each item
    const itemsWithValue = items.map(item => ({
      item,
      value: this.calculateItemValue(item),
      efficiencyRatio: (item.popularity || 50) / Math.max(1, item.price)
    }));

    // Sort by efficiency ratio (bang for buck)
    const sorted = itemsWithValue.sort((a, b) => b.efficiencyRatio - a.efficiencyRatio);

    const selected: IndexedMenuItem[] = [];
    let currentCost = 0;
    const categoryCount: Record<string, number> = {};

    const minItems = constraints?.minItemsPerPerson || 2;
    const maxItems = constraints?.maxItemsPerPerson || 6; // Increased from 4 to 6
    const targetUtilization = 0.75; // Target 75% budget utilization
    const maxUtilization = 0.90; // Maximum 90% budget utilization

    // More aggressive target: aim for budget utilization, not just item count
    const targetItems = Math.floor((minItems + maxItems) / 2) * groupSize;

    for (const { item } of sorted) {
      const utilizationRate = (currentCost / budget);
      
      // Stop if we've exceeded target budget utilization
      if (utilizationRate >= maxUtilization) {
        break;
      }

      // Check if adding this item exceeds budget
      if (currentCost + item.price > budget) {
        continue;
      }

      // Check if we've reached max items
      if (selected.length >= maxItems * groupSize) {
        break;
      }

      // Promote diversity: limit items per category
      const catCount = categoryCount[item.category] || 0;
      const maxPerCategory = Math.ceil(targetItems / 3); // Max 1/3 from same category
      if (catCount >= maxPerCategory && utilizationRate < targetUtilization) {
        // Relax category constraint if we haven't hit target budget
        if (catCount >= maxPerCategory * 1.5) {
          continue;
        }
      } else if (catCount >= maxPerCategory) {
        continue;
      }

      // Add item to selection
      selected.push(item);
      currentCost += item.price;
      categoryCount[item.category] = catCount + 1;

      // Continue until we hit target utilization
      // Only stop if we have minimum items AND hit target utilization
      if (selected.length >= minItems * groupSize && utilizationRate >= targetUtilization) {
        // We have enough items and good budget utilization - but continue a bit more
        if (selected.length >= targetItems && utilizationRate >= targetUtilization) break;
      }
    }

    // Ensure we have minimum items
    if (selected.length < minItems * groupSize) {
      // Add more affordable items to reach minimum
      const remaining = items.filter(item => 
        !selected.includes(item) && 
        currentCost + item.price <= budget
      ).sort((a, b) => a.price - b.price);

      for (const item of remaining) {
        if (selected.length >= minItems * groupSize) break;
        if (currentCost + item.price <= budget) {
          selected.push(item);
          currentCost += item.price;
        }
      }
    }

    return selected;
  }

  /**
   * Calculate value score for an item
   */
  private calculateItemValue(item: IndexedMenuItem): number {
    let value = 0;

    // Popularity factor (0-50 points)
    value += (item.popularity || 50) * 0.5;

    // Price efficiency (0-30 points) - lower relative price = higher value
    const priceScore = Math.max(0, 30 - (item.price / 50));
    value += priceScore;

    // Category bonus (0-20 points)
    if (item.category === 'Lunch' || item.category === 'Dinner') {
      value += 20; // Main meals are prioritized
    } else if (item.category === 'Breakfast') {
      value += 15;
    } else if (item.category === 'Drinks') {
      value += 10; // Drinks are lower priority
    }

    return value;
  }

  /**
   * Calculate overall value score for selected items
   */
  private calculateValueScore(items: IndexedMenuItem[]): number {
    if (items.length === 0) return 0;

    const avgValue = items.reduce((sum, item) => 
      sum + this.calculateItemValue(item), 0
    ) / items.length;

    return Math.min(100, avgValue);
  }

  /**
   * Calculate nutritional balance (diversity of selection)
   */
  private calculateNutritionalBalance(items: IndexedMenuItem[]): number {
    if (items.length === 0) return 0;

    const categoryCount: Record<string, number> = {};
    items.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });

    const categories = Object.keys(categoryCount).length;
    const maxCategories = 5; // Breakfast, Lunch, Dinner, Snacks, Drinks

    // Score based on category diversity
    const diversityScore = (categories / maxCategories) * 70;

    // Score based on even distribution
    const values = Object.values(categoryCount);
    const avgCount = items.length / categories;
    const variance = values.reduce((sum, count) => 
      sum + Math.pow(count - avgCount, 2), 0
    ) / values.length;
    const evenScore = Math.max(0, 30 - variance * 5);

    return Math.min(100, diversityScore + evenScore);
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    selected: IndexedMenuItem[],
    budget: number,
    spent: number,
    groupSize: number
  ): string[] {
    const recommendations: string[] = [];
    const utilizationRate = (spent / budget) * 100;

    // Budget utilization recommendations
    if (utilizationRate < 60) {
      recommendations.push(`You're only using ${utilizationRate.toFixed(0)}% of your budget. Consider adding more items or drinks.`);
    } else if (utilizationRate > 95) {
      recommendations.push(`Great budget utilization at ${utilizationRate.toFixed(0)}%!`);
    } else {
      recommendations.push(`Good budget management with ${(budget - spent).toFixed(0)}₱ remaining for adjustments.`);
    }

    // Category distribution recommendations
    const categoryCount: Record<string, number> = {};
    selected.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });

    const hasMainMeal = categoryCount['Lunch'] || categoryCount['Dinner'];
    if (!hasMainMeal && budget - spent > 200) {
      recommendations.push('Consider adding a main meal for a more complete dining experience.');
    }

    const hasDrinks = categoryCount['Drinks'];
    if (!hasDrinks && budget - spent > 100) {
      recommendations.push('Add drinks to complement your meal.');
    }

    // Group size recommendations
    const itemsPerPerson = selected.length / groupSize;
    if (itemsPerPerson < 2) {
      recommendations.push('Consider adding more items to ensure everyone has enough options.');
    } else if (itemsPerPerson > 4) {
      recommendations.push('You have plenty of variety! Make sure you can finish everything.');
    }

    return recommendations;
  }

  /**
   * Optimize existing selection to fit budget
   */
  public optimizeSelection(
    currentSelection: IndexedMenuItem[],
    availableItems: IndexedMenuItem[],
    targetBudget: number
  ): IndexedMenuItem[] {
    const currentTotal = currentSelection.reduce((sum, item) => sum + item.price, 0);

    // If under budget, we're good
    if (currentTotal <= targetBudget) {
      return currentSelection;
    }

    // Over budget - need to optimize
    console.log('⚠️ Over budget, optimizing selection...');

    // Sort current selection by value (keep highest value items)
    const sortedByValue = [...currentSelection].sort((a, b) => 
      this.calculateItemValue(b) - this.calculateItemValue(a)
    );

    // Greedily select items until we hit budget
    const optimized: IndexedMenuItem[] = [];
    let total = 0;

    for (const item of sortedByValue) {
      if (total + item.price <= targetBudget) {
        optimized.push(item);
        total += item.price;
      }
    }

    // Try to fill remaining budget with cheaper alternatives
    const notSelected = availableItems.filter(item => 
      !optimized.includes(item) && total + item.price <= targetBudget
    ).sort((a, b) => this.calculateItemValue(b) - this.calculateItemValue(a));

    for (const item of notSelected) {
      if (total + item.price <= targetBudget) {
        optimized.push(item);
        total += item.price;
      }
    }

    console.log(`✅ Optimized to ${optimized.length} items within budget`);
    return optimized;
  }
}

// Export singleton instance
export const budgetAllocator = BudgetAllocator.getInstance();
