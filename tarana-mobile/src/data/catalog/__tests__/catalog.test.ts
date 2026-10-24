/**
 * Catalog completeness gate.
 *
 * The offline detail screen hides its menu section when `hasMenu` is false
 * (no dead buttons). This test pins the invariant that every vendored cafe
 * entry actually carries a real menu, so a future entry added without
 * `fullMenu` fails here instead of silently hiding content in the app.
 */
import { describe, expect, it } from '@jest/globals';
import { CAFES, menuDishCount } from '../index';
import type { Cafe, FullMenu } from '../types';

const MEAL_SLOTS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;

describe('mobile cafe catalog', () => {
  it('vendors all 20 Baguio cafes', () => {
    expect(CAFES).toHaveLength(20);
  });

  it('has unique cafe names', () => {
    const names = CAFES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(CAFES.map((cafe) => [cafe.name, cafe] as const))(
    '%s reports hasMenu with a non-empty FullMenu',
    (_name: string, cafe: Cafe) => {
      expect(cafe.hasMenu).toBe(true);

      // Every slot must exist as an array — a missing key renders as
      // `undefined` in the detail screen and crashes on `.length`.
      for (const slot of MEAL_SLOTS) {
        expect(Array.isArray(cafe.fullMenu[slot])).toBe(true);
      }

      // At least one dish somewhere: a cafe menu of all-empty slots is a
      // regressed copy, not real content.
      expect(menuDishCount(cafe.fullMenu)).toBeGreaterThan(0);
    }
  );

  it.each(CAFES.map((cafe) => [cafe.name, cafe] as const))(
    '%s has valid dish records',
    (_name: string, cafe: Cafe) => {
      const slots = MEAL_SLOTS.map((slot) => cafe.fullMenu[slot]).flat();

      for (const dish of slots) {
        expect(typeof dish.name).toBe('string');
        expect(dish.name.trim()).not.toBe('');
        expect(typeof dish.description).toBe('string');
        expect(dish.description.trim()).not.toBe('');
        // Prices are pesos. Zero-priced dishes are real upstream data (e.g.
        // Yoshimeatsu's included-with-buffet sides), so only reject negatives
        // and non-numbers, which are transcription errors.
        expect(typeof dish.price).toBe('number');
        expect(dish.price).toBeGreaterThanOrEqual(0);
        expect(typeof dish.image).toBe('string');
        expect(dish.image.trim()).not.toBe('');
      }
    }
  );

  it('keeps every menu structurally identical to the web FullMenu shape', () => {
    for (const cafe of CAFES) {
      const keys = Object.keys(cafe.fullMenu).sort();
      expect(keys).toEqual([...MEAL_SLOTS].sort());
    }
  });

  it('does not leak EMPTY_MENU as a vendored cafe menu', () => {
    for (const cafe of CAFES) {
      const empty: FullMenu = {
        Breakfast: [],
        Lunch: [],
        Dinner: [],
        Snacks: [],
        Drinks: [],
      };
      expect(cafe.fullMenu).not.toEqual(empty);
    }
  });
});
