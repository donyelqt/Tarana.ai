import type { LocalMeal } from '../data';
import { toWebMealType, type WebMealType } from '../data/mealTypeMapping';
import { CAFES } from '../data/catalog';

export type SavedDish = { name: string; price: number | null };

export function parseSavedItems(raw: string | null): SavedDish[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const dishes: SavedDish[] = [];
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const rec = item as Record<string, unknown>;
      const name = typeof rec.name === 'string' ? rec.name : null;
      if (!name) continue;
      const price = typeof rec.price === 'number' && Number.isFinite(rec.price) ? rec.price : null;
      dishes.push({ name, price });
    }
    return dishes;
  } catch {
    return [];
  }
}

export type DishSelection = { name: string; price: number | null; tab: string };

export function selectedDishTotal(selection: DishSelection[]): number {
  let total = 0;
  for (const dish of selection) {
    if (typeof dish.price === 'number' && Number.isFinite(dish.price)) total += dish.price;
  }
  return total;
}

export function selectedDishMealType(
  selection: DishSelection[],
  toWebMealType: (tab: string | null | undefined) => string | null
): string | null {
  if (selection.length === 0) return null;
  const counts = new Map<string, number>();
  for (const dish of selection) {
    counts.set(dish.tab, (counts.get(dish.tab) ?? 0) + 1);
  }
  let dominant: string | null = null;
  let dominantCount = -1;
  for (const [tab, count] of counts) {
    if (count > dominantCount) {
      dominant = tab;
      dominantCount = count;
    }
  }
  return toWebMealType(dominant);
}

export function snapshotSelection(selection: DishSelection[]): string {
  return JSON.stringify(
    selection.map((dish) => ({
      name: dish.name,
      price: dish.price,
      quantity: 1,
    }))
  );
}

export function savedMealMatchesQuery(meal: LocalMeal, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    meal.cafe_name.toLowerCase().includes(q) ||
    (meal.meal_type ?? '').toLowerCase().includes(q) ||
    parseSavedItems(meal.items).some((dish) => dish.name.toLowerCase().includes(q))
  );
}


export const ALL_FILTER = 'all' as const;

export const WEB_MEAL_TYPES: readonly WebMealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

const MEAL_TYPE_LABELS: Record<WebMealType, string> = {
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Dinner: 'Dinner',
  Snack: 'Snack',
};

export const BUDGET_BANDS = [
  { value: '100-300', label: '₱100-300', min: 100, minInclusive: true, max: 300 },
  { value: '300-500', label: '₱300-500', min: 300, minInclusive: false, max: 500 },
  { value: '500+', label: '₱500+', min: 500, minInclusive: false, max: null },
] as const;

export type BudgetBand = (typeof BUDGET_BANDS)[number];

export type FilterOption = { value: string; label: string };

function getCuisinesForCafe(cafeName: string): string[] {
  const match = CAFES.find((c) => c.name.toLowerCase() === cafeName.trim().toLowerCase());
  return match?.cuisine ?? [];
}

export const CUISINE_OPTIONS: FilterOption[] = (() => {
  const seen = new Map<string, string>();
  for (const cafe of CAFES) {
    for (const cuisine of cafe.cuisine) {
      const key = cuisine.toLowerCase();
      if (!seen.has(key)) seen.set(key, cuisine);
    }
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
})();

export const MEAL_TYPE_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'All types' },
  ...WEB_MEAL_TYPES.map((t) => ({ value: t, label: MEAL_TYPE_LABELS[t] })),
];

export const BUDGET_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'Any budget' },
  ...BUDGET_BANDS.map((b) => ({ value: b.value, label: b.label })),
];

export const CUISINE_FILTER_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'All cuisines' },
  ...CUISINE_OPTIONS,
];

export function savedMealWebType(meal: LocalMeal): WebMealType | null {
  return toWebMealType(meal.meal_type);
}

export function savedMealMatchesMealType(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  const type = savedMealWebType(meal);
  return type !== null && type.toLowerCase() === filter.toLowerCase();
}

export function savedMealMatchesBudget(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  if (meal.price == null) return false;
  const band = BUDGET_BANDS.find((b) => b.value === filter);
  if (!band) return false;
  const aboveMin = band.minInclusive ? meal.price >= band.min : meal.price > band.min;
  const belowMax = band.max === null || meal.price <= band.max;
  return aboveMin && belowMax;
}

export function savedMealMatchesCuisine(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  return getCuisinesForCafe(meal.cafe_name).some((c) => c.toLowerCase() === filter.toLowerCase());
}

export interface SavedMealsFilters {
  query?: string;
  mealType?: string;
  budget?: string;
  cuisine?: string;
}

export function savedMealMatchesFilters(
  meal: LocalMeal,
  filters: SavedMealsFilters
): boolean {
  const { query = '', mealType = ALL_FILTER, budget = ALL_FILTER, cuisine = ALL_FILTER } = filters;
  return (
    savedMealMatchesQuery(meal, query) &&
    savedMealMatchesMealType(meal, mealType) &&
    savedMealMatchesBudget(meal, budget) &&
    savedMealMatchesCuisine(meal, cuisine)
  );
}

export function filterSavedMeals(meals: LocalMeal[], filters: SavedMealsFilters): LocalMeal[] {
  return meals.filter((m) => savedMealMatchesFilters(m, filters));
}
