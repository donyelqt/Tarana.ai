/**
 * SavedCafes search predicate — the observable contract of one row either
 * surviving the list filter or not.
 *
 * The list is the mobile half of the web saved-meals page, whose search
 * matches cafe name, meal type, and every dish name in the row
 * (`src/app/saved-meals/page.tsx:72-74`). This predicate was the gap: it
 * matched cafe name and meal type only, so a user searching "shawarma"
 * lost a row whose dish names were sitting on the device in `items`.
 *
 * The predicate is pure and exported from `../savedMeals`, so these tests
 * need no navigation stack, no SQLite, and no React Native render.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. A dish-name query finds the row. The bug itself: without it the
 *    search silently cannot reach data the screen already holds.
 * 2. A row with unparseable `items` still appears under an empty query.
 *    Degrading to no DISHES must never degrade to no ROW, or a corrupt
 *    column would make the list lose saved meals entirely.
 * 3. A malformed `items` string never throws. It is a column of arbitrary
 *    text (null, `"{}"`, truncated JSON, a bare array of non-objects) and
 *    the list filter runs per keystroke.
 * 4. Cafe name and meal type keep matching exactly as before, same
 *    case-insensitivity, so no existing search regresses while dish
 *    matching is added.
 */
import { describe, expect, it } from '@jest/globals';
import { savedMealMatchesQuery } from '../savedMeals';
import type { LocalMeal } from '../../data';

