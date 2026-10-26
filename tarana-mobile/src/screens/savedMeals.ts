/**
 * Saved-meal shaping shared by SavedCafes (list + search + filters) and
 * CafeDetail (the saved-dishes section).
 *
 * Both screens needed the same knowledge of the opaque `items` column, but
 * it lived inside CafeDetail — a navigation destination. Importing a screen
 * from a screen drags that destination's whole import graph (catalog menus,
 * SVG icons, gradient deps) into the consumer for the sake of one pure
 * function, so the parse lives here instead, next to the list predicate
 * that consumes it. Nothing in this module renders or touches I/O.
 *
 * Web parity: `src/app/saved-meals/page.tsx:72-74` projects `dishNames`
 * from `meal.menuItems` and matches `.includes` — the same predicate, on
 * the same rows, for the same query. The three filter predicates below
 * mirror the same page's meal-type, budget, and cuisine selects.
 */
import type { LocalMeal } from '../data';
import { toWebMealType, type WebMealType } from '../data/mealTypeMapping';
import { CAFES } from '../data/catalog';

export type SavedDish = { name: string; price: number | null };

/**
 * Imported web rows store menu_items JSON in the opaque `items` column
 * (data seam importWebMeals). Surface name + price only — the same two
 * fields web renders per dish row. Anything unparseable degrades to no
 * section, never a crash.
 */
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

/** A dish chosen for saving, with the tab it came from. */
export type DishSelection = { name: string; price: number | null; tab: string };

/**
 * Sum of the selected dish prices, web style.
 *
 * Web parity: `useTaranaEatsService.saveToMeals` sets price to
 * `selectedItems.reduce((sum, item) => sum + item.price, 0)`, so the row
 * price is the cost of what the user picked, not the first dish they saw.
 * A dish with a null price contributes nothing and cannot make the total
 * NaN, which would fail the web schema's positive-number guard.
 */
export function selectedDishTotal(selection: DishSelection[]): number {
  let total = 0;
  for (const dish of selection) {
    if (typeof dish.price === 'number' && Number.isFinite(dish.price)) total += dish.price;
  }
  return total;
}

/**
 * The web-valid meal type for a selection.
 *
 * The row's `meal_type` is the web-visible column and the web filter
 * matches it by exact equality against four values, so it must be a
 * WebMealType, not a mobile tab label. A selection spanning one tab maps
 * that tab; a selection spanning several maps the tab holding the most
 * dishes, so the row is filed under where the meal actually sits rather
 * than whichever tab was open when the user pressed save. An empty
 * selection maps to null, which the web column and schema both accept.
 */
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

/**
 * Snapshot a selection into the opaque `items` column, web style.
 *
 * Web parity: the row's menu_items is the full selected array, so a meal
 * saved on one surface and viewed on the other shows every dish the user
 * chose. Quantity is carried, matching `MenuItem` and the web popup's
 * "price x quantity" rendering; the old mobile snapshot wrote quantity 1.
 */
export function snapshotSelection(selection: DishSelection[]): string {
  return JSON.stringify(
    selection.map((dish) => ({
      name: dish.name,
      price: dish.price,
      quantity: 1,
    }))
  );
}

/**
 * SavedCafes search predicate: cafe name, meal type, or any saved dish
 * name — case-insensitive substring on all three.
 *
 * Dish names come from the row's own `items`, so a query the user types
 * against a dish they saved on another device finds the row without a
 * network round-trip. `parseSavedItems` degrades malformed `items` to no
 * dishes, so a corrupt row keeps its name/type matches and simply matches
 * no dish rather than throwing.
 *
 * An empty (or whitespace-only) query matches everything, so the list
 * renders with no filter — identical to the old inline behaviour.
 */
export function savedMealMatchesQuery(meal: LocalMeal, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    meal.cafe_name.toLowerCase().includes(q) ||
    (meal.meal_type ?? '').toLowerCase().includes(q) ||
    parseSavedItems(meal.items).some((dish) => dish.name.toLowerCase().includes(q))
  );
}

