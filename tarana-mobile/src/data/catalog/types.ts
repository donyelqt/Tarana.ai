/**
 * Mobile cafe catalog types — redeclared locally (Metro-safe).
 *
 * Mirrors the web shapes (`src/app/tarana-eats/data/types.ts` +
 * `src/types/tarana-eats.ts`) without importing them: the web modules sit
 * outside the Metro root (`tarana-web/*` maps to `src/lib` only) and pull
 * `@/` aliases Metro cannot resolve. Field-for-field compatible by
 * construction; web-only AI/pipeline fields omitted.
 */

export type MenuItem = {
  name: string;
  description: string;
  price: number;
  image: string;
  tags?: string[];
  quantity?: number;
};

export type FullMenu = {
  Breakfast: MenuItem[];
  Lunch: MenuItem[];
  Dinner: MenuItem[];
  Snacks: MenuItem[];
  Drinks: MenuItem[];
};

export const EMPTY_MENU: FullMenu = {
  Breakfast: [],
  Lunch: [],
  Dinner: [],
  Snacks: [],
  Drinks: [],
};

export function menuDishCount(menu: FullMenu): number {
  return menu.Breakfast.length + menu.Lunch.length + menu.Dinner.length + menu.Snacks.length + menu.Drinks.length;
}

export type Cafe = {
  name: string;
  cuisine: string[];
  priceRange: { min: number; max: number };
  location: string;
  popularFor: string[];
  about: string;
  hours: string;
  dietaryOptions: string[];
  tags: string[];
  fullMenu: FullMenu;
  /** True when dishes were vendored (see index.ts header). */
  hasMenu: boolean;
  /**
   * Web public path (e.g. "/images/goodsheperd.jpg") for the 3 cafes with
   * real photos, else null. Never a `comingsoon` placeholder — matches the
   * server `isRealPhoto` guard. Resolve via `resolveWebImage` (data seam).
   */
  image: string | null;
};
