/**
 * Meal-type mapping: the mobile tab vocabulary → the web meal-type union.
 *
 * Why this file exists at all: the mobile menu tabs are a VIEW concept
 * (`FullMenu`'s five keys — Breakfast, Lunch, Dinner, Snacks, Drinks, see
 * `catalog/types.ts`), while `meal_type` is a DATA column the web app owns
 * and filters. The web union is four values only —
 * `'Breakfast' | 'Lunch' | 'Dinner' | 'Snack'` (src/app/saved-meals/data.ts:4)
 * — so the two vocabularies do not line up, and the gap is silent:
 *
 * - The web row type accepts any of the four, and
 * - `src/app/saved-meals/page.tsx:77` filters with an EXACT
 *   `meal.mealType.toLowerCase() === mealTypeFilter` against the four
 *   lowercase filter values, and
 * - the server schema (`src/app/api/saved-meals/route.ts:38`) is just
 *   `z.string().min(1)` — it accepts anything non-empty.
 *
 * So a row written with 'Snacks' or 'Drinks' validates everywhere, stores
 * happily, and then never matches any filter on web: it renders as an
 * unfilterable row with no meal-type icon (MealCard's `default` case only
 * fires for values outside the four, and the icon is decorative so nothing
 * logs). The write path used to pass the raw tab string through, which is
 * exactly how the mismatch got persisted.
 *
 * The rule here: every `meal_type` this app writes or exports goes through
 * `toWebMealType` FIRST, so the persisted value is already web-valid and
 * the exact-match filter can find it. This module is the single place the
 * two vocabularies meet; it has no imports and touches no I/O, so it is
 * cheap to import from the save site (a screen) and from the export seam
 * (`data/index.ts`) alike.
 */

/** The web meal-type union, verbatim from `src/app/saved-meals/data.ts:4`. */
export type WebMealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

/**
 * The mobile tab labels, verbatim from `MEAL_TABS` in
 * `screens/CafeDetail.tsx:13` (which are `FullMenu`'s keys). Kept as a
 * value here so the map below can only say something about the five real
 * tabs — a tab renamed in the screen becomes a compile error rather than a
 * silently unmapped value.
 */
export type MobileMealTab = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Drinks';

/**
 * The tab → web mapping. Three tabs map to themselves. The two that do not
 * are the whole point:
 * - `Snacks` → `Snack`: the web union spells the same concept in the
 *   singular, so this is a rename, not a decision.
 * - `Drinks` → `Snack`: the web union has no drink value, so something has
 *   to be chosen and 'Snack' is the only defensible one. A drink is not a
 *   Breakfast/Lunch/Dinner, and folding it into one of those would file it
 *   under a meal it is not — the user's coffee would surface when they
 *   filter for Lunch, which is worse than not finding it at all. The web
 *   union offers 'Snack' as its catch-all for food that is not one of the
 *   three meals (its own ListCard and `MealCard` treat Snack as the
 *   non-meal bucket), so a drink lands in the bucket the web app already
 *   uses for everything that is not a meal. Consequence, stated plainly:
 *   a drink is filed under Snack, so it is visible and filterable on web
 *   but not distinguishable from a non-drink snack. Losing that
 *   distinction is the cost of the web union being four values; a fifth
 *   value would be the real fix, and that is a web schema change outside
 *   this repo's data-contract scope.
 *
 * Written as a total function over the tab union (every key present, so an
 * unmapped tab is a type error) rather than a `Record<string, …>` partial
 * with a runtime fallback: the vocabulary is closed and known, and a
 * compile-time exhaustiveness check beats a runtime branch nobody tests.
 */
const TAB_TO_WEB: Record<MobileMealTab, WebMealType> = {
  Breakfast: 'Breakfast',
  Lunch: 'Lunch',
  Dinner: 'Dinner',
  // Web spells this singular; the filter compares lowercase, so 'Snacks'
  // was the exact value that no filter could ever match.
  Snacks: 'Snack',
  // No web drink value exists — see the Drinks note above.
  Drinks: 'Snack',
};

/**
 * The web union, as a lookup set. Needed because the mapping's INPUT is not
 * only tabs: the same local column also holds values written by the OTHER
 * direction of sync. `importWebMeals` copies web rows into SQLite
 * (data/index.ts:392), and a web row already carries a web-valid value, so
 * a local row can legitimately hold 'Snack'. Those values must pass
 * through unchanged — mapping 'Snack' through the tab table alone would
 * drop the row, and a dropped local row is a sync bug far worse than the
 * filter mismatch being fixed here.
 */
const WEB_TYPES: readonly WebMealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/**
 * Map a meal type to the web union, or null when there is no honest answer.
 *
 * Two accepted inputs, in order:
 * 1. A mobile tab label ('Breakfast'…'Drinks') → the web value from
 *    `TAB_TO_WEB` above. This is the save-site path.
 * 2. A value already in the web union ('Breakfast'…'Snack') → itself. This
 *    is the export path meeting a web-imported row, and it makes the
 *    mapping idempotent, so re-exporting converges rather than degrading.
 *
 * `null` in, `null` out: a meal saved with no meal type (the save site
 * writes null when the active tab has no dishes) stays null, because the
 * web column and schema are both nullish and inventing a value would put
 * the row in a filter bucket the user never chose.
 *
 * Anything else also maps to `null` rather than to a guessed bucket:
 * `meal_type` arriving as something other than a string, or as a label
 * neither vocabulary uses (a stale row from an older build), means the row
 * did not come from a known tab. The export guard then skips it with a
 * reason — the same rule as every other invalid row — instead of POSTing a
 * value no web filter could match. This is the one place the vocabulary
 * can be wrong at runtime, so it is checked here instead of trusted.
 */
export function toWebMealType(mealType: string | null | undefined): WebMealType | null {
  if (typeof mealType !== 'string') return null;
  // A tab label wins first: it is the value a save actually wrote. Iterating
  // the entries keeps both sides typed, so no index assertion is needed.
  for (const [tab, webType] of Object.entries(TAB_TO_WEB)) {
    if (tab === mealType) return webType;
  }
  // Then a value the web union already owns — pass it through untouched.
  // Narrowed with `find` rather than `includes` + cast: the found element is
  // the typed value, so no assertion is needed to return it.
  const webValue = WEB_TYPES.find((t) => t === mealType);
  if (webValue !== undefined) return webValue;
  return null;
}
