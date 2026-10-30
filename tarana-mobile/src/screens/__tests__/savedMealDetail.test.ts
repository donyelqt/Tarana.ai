import { describe, expect, it } from '@jest/globals';
import { CAFES, findCafe } from '../../data/catalog';
import {
  cafeCoordinates,
  mealCardDishCount,
  mealCardItems,
  mealCardTotal,
  mealCardValidUntil,
} from '../savedMealDetail';

describe('cafe coordinates — resolves a real pin when one exists', () => {
  it('returns the pinned coordinate for a cafe in the shared database', () => {
    expect(cafeCoordinates('Oh My Gulay')).toEqual({ lat: 16.4118, lon: 120.5981 });
  });

  it('accepts the cafe object, not just the name', () => {
    expect(cafeCoordinates(findCafe('KoCo Cafe'))).toEqual({ lat: 16.4083, lon: 120.5944 });
  });

  it('bridges the spelling drift between the two data sources', () => {
    expect(cafeCoordinates('OH MY GULAY')).toEqual({ lat: 16.4118, lon: 120.5981 });
    expect(cafeCoordinates('oh  my   gulay')).toEqual({ lat: 16.4118, lon: 120.5981 });
  });

  it('does NOT bridge a genuine misspelling — that stays a disabled action', () => {
    expect(cafeCoordinates('Good Shepherd Cafe')).toBeNull();
    expect(cafeCoordinates('Good Sheperd Cafe')).toEqual({ lat: 16.4063, lon: 120.6025 });
  });

  it('ignores case, accents and punctuation', () => {
    expect(cafeCoordinates('café  de casa')).toBeNull(); 
    expect(cafeCoordinates('  oH mY gUlAy! ')).toEqual({ lat: 16.4118, lon: 120.5981 });
  });
});

describe('cafe coordinates — never resolves a wrong pin', () => {
  it('does not mine a landmark out of the prose location', () => {
    const cafe = findCafe('K-Flavors Buffet');
    expect(cafe?.location).toBe('Upper Session Road');
    expect(cafeCoordinates(cafe!.name)).toEqual({ lat: 16.407, lon: 120.5923 });
    expect(cafeCoordinates(cafe!.name)).not.toEqual({ lat: 16.4075, lon: 120.5923 });
  });

  it('does not collapse two distinct cafes onto one key', () => {
    const normalise = (v: string) =>
      v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    expect(normalise('Kubo Grill')).not.toBe(normalise('Kubo Grill Baguio'));
    expect(cafeCoordinates('Kubo Grill')).toBeNull();
    expect(cafeCoordinates('Kubo Grill Baguio')).toBeNull();
  });

  it('returns null for a cafe the database does not cover', () => {
    expect(cafeCoordinates('Ali House of Shawarma Halal')).toBeNull();
  });

  it('returns null for empty, null and non-cafe input', () => {
    expect(cafeCoordinates(null)).toBeNull();
    expect(cafeCoordinates(undefined)).toBeNull();
    expect(cafeCoordinates('')).toBeNull();
    expect(cafeCoordinates('   ')).toBeNull();
  });

  it('resolves a coordinate for every catalogued cafe that has one', () => {
    const resolved = CAFES.filter((c) => cafeCoordinates(c) !== null);
    expect(resolved.length).toBeGreaterThan(9);
    for (const cafe of resolved) {
      const coords = cafeCoordinates(cafe)!;
      expect(Number.isFinite(coords.lat)).toBe(true);
      expect(Number.isFinite(coords.lon)).toBe(true);
      expect(coords.lat).toBeGreaterThan(16.3);
      expect(coords.lat).toBeLessThan(16.5);
      expect(coords.lon).toBeGreaterThan(120.5);
      expect(coords.lon).toBeLessThan(120.7);
    }
  });
});

describe('meal card items — shape the stored snapshot', () => {
  it('reads the multi-dish snapshot with its quantities', () => {
    const rows = mealCardItems(
      JSON.stringify([
        { name: 'Nacho Fiesta', price: 498, quantity: 1 },
        { name: 'Hot Chocolate', price: 120, quantity: 2 },
      ])
    );
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({ name: 'Hot Chocolate', price: 120, quantity: 2, lineTotal: 240 });
  });

  it('treats a row with no usable quantity as one dish, not zero', () => {
    expect(mealCardItems(JSON.stringify([{ name: 'Tacos', price: 100 }]))[0].quantity).toBe(1);
    expect(mealCardItems(JSON.stringify([{ name: 'Tacos', price: 100, quantity: 0 }]))[0].quantity).toBe(1);
    expect(mealCardItems(JSON.stringify([{ name: 'Tacos', price: 100, quantity: -3 }]))[0].quantity).toBe(1);
    expect(mealCardItems(JSON.stringify([{ name: 'Tacos', price: 100, quantity: 'three' }]))[0].quantity).toBe(1);
  });

  it('keeps a null price null rather than rendering a free dish', () => {
    const rows = mealCardItems(JSON.stringify([{ name: 'Chimichanga', price: null, quantity: 1 }]));
    expect(rows[0].lineTotal).toBeNull();
    expect(mealCardTotal(rows)).toBe(0);
  });

  it('drops rows without a name rather than inventing a line', () => {
    const rows = mealCardItems(
      JSON.stringify([{ price: 120, quantity: 1 }, { name: 'Tacos', price: 100, quantity: 1 }, null, 'nope'])
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Tacos');
  });

  it('degrades unparseable items to no rows, never a throw', () => {
    expect(mealCardItems(null)).toEqual([]);
    expect(mealCardItems('')).toEqual([]);
    expect(mealCardItems('not json')).toEqual([]);
    expect(mealCardItems('{}')).toEqual([]);
    expect(mealCardItems('"a string"')).toEqual([]);
  });
});

describe('meal card total — the number staff adds up by hand', () => {
  it('sums price x quantity, matching web MealCardPopup', () => {
    const rows = mealCardItems(
      JSON.stringify([
        { name: 'Nacho Fiesta', price: 498, quantity: 1 },
        { name: 'Hot Chocolate', price: 120, quantity: 2 },
      ])
    );
    expect(mealCardTotal(rows)).toBe(738);
  });

  it('never goes NaN when a price is missing', () => {
    const rows = mealCardItems(
      JSON.stringify([
        { name: 'Tacos', price: null, quantity: 1 },
        { name: 'Rice', price: 60, quantity: 1 },
      ])
    );
    const total = mealCardTotal(rows);
    expect(Number.isNaN(total)).toBe(false);
    expect(total).toBe(60);
  });

  it('is zero for no rows, so an empty card shows a total not a crash', () => {
    expect(mealCardTotal([])).toBe(0);
  });

  it('counts dishes by quantity for the footer', () => {
    const rows = mealCardItems(
      JSON.stringify([
        { name: 'Nacho Fiesta', price: 498, quantity: 1 },
        { name: 'Hot Chocolate', price: 120, quantity: 2 },
      ])
    );
    expect(rows).toHaveLength(2);
    expect(mealCardDishCount(rows)).toBe(3);
  });
});

describe('meal card validity — one year out, web format', () => {
  it('is one year ahead, in "Month D, YYYY" as web prints it', () => {
    expect(mealCardValidUntil(new Date('2026-03-05T10:00:00Z'))).toBe('March 5, 2027');
  });

  it('handles the leap day the browser can read', () => {
    expect(mealCardValidUntil(new Date('2028-02-29T00:00:00Z'))).toBe('March 1, 2029');
  });
});
