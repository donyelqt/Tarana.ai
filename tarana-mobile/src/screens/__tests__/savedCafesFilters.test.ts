import { describe, expect, it } from '@jest/globals';
import {
  ALL_FILTER,
  BUDGET_OPTIONS,
  CUISINE_OPTIONS,
  CUISINE_FILTER_OPTIONS,
  MEAL_TYPE_OPTIONS,
  filterSavedMeals,
  savedMealMatchesBudget,
  savedMealMatchesCuisine,
  savedMealMatchesFilters,
  savedMealMatchesMealType,
} from '../savedMeals';
import { CAFES } from '../../data/catalog';
import type { LocalMeal } from '../../data';

function meal(overrides: Partial<LocalMeal> = {}): LocalMeal {
  return {
    id: 'meal-1',
    profile_id: 'profile-1',
    cafe_name: 'Ali House of Shawarma Halal',
    meal_type: 'Lunch',
    price: 250,
    good_for: ['Halal'],
    location: 'Baguio City',
    items: JSON.stringify([
      { name: 'Beef Shawarma Wrap', price: 180, quantity: 1 },
      { name: 'Chicken Kebab', price: 120, quantity: 2 },
    ]),
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}


describe('meal type filter — narrows on the web union', () => {
  it('keeps only the row whose resolved web type matches', () => {
    const rows = [
      meal({ id: 'a', meal_type: 'Lunch' }),
      meal({ id: 'b', meal_type: 'Dinner' }),
      meal({ id: 'c', meal_type: 'Breakfast' }),
    ];
    expect(filterSavedMeals(rows, { mealType: 'Lunch' }).map((m) => m.id)).toEqual(['a']);
  });

  it('filters a mobile tab label by the web value it maps to', () => {
    const rows = [
      meal({ id: 'snacks', meal_type: 'Snacks' }),
      meal({ id: 'drinks', meal_type: 'Drinks' }),
      meal({ id: 'lunch', meal_type: 'Lunch' }),
    ];
    expect(filterSavedMeals(rows, { mealType: 'Snack' }).map((m) => m.id)).toEqual([
      'snacks',
      'drinks',
    ]);
    expect(filterSavedMeals(rows, { mealType: 'Lunch' }).map((m) => m.id)).toEqual(['lunch']);
  });

  it('matches web spellings case-insensitively, like the web exact match', () => {
    expect(savedMealMatchesMealType(meal({ meal_type: 'Dinner' }), 'dinner')).toBe(true);
    expect(savedMealMatchesMealType(meal({ meal_type: 'Dinner' }), 'DINNER')).toBe(true);
  });

  it('resolves the row type through the mapping for the predicate', () => {
    expect(savedMealMatchesMealType(meal({ meal_type: 'Snacks' }), 'Snack')).toBe(true);
    expect(savedMealMatchesMealType(meal({ meal_type: 'Brunch' }), 'Breakfast')).toBe(false);
    expect(savedMealMatchesMealType(meal({ meal_type: null }), 'Breakfast')).toBe(false);
  });

  it('offers the web union only, with an all reset', () => {
    expect(MEAL_TYPE_OPTIONS).toEqual([
      { value: 'all', label: 'All types' },
      { value: 'Breakfast', label: 'Breakfast' },
      { value: 'Lunch', label: 'Lunch' },
      { value: 'Dinner', label: 'Dinner' },
      { value: 'Snack', label: 'Snack' },
    ]);
    const values = MEAL_TYPE_OPTIONS.map((o) => o.value);
    expect(values).not.toContain('Snacks');
    expect(values).not.toContain('Drinks');
  });
});


describe('budget filter — narrows on the web price bands', () => {
  it('keeps only rows inside the selected band', () => {
    const rows = [
      meal({ id: 'low', price: 150 }),
      meal({ id: 'mid', price: 400 }),
      meal({ id: 'high', price: 900 }),
    ];
    expect(filterSavedMeals(rows, { budget: '100-300' }).map((m) => m.id)).toEqual(['low']);
    expect(filterSavedMeals(rows, { budget: '300-500' }).map((m) => m.id)).toEqual(['mid']);
    expect(filterSavedMeals(rows, { budget: '500+' }).map((m) => m.id)).toEqual(['high']);
  });

  it('uses the web band edges: 300 is in 100-300, 500 is in 300-500', () => {
    expect(savedMealMatchesBudget(meal({ price: 100 }), '100-300')).toBe(true);
    expect(savedMealMatchesBudget(meal({ price: 300 }), '100-300')).toBe(true);
    expect(savedMealMatchesBudget(meal({ price: 300 }), '300-500')).toBe(false);
    expect(savedMealMatchesBudget(meal({ price: 301 }), '300-500')).toBe(true);
    expect(savedMealMatchesBudget(meal({ price: 500 }), '300-500')).toBe(true);
    expect(savedMealMatchesBudget(meal({ price: 500 }), '500+')).toBe(false);
    expect(savedMealMatchesBudget(meal({ price: 501 }), '500+')).toBe(true);
  });

  it('puts a boundary price in exactly one band, never two', () => {
    for (const price of [100, 300, 301, 500, 501, 900]) {
      const matched = BUDGET_OPTIONS.filter((o) => o.value !== ALL_FILTER).filter((o) =>
        savedMealMatchesBudget(meal({ price }), o.value)
      );
      expect(matched.length).toBe(1);
    }
  });

  it('offers the web bands in web order, with an any reset', () => {
    expect(BUDGET_OPTIONS).toEqual([
      { value: 'all', label: 'Any budget' },
      { value: '100-300', label: '₱100-300' },
      { value: '300-500', label: '₱300-500' },
      { value: '500+', label: '₱500+' },
    ]);
  });

  it('excludes rows cheaper than 100 from every band, as web does', () => {
    const row = meal({ price: 80 });
    for (const band of BUDGET_OPTIONS.filter((o) => o.value !== ALL_FILTER)) {
      expect(savedMealMatchesBudget(row, band.value)).toBe(false);
    }
    expect(savedMealMatchesBudget(row, ALL_FILTER)).toBe(true);
  });

  it('hides a null-price row under any band but never under all', () => {
    const row = meal({ price: null });
    expect(savedMealMatchesBudget(row, '100-300')).toBe(false);
    expect(savedMealMatchesBudget(row, '500+')).toBe(false);
    expect(savedMealMatchesBudget(row, ALL_FILTER)).toBe(true);
  });
});


describe('cuisine filter — narrows by the cafe catalog entry', () => {
  it('keeps only rows whose catalog cafe carries the cuisine', () => {
    const rows = [
      meal({ id: 'shawarma', cafe_name: 'Ali House of Shawarma Halal' }),
      meal({ id: 'gulay', cafe_name: 'Oh My Gulay' }),
      meal({ id: 'ramen', cafe_name: 'Agara Ramen' }),
    ];
    expect(filterSavedMeals(rows, { cuisine: 'Halal' }).map((m) => m.id)).toEqual(['shawarma']);
    expect(filterSavedMeals(rows, { cuisine: 'Filipino' }).map((m) => m.id)).toEqual(['gulay']);
    expect(filterSavedMeals(rows, { cuisine: 'Ramen' }).map((m) => m.id)).toEqual(['ramen']);
  });

  it('matches by cafe name, case-insensitively, like web', () => {
    expect(
      savedMealMatchesCuisine(meal({ cafe_name: 'ali house of shawarma halal' }), 'Halal')
    ).toBe(true);
    expect(savedMealMatchesCuisine(meal({ cafe_name: ' Agara Ramen ' }), 'ramen')).toBe(true);
  });

  it('offers the cuisines of the vendored catalog, deduped and sorted', () => {
    const catalogSet = new Set<string>();
    for (const cafe of CAFES) {
      for (const c of cafe.cuisine) catalogSet.add(c.toLowerCase());
    }
    const offered = new Set(CUISINE_OPTIONS.map((o) => o.value));
    expect(offered).toEqual(catalogSet);
    const labels = CUISINE_OPTIONS.map((o) => o.label);
    expect([...labels].sort((a, b) => a.localeCompare(b))).toEqual(labels);
    expect(CUISINE_FILTER_OPTIONS[0]).toEqual({ value: 'all', label: 'All cuisines' });
    expect(CUISINE_FILTER_OPTIONS.slice(1)).toEqual(CUISINE_OPTIONS);
  });

  it('lists no cuisine twice across casings', () => {
    const keys = CUISINE_OPTIONS.map((o) => o.value.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('an unknown cafe hides under a cuisine filter but survives all', () => {
    const row = meal({ cafe_name: 'A Cafe From Another City' });
    expect(savedMealMatchesCuisine(row, 'Halal')).toBe(false);
    expect(savedMealMatchesCuisine(row, ALL_FILTER)).toBe(true);
    expect(filterSavedMeals([row], {})).toEqual([row]);
  });
});


describe('filters compose', () => {
  it('intersects a meal type with a budget band', () => {
    const rows = [
      meal({ id: 'lunch-cheap', meal_type: 'Lunch', price: 150 }),
      meal({ id: 'lunch-dear', meal_type: 'Lunch', price: 900 }),
      meal({ id: 'dinner-dear', meal_type: 'Dinner', price: 900 }),
    ];
    expect(filterSavedMeals(rows, { mealType: 'Lunch', budget: '100-300' }).map((m) => m.id)).toEqual(
      ['lunch-cheap']
    );
  });

  it('intersects a budget band with a cuisine', () => {
    const rows = [
      meal({ id: 'halal-cheap', cafe_name: 'Ali House of Shawarma Halal', price: 150 }),
      meal({ id: 'halal-dear', cafe_name: 'Ali House of Shawarma Halal', price: 900 }),
      meal({ id: 'gulay-cheap', cafe_name: 'Oh My Gulay', price: 150 }),
    ];
    expect(
      filterSavedMeals(rows, { budget: '100-300', cuisine: 'Halal' }).map((m) => m.id)
    ).toEqual(['halal-cheap']);
  });

  it('intersects all three filters and the search at once', () => {
    const rows = [
      meal({ id: 'hit', meal_type: 'Dinner', price: 600, cafe_name: 'Agara Ramen' }),
      meal({ id: 'no-type', meal_type: 'Lunch', price: 600, cafe_name: 'Agara Ramen' }),
      meal({ id: 'no-budget', meal_type: 'Dinner', price: 200, cafe_name: 'Agara Ramen' }),
      meal({ id: 'no-cuisine', meal_type: 'Dinner', price: 600, cafe_name: 'Oh My Gulay' }),
      meal({
        id: 'no-query',
        meal_type: 'Dinner',
        price: 600,
        cafe_name: 'Hiraya Cafe',
        items: JSON.stringify([{ name: 'Rice Bowl', price: 600, quantity: 1 }]),
      }),
    ];
    const visible = filterSavedMeals(rows, {
      query: 'agara',
      mealType: 'Dinner',
      budget: '500+',
      cuisine: 'Ramen',
    });
    expect(visible.map((m) => m.id)).toEqual(['hit']);
  });

  it('search also narrows by cuisine, budget, and meal type through composition', () => {
    const rows = [
      meal({ id: 'ramen', cafe_name: 'Agara Ramen' }),
      meal({ id: 'shawarma', cafe_name: 'Ali House of Shawarma Halal' }),
    ];
    expect(filterSavedMeals(rows, { query: 'agar', cuisine: 'Korean' }).map((m) => m.id)).toEqual([]);
    expect(filterSavedMeals(rows, { query: 'agar', cuisine: 'Ramen' }).map((m) => m.id)).toEqual([
      'ramen',
    ]);
  });

  it('an all filter is inert for every other filter, and for search', () => {
    const rows = [meal({ id: 'a', price: 900, meal_type: 'Dinner' }), meal({ id: 'b', price: 150 })];
    expect(
      filterSavedMeals(rows, { mealType: ALL_FILTER, budget: ALL_FILTER, cuisine: ALL_FILTER })
    ).toEqual(rows);
    expect(filterSavedMeals(rows, {})).toEqual(rows);
    expect(filterSavedMeals(rows, { query: '   ' })).toEqual(rows);
  });
});


describe('empty intersection', () => {
  it('returns no rows when the filters exclude every row', () => {
    const rows = [meal({ id: 'a', meal_type: 'Lunch', price: 150 })];
    expect(filterSavedMeals(rows, { mealType: 'Dinner' })).toEqual([]);
    expect(filterSavedMeals(rows, { cuisine: 'Filipino' })).toEqual([]);
    expect(filterSavedMeals(rows, { budget: '500+' })).toEqual([]);
    expect(filterSavedMeals(rows, {}).map((m) => m.id)).toEqual(['a']);
  });

  it('an unknown band, cuisine, or type matches nothing', () => {
    expect(savedMealMatchesBudget(meal(), '250-999')).toBe(false);
    expect(savedMealMatchesCuisine(meal(), 'Klingon')).toBe(false);
    expect(savedMealMatchesMealType(meal({ meal_type: 'Lunch' }), 'Brunch')).toBe(false);
  });

  it('a single row failing every filter leaves nothing, but the row when all is off', () => {
    const row = meal({ meal_type: null, price: null, cafe_name: 'A Cafe From Another City' });
    expect(savedMealMatchesFilters(row, {})).toBe(true);
    expect(
      savedMealMatchesFilters(row, { mealType: 'Breakfast', budget: '100-300', cuisine: 'Cafe' })
    ).toBe(false);
  });
});


describe('a row with meal_type null', () => {
  it('is visible when no meal-type filter is applied', () => {
    const row = meal({ id: 'null-row', meal_type: null });
    expect(filterSavedMeals([row], {})).toEqual([row]);
    expect(savedMealMatchesFilters(row, { query: 'shawarma' })).toBe(true);
  });

  it('is not dropped by an meal-type filter set to all', () => {
    const rows = [
      meal({ id: 'null-row', meal_type: null }),
      meal({ id: 'lunch', meal_type: 'Lunch' }),
    ];
    expect(filterSavedMeals(rows, { mealType: ALL_FILTER }).map((m) => m.id)).toEqual([
      'null-row',
      'lunch',
    ]);
  });

  it('is not dropped by other filters being off either', () => {
    const row = meal({ id: 'null-row', meal_type: null });
    expect(savedMealMatchesFilters(row, { budget: ALL_FILTER, cuisine: ALL_FILTER })).toBe(true);
  });

  it('disappears only under a specific meal type, which is no match for null', () => {
    const row = meal({ meal_type: null });
    for (const type of MEAL_TYPE_OPTIONS.filter((o) => o.value !== ALL_FILTER)) {
      expect(savedMealMatchesMealType(row, type.value)).toBe(false);
    }
  });
});
