/**
 * The ONE parser for the stored `meals.good_for` column.
 *
 * The column is `TEXT` holding a JSON array (see `createMeal` and
 * `upsertImportedMeal`, which both write `JSON.stringify([])`), while the
 * `LocalMeal` type exposes it as `string[]`. `toMeal` normalises on the way
 * out of SQLite, so a consumer that goes through `listMealsByProfile` always
 * sees an array — but the *export* path (`buildMealExportBody`) is the one
 * place that reads a meal value that has not been through `toMeal`, and there
 * the raw storage shows up: `(meal.good_for ?? []).find(...)` throws
 * `TypeError: ... .find is not a function` on the string form.
 *
 * This module is that single inverse, extracted from `toMeal` so no second
 * parser exists: it accepts whatever shape the column holds and returns the
 * array the rest of the app expects.
 *
 * Degradation is total, on purpose. A malformed column must never throw:
 * an export is a background batch over every local meal, and one bad row
 * taking down the loop loses the meals that would have synced. Every
 * unparseable value is simply `[]` — the web schema accepts a null
 * `good_for`, so the row still exports, just without the label.
 *
 * Deliberately separate from `mealGoodFor` in `../data/index.ts`: that maps
 * the WEB row union (`string | string[] | null`) where a lone string is a
 * real single label, whereas here a lone string is a *storage* encoding.
 * Treating `'Halal'` as `['Halal']` here would send a label the column never
 * meant, and treating `'["Halal"]'` as one label in `mealGoodFor` would
 * forward the brackets. Two different shapes, two different obligations.
 *
 * Pure: no sqlite, no react-native, so the mobile jest suite can exercise it
 * directly (and `../db` can stay a native-only graph).
 */

/**
 * Normalise a stored/typed `good_for` value into `string[]`.
 *
 * - An array passes through, keeping only string entries (a non-string
 *   element is dropped rather than trusted — the column is JSON, and a
 *   hand-written `[1]` must not become a label).
 * - `null`, `undefined`, `''` and blank → `[]` (nothing was ever saved).
 * - A JSON-string array (`'["Halal"]'`) → its entries.
 * - Anything else — non-JSON text, a JSON scalar, a JSON object → `[]`.
 */
export function parseStoredGoodFor(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string');
  if (typeof value !== 'string' || value.trim() === '') return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    // Malformed JSON in the column: no labels, and no exception to unwind a
    // batch over.
  }
  return [];
}
