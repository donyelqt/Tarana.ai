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
    const { parseSavedItems } = require('../savedMeals') as typeof import('../savedMeals');
    const picked = [dish('Shawarma', 180), dish('Rice', 40)];
    const parsed = parseSavedItems(snapshotSelection(picked));
    expect(parsed.map((d) => d.name)).toEqual(['Shawarma', 'Rice']);
  });

  it('snapshots an empty selection as an empty array', () => {
    expect(JSON.parse(snapshotSelection([]))).toEqual([]);
  });
});