/* -------------------------------------------------------------------------- *
 * Saved-meals filters — web parity (meal type, budget, cuisine)              *
 * -------------------------------------------------------------------------- *
 *
 * The web list (`src/app/saved-meals/page.tsx:57-165`) filters the same rows
 * three more ways: meal type by exact web-union match, budget by price band,
 * cuisine by the cafe's catalog entry. Mobile had only search, so those three
 * controls are added here as pure predicates beside the search predicate — no
 * screen, no SQLite, no NativeWind, testable in isolation.
 *
 * All four filters compose by AND, exactly as the web composes them:
 * `matchesQuery && matchesMealType && matchesBudget && matchesCuisine`.
 */

/** Every filter's off position. Setting one to `'all'` removes it. */
export const ALL_FILTER = 'all' as const;

/**
 * The meal-type filter vocabulary is the WEB union, not the mobile tab
 * vocabulary.
 *
 * Web filters `meal.mealType.toLowerCase() === mealTypeFilter` against four
 * lowercase values (page.tsx:77). Deriving the options from the same union
 * the filter matches against — through `toWebMealType`, which is the single
 * place the two vocabularies meet — is what keeps an option offered here
 * always selectable there. A list built from mobile tabs ('Snacks', 'Drinks')
 * would offer two values no row can ever match.
 */
export const WEB_MEAL_TYPES: readonly WebMealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Human labels for the meal-type options, in union order. */
const MEAL_TYPE_LABELS: Record<WebMealType, string> = {
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Dinner: 'Dinner',
  Snack: 'Snack',
};

/**
 * Budget bands, mirroring web page.tsx:145-152 exactly:
 *
 * - `100-300` — `meal.price >= 100 && meal.price <= 300`
 * - `300-500` — `meal.price > 300 && meal.price <= 500`
 * - `500+`    — `meal.price > 500`
 *
 * Only the first band's LOWER edge is inclusive. The upper two exclude it,
 * so a boundary price lands in exactly one band: 300 belongs to `100-300`,
 * 500 to `300-500`. `minInclusive` is data rather than a baked-in `+1`
 * trick because the exclusion is the point — the seams are the values the
 * web page uses, and a band that double-counted 300 would surface a row
 * under both of the lower bands on mobile while web shows it in one.
 *
 * Any price below 100 belongs to no band: web has no "under 100" band, so
 * inventing one here would put a row in a bucket web cannot show.
 */
export const BUDGET_BANDS = [
  { value: '100-300', label: '₱100-300', min: 100, minInclusive: true, max: 300 },
  { value: '300-500', label: '₱300-500', min: 300, minInclusive: false, max: 500 },
  { value: '500+', label: '₱500+', min: 500, minInclusive: false, max: null },
] as const;

export type BudgetBand = (typeof BUDGET_BANDS)[number];

/** One pill option for a filter row: the stored value plus its label. */
export type FilterOption = { value: string; label: string };

/**
 * Cuisine for a cafe, by exact cafe-name match against the vendored catalog.
 *
 * Web parity: page.tsx:33-44 matches `restaurants` by lowercase exact name
 * and resolves to `[]` for an unknown cafe, so the filter degrades to
 * no-match only when it is active. Local rows can hold a name the catalog
 * does not carry (a hand-added cafe, a renamed entry), and that must not
 * crash the filter.
 */
function getCuisinesForCafe(cafeName: string): string[] {
  const match = CAFES.find((c) => c.name.toLowerCase() === cafeName.trim().toLowerCase());
  return match?.cuisine ?? [];
}

/**
 * The cuisine option list, derived from the catalog — never hardcoded.
 *
 * Same shape as web's CUISINE_OPTIONS (page.tsx:46-55): dedupe
 * case-insensitively, keeping the first-seen original casing as the label,
 * then sort by label. Duplicates are real (many Baguio cafes are 'Cafe'),
 * so a 20-cafe catalog collapses to a short pill row without any option
 * listing the same cuisine twice under different casings.
 */
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

