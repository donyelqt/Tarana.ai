
import { IndexedMenuItem } from "./menuIndexingService";
import { TaranaEatsFormValues } from "@/types/tarana-eats";

export interface BudgetAllocation {
  selectedItems: IndexedMenuItem[];
  totalCost: number;
  remainingBudget: number;
  utilizationRate: number; 
  valueScore: number; 
  nutritionalBalance: number; 
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

  public allocateBudget(
    availableItems: IndexedMenuItem[],
    totalBudget: number,
    groupSize: number,
    preferences?: TaranaEatsFormValues,
    constraints?: AllocationConstraints
  ): BudgetAllocation {
    console.log('💰 Allocating budget intelligently...');

    let eligibleItems = this.filterItemsByConstraints(
      availableItems,
      preferences,
      constraints
    );

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

  private filterItemsByConstraints(
    items: IndexedMenuItem[],
    preferences?: TaranaEatsFormValues,
    constraints?: AllocationConstraints
  ): IndexedMenuItem[] {
    let filtered = [...items];
    const originalCount = filtered.length;

    if (preferences?.mealType && preferences.mealType.length > 0) {
      const mealFiltered = filtered.filter(item =>
        preferences.mealType!.includes(item.category)
      );
      if (mealFiltered.length > 0) {
        filtered = mealFiltered;
      }
    }

    if (preferences?.restrictions && preferences.restrictions.length > 0) {
      const dietaryFiltered = filtered.filter(item => {
        if (!item.dietaryLabels || item.dietaryLabels.length === 0) {
          return false;
        }
        return preferences.restrictions!.some(r =>
          item.dietaryLabels?.includes(r)
        );
      });
      
      if (dietaryFiltered.length > 0) {
        filtered = dietaryFiltered;
      } else {
        console.log('⚠️ No items match dietary restrictions, including all items');
      }
    }

    if (constraints?.avoidCategories && constraints.avoidCategories.length > 0) {
      const categoryFiltered = filtered.filter(item =>
        !constraints.avoidCategories!.includes(item.category)
      );
      if (categoryFiltered.length > 0) {
        filtered = categoryFiltered;
      }
    }

    console.log(`📊 Filtered ${filtered.length} items from ${originalCount} total`);
    return filtered;
  }

  private selectOptimalItems(
    items: IndexedMenuItem[],
    budget: number,
    groupSize: number,
    constraints?: AllocationConstraints
  ): IndexedMenuItem[] {
    const itemsWithValue = items.map(item => ({
      item,
      value: this.calculateItemValue(item),
      efficiencyRatio: (item.popularity || 50) / Math.max(1, item.price)
    }));

    const sorted = itemsWithValue.sort((a, b) => b.efficiencyRatio - a.efficiencyRatio);

    const selected: IndexedMenuItem[] = [];
    let currentCost = 0;
    const categoryCount: Record<string, number> = {};

    const minItems = constraints?.minItemsPerPerson || 2;
    const maxItems = constraints?.maxItemsPerPerson || 6; 
    const targetUtilization = 0.75; 
    const maxUtilization = 0.90; 

    const targetItems = Math.floor((minItems + maxItems) / 2) * groupSize;

    for (const { item } of sorted) {
      const utilizationRate = (currentCost / budget);
      
      if (utilizationRate >= maxUtilization) {
        break;
      }

      if (currentCost + item.price > budget) {
        continue;
      }

      if (selected.length >= maxItems * groupSize) {
        break;
      }

      const catCount = categoryCount[item.category] || 0;
      const maxPerCategory = Math.ceil(targetItems / 3); 
      if (catCount >= maxPerCategory && utilizationRate < targetUtilization) {
        if (catCount >= maxPerCategory * 1.5) {
          continue;
        }
      } else if (catCount >= maxPerCategory) {
        continue;
      }

      selected.push(item);
      currentCost += item.price;
      categoryCount[item.category] = catCount + 1;

      if (selected.length >= minItems * groupSize && utilizationRate >= targetUtilization) {
        if (selected.length >= targetItems && utilizationRate >= targetUtilization) break;
      }
    }

    if (selected.length < minItems * groupSize) {
      console.log(`⚠️ Only ${selected.length} items selected, adding more to reach minimum`);
      
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
    
    if (selected.length === 0 && items.length > 0) {
      console.log('🚨 No items selected, forcing cheapest items into selection');
      const cheapest = [...items].sort((a, b) => a.price - b.price);
      let fallbackCost = 0;
      
      for (const item of cheapest) {
        if (fallbackCost + item.price <= budget && selected.length < maxItems * groupSize) {
          selected.push(item);
          fallbackCost += item.price;
        }
        if (selected.length >= 2 && fallbackCost > budget * 0.5) break;
      }
    }

    return selected;
  }

  private calculateItemValue(item: IndexedMenuItem): number {
    let value = 0;

    value += (item.popularity || 50) * 0.5;

    const priceScore = Math.max(0, 30 - (item.price / 50));
    value += priceScore;

    if (item.category === 'Lunch' || item.category === 'Dinner') {
      value += 20; 
    } else if (item.category === 'Breakfast') {
      value += 15;
    } else if (item.category === 'Drinks') {
      value += 10; 
    }

    return value;
  }

  private calculateValueScore(items: IndexedMenuItem[]): number {
    if (items.length === 0) return 0;

    const avgValue = items.reduce((sum, item) => 
      sum + this.calculateItemValue(item), 0
    ) / items.length;

    return Math.min(100, avgValue);
  }

  private calculateNutritionalBalance(items: IndexedMenuItem[]): number {
    if (items.length === 0) return 0;

    const categoryCount: Record<string, number> = {};
    items.forEach(item => {
      categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
    });

    const categories = Object.keys(categoryCount).length;
    const maxCategories = 5; 

    const diversityScore = (categories / maxCategories) * 70;

    const values = Object.values(categoryCount);
    const avgCount = items.length / categories;
    const variance = values.reduce((sum, count) => 
      sum + Math.pow(count - avgCount, 2), 0
    ) / values.length;
    const evenScore = Math.max(0, 30 - variance * 5);

    return Math.min(100, diversityScore + evenScore);
  }

  private generateRecommendations(
    selected: IndexedMenuItem[],
    budget: number,
    spent: number,
    groupSize: number
  ): string[] {
    const recommendations: string[] = [];
    const utilizationRate = (spent / budget) * 100;

    if (utilizationRate < 60) {
      recommendations.push(`You're only using ${utilizationRate.toFixed(0)}% of your budget. Consider adding more items or drinks.`);
    } else if (utilizationRate > 95) {
      recommendations.push(`Great budget utilization at ${utilizationRate.toFixed(0)}%!`);
    } else {
      recommendations.push(`Good budget management with ${(budget - spent).toFixed(0)}₱ remaining for adjustments.`);
    }

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

    const itemsPerPerson = selected.length / groupSize;
    if (itemsPerPerson < 2) {
      recommendations.push('Consider adding more items to ensure everyone has enough options.');
    } else if (itemsPerPerson > 4) {
      recommendations.push('You have plenty of variety! Make sure you can finish everything.');
    }

    return recommendations;
  }

  public optimizeSelection(
    currentSelection: IndexedMenuItem[],
    availableItems: IndexedMenuItem[],
    targetBudget: number
  ): IndexedMenuItem[] {
    const currentTotal = currentSelection.reduce((sum, item) => sum + item.price, 0);

    if (currentTotal <= targetBudget) {
      return currentSelection;
    }

    console.log('⚠️ Over budget, optimizing selection...');

    const sortedByValue = [...currentSelection].sort((a, b) => 
      this.calculateItemValue(b) - this.calculateItemValue(a)
    );

    const optimized: IndexedMenuItem[] = [];
    let total = 0;

    for (const item of sortedByValue) {
      if (total + item.price <= targetBudget) {
        optimized.push(item);
        total += item.price;
      }
    }

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

export const budgetAllocator = BudgetAllocator.getInstance();
