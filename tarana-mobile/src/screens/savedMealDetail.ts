import { BAGUIO_COORDINATES } from 'tarana-web/data/baguioCoordinates';
import type { Cafe } from '../data/catalog';


export type CafeCoords = { lat: number; lon: number };

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

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

export function cafeCoordinates(
  cafe: Pick<Cafe, 'name'> | string | null | undefined
): CafeCoords | null {
  const name = typeof cafe === 'string' ? cafe : cafe?.name;
  if (typeof name !== 'string' || name.trim() === '') return null;
  return CAFE_COORDINATES.get(normalizeName(name)) ?? null;
}


export type MealCardItem = {
  name: string;
  price: number | null;
  quantity: number;
  lineTotal: number | null;
};

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

export function mealCardTotal(items: MealCardItem[]): number {
  let total = 0;
  for (const item of items) total += item.lineTotal ?? 0;
  return total;
}

export function mealCardDishCount(items: MealCardItem[]): number {
  return items.reduce((count, item) => count + item.quantity, 0);
}

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
