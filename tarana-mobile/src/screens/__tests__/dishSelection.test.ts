/**
 * Dish selection shaping — the observable contract of what a picked set of
 * dishes becomes when it is written to the opaque `items` column and the
 * web-visible `price` / `meal_type` columns.
 *
 * This is the mobile half of the web save: `useTaranaEatsService.saveToMeals`
 * sets price to the sum of the selected items and stores the full selection
 * in menu_items, so a meal saved on one surface and viewed on the other shows
 * every dish. Before this, mobile wrote only the first dish of the active
 * tab, so a phone-saved meal showed one dish on web.
 *
 * The functions are pure and exported from `../savedMeals`, so these tests
 * need no navigation stack, no SQLite, and no React Native render.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. The total is the sum of the picked prices. The row price is the cost of
 *    what the user chose, not the first dish they happened to see.
 * 2. A null price contributes nothing and cannot make the total NaN, which
 *    would fail the web schema's positive-number guard.
 * 3. `meal_type` is a web-valid value, not a mobile tab label, because the
 *    web filter matches it by exact equality.
 * 4. A multi-tab selection files the row under its dominant tab, because the
 *    row must name where the meal actually sits.
 * 5. The snapshot holds every picked dish plus quantity, matching MenuItem
 *    and the web popup's "price x quantity" rendering.
 */
import { describe, expect, it } from '@jest/globals';
import {
  selectedDishMealType,
  selectedDishTotal,
  snapshotSelection,
  type DishSelection,
} from '../savedMeals';

function dish(name: string, price: number | null, tab = 'Lunch'): DishSelection {
  return { name, price, tab };
}

/** The web meal-type mapper, matched to `toWebMealType` in the data seam. */
const toWebMealType = (tab: string | null | undefined): string | null => {
  if (!tab) return null;
  if (tab === 'Snacks') return 'Snack';
  if (tab === 'Drinks') return 'Snack';
  if (tab === 'Breakfast' || tab === 'Lunch' || tab === 'Dinner') return tab;
  return null;
};

describe('selectedDishTotal — web price parity', () => {
  it('sums the picked dish prices', () => {
    expect(selectedDishTotal([dish('a', 100), dish('b', 250)])).toBe(350);
  });

  it('adds nothing for a null price and never yields NaN', () => {
    const total = selectedDishTotal([dish('a', 100), dish('b', null)]);
    expect(total).toBe(100);
    expect(Number.isNaN(total)).toBe(false);
  });

  it('is zero for an empty selection', () => {
    expect(selectedDishTotal([])).toBe(0);
  });
});

describe('selectedDishMealType — web-visible column', () => {
  it('maps the single tab a selection was drawn from', () => {
    expect(selectedDishMealType([dish('a', 100, 'Breakfast')], toWebMealType)).toBe('Breakfast');
  });

  it('maps the mobile tab vocabulary onto the web union', () => {
    expect(selectedDishMealType([dish('a', 100, 'Snacks')], toWebMealType)).toBe('Snack');
    expect(selectedDishMealType([dish('a', 100, 'Drinks')], toWebMealType)).toBe('Snack');
  });

  it('files a multi-tab selection under its dominant tab', () => {
    const selection = [dish('a', 100, 'Lunch'), dish('b', 150, 'Dinner'), dish('c', 200, 'Dinner')];
    expect(selectedDishMealType(selection, toWebMealType)).toBe('Dinner');
  });

  it('maps an empty selection to null, which the web column accepts', () => {
    expect(selectedDishMealType([], toWebMealType)).toBeNull();
  });

  it('maps an unmappable tab to null rather than inventing a bucket', () => {
    expect(selectedDishMealType([dish('a', 100, 'Brunch')], toWebMealType)).toBeNull();
  });
});

describe('snapshotSelection — the whole selection survives', () => {
  it('holds every picked dish with its price and a quantity', () => {
    const json = snapshotSelection([dish('Shawarma', 180), dish('Rice', 40)]);
    expect(JSON.parse(json)).toEqual([
      { name: 'Shawarma', price: 180, quantity: 1 },
      { name: 'Rice', price: 40, quantity: 1 },
    ]);
  });

  it('round-trips through the parser the detail screen reads with', () => {
    // parseSavedItems lives in the same module; a snapshot the reader cannot
    // parse back would make "Your saved dishes" silently empty.
    const { parseSavedItems } = require('../savedMeals') as typeof import('../savedMeals');
    const picked = [dish('Shawarma', 180), dish('Rice', 40)];
    const parsed = parseSavedItems(snapshotSelection(picked));
    expect(parsed.map((d) => d.name)).toEqual(['Shawarma', 'Rice']);
  });

  it('snapshots an empty selection as an empty array', () => {
    expect(JSON.parse(snapshotSelection([]))).toEqual([]);
  });
});