/** A fully-shaped local row; each test overrides only the fields it varies. */
function meal(overrides: Partial<LocalMeal> = {}): LocalMeal {
  return {
    id: 'meal-1',
    profile_id: 'profile-1',
    cafe_name: "Ali House of Shawarma",
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

describe('SavedCafes search — dish-name matching (the parity gap)', () => {
  it('finds a row by a dish name from items', () => {
    expect(savedMealMatchesQuery(meal(), 'shawarma')).toBe(true);
  });

  it('matches a dish name case-insensitively, from either side', () => {
    expect(savedMealMatchesQuery(meal(), 'BEEF SHAWARMA')).toBe(true);
    expect(savedMealMatchesQuery(meal(), 'kebab')).toBe(true);
    expect(savedMealMatchesQuery(meal(), '  wrap  ')).toBe(true);
  });

  it('matches a partial dish-name substring, not only whole names', () => {
    expect(savedMealMatchesQuery(meal(), 'shaw')).toBe(true);
  });

  it('finds every row in a set whose dish name matches, and only those', () => {
    const target = meal({ id: 'meal-1', items: JSON.stringify([{ name: 'Beef Shawarma Wrap', price: 180 }]) });
    const other = meal({ id: 'meal-2', cafe_name: 'Kubo Grill', meal_type: 'Dinner', items: JSON.stringify([{ name: 'Sisig', price: 300 }]) });
    const third = meal({ id: 'meal-3', cafe_name: 'Good Shepherd Cafe', meal_type: 'Snacks', items: JSON.stringify([{ name: 'Strawberry Shortcake', price: 160 }]) });

    const matched = [target, other, third].filter((m) => savedMealMatchesQuery(m, 'shawarma'));
    expect(matched.map((m) => m.id)).toEqual(['meal-1']);
  });

  it('does not match a query that is neither cafe, type, nor dish', () => {
    expect(savedMealMatchesQuery(meal(), 'ramen')).toBe(false);
  });
});

describe('SavedCafes search — cafe name and meal type are unchanged', () => {
  it('matches the cafe name', () => {
    expect(savedMealMatchesQuery(meal(), 'ali house')).toBe(true);
  });

  it('matches the meal type', () => {
    expect(savedMealMatchesQuery(meal(), 'lunch')).toBe(true);
  });

  it('matches cafe name and meal type case-insensitively', () => {
    expect(savedMealMatchesQuery(meal(), 'ALI')).toBe(true);
    expect(savedMealMatchesQuery(meal(), 'LUNCH')).toBe(true);
  });

  it('returns every row when the query is empty or whitespace', () => {
    expect(savedMealMatchesQuery(meal(), '')).toBe(true);
    expect(savedMealMatchesQuery(meal(), '   ')).toBe(true);
  });

  it('matches a row with no meal type and no items on cafe name alone', () => {
    const row = meal({ meal_type: null, items: null });
    // Both optional-match fields are absent, so cafe name is the only
    // remaining route to this row — and it must still work.
    expect(savedMealMatchesQuery(row, 'house of shawarma')).toBe(true);
    expect(savedMealMatchesQuery(row, 'kebab')).toBe(false);
  });

  it('filters a list the way the screen does — no filter regression', () => {
    const rows = [
      meal({ id: 'a' }),
      meal({ id: 'b', cafe_name: 'Kubo Grill', meal_type: 'Dinner', items: JSON.stringify([{ name: 'Sisig', price: 300 }]) }),
      meal({ id: 'c', cafe_name: 'Oh My Gulay', meal_type: 'Lunch', items: JSON.stringify([{ name: 'Pakbet', price: 200 }]) }),
    ];

    const byCafe = rows.filter((m) => savedMealMatchesQuery(m, 'kubo'));
    expect(byCafe.map((m) => m.id)).toEqual(['b']);

    const byType = rows.filter((m) => savedMealMatchesQuery(m, 'lunch'));
    expect(byType.map((m) => m.id)).toEqual(['a', 'c']);

    const byDish = rows.filter((m) => savedMealMatchesQuery(m, 'pakbet'));
    expect(byDish.map((m) => m.id)).toEqual(['c']);
  });
});

describe('SavedCafes search — malformed items degrades, never crashes', () => {
  it('returns the row under an empty query when items is null', () => {
    expect(savedMealMatchesQuery(meal({ items: null }), '')).toBe(true);
  });

  it('matches no dish for null items, but keeps name and type matches', () => {
    const row = meal({ items: null });
    expect(savedMealMatchesQuery(row, 'shawarma')).toBe(true); // cafe name
    expect(savedMealMatchesQuery(row, 'beef')).toBe(false); // no dish
  });

  it('treats empty-string items as no dishes', () => {
    const row = meal({ items: '' });
    expect(savedMealMatchesQuery(row, 'beef')).toBe(false);
    expect(savedMealMatchesQuery(row, 'ali')).toBe(true);
  });

  // Truncated JSON is the realistic corruption of a text column written
  // by an import the user's device was killed mid-way through.
  it('does not throw on truncated JSON', () => {
    const row = meal({ items: '[{"name":"Beef Shawarma' });
    expect(() => savedMealMatchesQuery(row, 'shawarma')).not.toThrow();
    expect(savedMealMatchesQuery(row, 'shawarma')).toBe(true); // cafe name still
  });

  it('does not throw on non-JSON text and treats it as no dishes', () => {
    const row = meal({ items: 'not json at all' });
    expect(() => savedMealMatchesQuery(row, 'shawarma')).not.toThrow();
    expect(savedMealMatchesQuery(row, 'shawarma')).toBe(true);
    expect(savedMealMatchesQuery(row, 'beef')).toBe(false);
  });

  it('treats a JSON object (non-array) as no dishes', () => {
    const row = meal({ items: JSON.stringify({ name: 'Beef Shawarma Wrap' }) });
    expect(savedMealMatchesQuery(row, 'beef')).toBe(false);
    expect(savedMealMatchesQuery(row, '')).toBe(true);
  });

  it('treats a JSON array of non-objects as no dishes', () => {
    const row = meal({ items: JSON.stringify(['Beef Shawarma Wrap', 42, null]) });
    expect(savedMealMatchesQuery(row, 'beef')).toBe(false);
    expect(savedMealMatchesQuery(row, '')).toBe(true);
  });

  // Entries whose name is missing or non-string cannot be searched, but
  // they must not mask the valid dishes beside them.
  it('skips entries without a usable name and keeps the rest searchable', () => {
    const row = meal({
      items: JSON.stringify([
        { price: 100 },
        { name: 42 },
        { name: 'Beef Shawarma Wrap', price: 180 },
      ]),
    });
    expect(savedMealMatchesQuery(row, 'beef')).toBe(true);
    expect(savedMealMatchesQuery(row, '')).toBe(true);
  });

  it('keeps the whole list renderable when every row has corrupt items', () => {
    const rows = [
      meal({ id: 'a', items: null }),
      meal({ id: 'b', items: 'garbage' }),
      meal({ id: 'c', items: JSON.stringify({ nope: true }) }),
    ];
    expect(rows.filter((m) => savedMealMatchesQuery(m, '')).map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });
});