/** The meal-type options, labels first — `all` resets the filter. */
export const MEAL_TYPE_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'All types' },
  ...WEB_MEAL_TYPES.map((t) => ({ value: t, label: MEAL_TYPE_LABELS[t] })),
];

/** The budget options — `all` resets the filter, bands follow web's order. */
export const BUDGET_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'Any budget' },
  ...BUDGET_BANDS.map((b) => ({ value: b.value, label: b.label })),
];

/** The cuisine options, with web's `all` reset in front of the catalog list. */
export const CUISINE_FILTER_OPTIONS: FilterOption[] = [
  { value: ALL_FILTER, label: 'All cuisines' },
  ...CUISINE_OPTIONS,
];

/**
 * The web meal type a row actually carries, or null when it has none.
 *
 * The filter compares against the WEB union, but the column it filters on is
 * `meal_type`, which is free-form text: it holds whatever was written — a web
 * row's valid value, a mobile tab label, or a legacy value from an older
 * build. `toWebMealType` resolves all three to the union or to null, so this
 * is the single normalization point for the predicate.
 */
export function savedMealWebType(meal: LocalMeal): WebMealType | null {
  return toWebMealType(meal.meal_type);
}

/**
 * Meal-type filter predicate: exact match on the web union, or pass-through
 * on `all`.
 *
 * A row whose meal type does not resolve to the web union (null, a stale
 * legacy label) survives `all` and disappears under any specific type, which
 * is the same outcome web gives a row it cannot file. Resolving rather than
 * comparing the raw string is what makes 'Snacks' filterable as 'Snack'.
 */
export function savedMealMatchesMealType(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  const type = savedMealWebType(meal);
  return type !== null && type.toLowerCase() === filter.toLowerCase();
}

/**
 * Budget filter predicate: the web bands, verbatim.
 *
 * A row with a null price matches no band (web's `meal.price > 500` against
 * null is false for every band) but survives `all`, so an unpriced row is
 * never hidden by a filter that is off.
 */
export function savedMealMatchesBudget(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  if (meal.price == null) return false;
  const band = BUDGET_BANDS.find((b) => b.value === filter);
  // An unrecognized band id cannot match anything; offering it would be a
  // dead control, and matching everything would be a silent no-op filter.
  if (!band) return false;
  const aboveMin = band.minInclusive ? meal.price >= band.min : meal.price > band.min;
  // The upper edge is inclusive and absent on the open-ended top band, so
  // 900 lands in '500+' only and 300 lands in '100-300' only. Without this
  // the matcher tests just the lower bound and every band also swallows the
  // bands above it.
  const belowMax = band.max === null || meal.price <= band.max;
  return aboveMin && belowMax;
}

/**
 * Cuisine filter predicate: the row's cafe must carry the cuisine.
 *
 * Unknown cafes resolve to no cuisines, so a hand-added cafe hides under a
 * cuisine filter but survives `all` — web's degradation, mirrored.
 */
export function savedMealMatchesCuisine(meal: LocalMeal, filter: string): boolean {
  if (filter === ALL_FILTER) return true;
  return getCuisinesForCafe(meal.cafe_name).some((c) => c.toLowerCase() === filter.toLowerCase());
}

/**
 * The full filter stack: search + meal type + budget + cuisine.
 *
 * `savedMealsFiltersPredicate(meals, filters)` is the single call the screen
 * needs; each predicate stays exported on its own so a test can pin one
 * behaviour without the others. Every filter defaults to `all` (off), so
 * `{ query: '', mealType: ALL_FILTER, budget: ALL_FILTER, cuisine: ALL_FILTER }`
 * returns the input list unchanged.
 */
export interface SavedMealsFilters {
  /** Free-text search; empty string means off. */
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

/** Apply the full filter stack to a list. Pure; returns a new array. */
export function filterSavedMeals(meals: LocalMeal[], filters: SavedMealsFilters): LocalMeal[] {
  return meals.filter((m) => savedMealMatchesFilters(m, filters));
}
