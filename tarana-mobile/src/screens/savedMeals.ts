/**
 * Saved-meal shaping shared by SavedCafes (list + search) and CafeDetail
 * (the saved-dishes section).
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
 * the same rows, for the same query.
 */
import type { LocalMeal } from '../data';

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
