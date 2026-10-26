/**
 * Pure logic behind the two saved-meal detail actions: which maps target the
 * cafe resolves to, and what the meal card shows.
 *
 * Follows the `savedMeals.ts` precedent — the rules that must never regress
 * live in a module beside the screen that renders them, with no rendering and
 * no I/O, so the contract can be pinned by headless tests. Importing this
 * from CafeDetail is the reverse of the problem savedMeals.ts documents: the
 * destination owns the rules, and the screen keeps only the wiring.
 *
 * Web parity: `src/app/saved-meals/[id]/page.tsx:317-323` (View on Map) and
 * `src/app/saved-meals/components/MealCardPopup.tsx` (the card body, and the
 * two footer totals).
 *
 * Deliberately NOT importing `../data`: that entry point constructs the
 * Supabase client, opens SQLite and pulls in the LLM runtime, and none of it
 * belongs in a module whose whole job is arithmetic Jest must run without a
 * device. `../data/catalog` is type-only, so Babel erases it.
 */
import { BAGUIO_COORDINATES } from 'tarana-web/data/baguioCoordinates';
import type { Cafe } from '../data/catalog';

// ── Maps target ──

export type CafeCoords = { lat: number; lon: number };

/**
 * Fold a place name to a comparable key: case, accents, spacing and
 * punctuation are all noise (the shared database spells it "Good Sheperd
 * Cafe", the catalog spells it "Good Shepherd Cafe"), but letters and digits
 * are not — dropping them would collapse "Kubo Grill" onto "Kubo Grill
 * Baguio", two catalogues that are different cafes.
 */
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Coordinate lookup, built once from the shared Baguio database.
 *
 * Deliberately an EXACT normalized-name match, not
 * `getActivityCoordinates`'s fuzzy pass: that function also returns any key
 * that is a substring of the name, and special-cases "park"/"market"/
 * "museum", so a cafe whose name merely contains one of those words would
 * resolve to an attraction's pin. A wrong pin is worse than no pin — the
 * user walks to the wrong place. Keys are unique under normalization, so
 * first-wins is deterministic rather than arbitrary.
 */
const CAFE_COORDINATES: Map<string, CafeCoords> = (() => {
  const lookup = new Map<string, CafeCoords>();
  for (const [key, entry] of Object.entries(BAGUIO_COORDINATES)) {
    const normalized = normalizeName(key);
    if (lookup.has(normalized)) continue;
    const { lat, lon } = entry;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    lookup.set(normalized, { lat, lon });
  }
  return lookup;
})();

/**
 * The cafe's real coordinates, or null when no pinned coordinate exists.
 *
 * The mobile catalog carries `location` as prose ("Session Road", "Beside
 * Baguio Cathedral"), never as a lat/lon pair, so the shared Baguio database
 * is the only coordinate source that resolves a cafe name. Coverage is
 * partial — 10 of the 20 catalogued cafes — and that partial coverage is the
 * contract, not a bug: null means "no coordinate available", and the caller
 * renders a disabled action rather than a maps URL that searches a place we
 * cannot name.
 *
 * A landmark inside `location` is deliberately NOT mined for a pin.
 * "Beside Baguio Cathedral" is near the cathedral, not at it, and a
 * confidently wrong pin sends the user across town.
 */
export function cafeCoordinates(
  cafe: Pick<Cafe, 'name'> | string | null | undefined
): CafeCoords | null {
  const name = typeof cafe === 'string' ? cafe : cafe?.name;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return CAFE_COORDINATES.get(normalizeName(name)) ?? null;
}

// ── Meal card ──

/**
 * One row of the card, carrying the quantity the stored snapshot may hold.
 *
 * Web parity: `MealCardPopup`'s `MealItem` renders `{price} x {quantity}`
 * beside a line total of `{price * quantity}`. `lineTotal` stays null when
 * the price is null — mobile rows can genuinely lack one (see
 * `parseSavedItems`), and substituting 0 would print a free dish to staff.
 */
export type MealCardItem = {
  name: string;
  price: number | null;
  quantity: number;
  lineTotal: number | null;
};

/**
 * Shape the opaque `items` column into card rows.
 *
 * Same column and the same degenerate-input rules as `parseSavedItems`, plus
 * the quantity the card needs: a row without a usable quantity is one dish,
 * never zero. Anything unparseable degrades to no rows rather than a throw.
 * The card is shown to cafe staff, so inventing or dropping a line is the one
 * failure that costs money — hence the per-row guards instead of a cast.
 */
export function mealCardItems(raw: string | null): MealCardItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: MealCardItem[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const name = typeof rec.name === 'string' ? rec.name : null;
    if (!name) continue;
    const price = typeof rec.price === 'number' && Number.isFinite(rec.price) ? rec.price : null;
    const quantity =
      typeof rec.quantity === 'number' && Number.isFinite(rec.quantity) && rec.quantity >= 1
        ? Math.floor(rec.quantity)
        : 1;
    items.push({ name, price, quantity, lineTotal: price == null ? null : price * quantity });
  }
  return items;
}

/**
 * Card total: the sum of the line totals.
 *
 * Web parity: `items.reduce((acc, item) => acc + (item.price * item.quantity), 0)`.
 * A null-priced row contributes nothing, so the total never goes NaN and the
 * card never shows "₱NaN" to staff.
 */
export function mealCardTotal(items: MealCardItem[]): number {
  let total = 0;
  for (const item of items) total += item.lineTotal ?? 0;
  return total;
}

/** Count of dishes on the card — the footer's "Selected Items (n)". */
export function mealCardDishCount(items: MealCardItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

/**
 * Expiry printed on the card: one year out, formatted as web does.
 *
 * Web parity: `validUntil.setFullYear(getFullYear() + 1)`, then
 * `toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })`.
 * The clock is a parameter rather than a `new Date()` read so the format is
 * testable without freezing time, and an Intl failure falls back to an ISO
 * date instead of throwing inside a sheet the user is holding open.
 */
export function mealCardValidUntil(now: Date = new Date()): string {
  const validUntil = new Date(now.getTime());
  validUntil.setFullYear(validUntil.getFullYear() + 1);
  try {
    return validUntil.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return validUntil.toISOString().slice(0, 10);
  }
}
