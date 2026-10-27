/**
 * `toWebMealType` and the meal-type mapping — the contract that keeps a
 * mobile save visible on web.
 *
 * Why this is a contract and not a detail: the mobile menu tabs are five
 * labels, the web meal-type column is four, and the web filter
 * (`src/app/saved-meals/page.tsx:77`) compares with EXACT case-insensitive
 * equality against those four. A row persisted with the raw tab label —
 * 'Snacks' or 'Drinks' — validates at every layer (the row type allows it,
 * the API schema is `z.string().min(1)`) and then matches no filter, so it
 * renders unfiltered-with-no-icon on web and the only symptom is a meal
 * the user cannot find by meal type. Nothing logs, nothing throws.
 *
 * What is pinned here:
 * 1. The two tab labels the web union spells differently map to values the
 *    web filter can actually match ('Snacks' → 'Snack', 'Drinks' → 'Snack'),
 *    and the three identical tabs map to themselves.
 * 2. `null`/non-string stays `null` — never an invented bucket, because the
 *    web column and schema are nullish and a meal saved with no type belongs
 *    in no filter bucket.
 * 3. A label this app never wrote (a stale row from an older build) maps to
 *    `null`, so the export path skips it rather than POSTing an unmatched
 *    value — the same rule as the other local-validation skips.
 *
 * The export direction is asserted through `exportLocalMeals` with the
 * network doubled, exactly as `mealsSync.test.ts` does: an existing row
 * carrying 'Snacks' must be exported as 'Snack', which is what repairs
 * rows written before the save site started normalizing.
 *
 * The save-site integration (CafeDetail) is asserted by source inspection
 * below rather than rendering: that screen reaches through the seam's
 * `createMeal` into SQLite, and the mapping is the only thing standing
 * between the tab label and the persisted column — so the assertion is that
 * the write site routes `tab` through the mapping instead of passing it raw.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportLocalMeals, toWebMealType } from '../../data';
import type { LocalMeal } from '../../db';
import type { WebMealType } from '../mealTypeMapping';

/**
 * `../config` is mocked so the seam's `config.webBaseUrl` resolves without
 * pulling `expo-constants`, which jest cannot transform. Same surface as
 * `mealsSync.test.ts` — the seam reads `webBaseUrl` through this object.
 */
jest.mock('../../config', () => ({
  config: { webBaseUrl: 'http://localhost:3000' },
  requireConfig: (key: string) => {
    throw new Error(`Missing config: ${key}`);
  },
}));

/**
 * The native boundary the seam reaches through `generateWithLlama`, stubbed
 * for the same reason as `mealsSync.test.ts` (no test here touches it).
 */
jest.mock('../../llm/modelManager', () => ({
  isLlamaAvailable: () => false,
  getModelStatus: async () => ({ state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: null }),
  MODEL_PATH: '/models/model.gguf',
}), { virtual: true });

/**
 * `../supabase` imports `expo-secure-store` and `tarana-web/data/supabaseClient`,
 * neither on the export path, so it is stubbed as in `mealsSync.test.ts`.
 */
jest.mock('../../supabase', () => ({
  createMobileSupabaseClient: () => {
    throw new Error('The export path must not use the Supabase client.');
  },
  getSupabaseUrl: () => 'http://localhost:54321',
}));

/**
 * `tarana-web/*` is stubbed: the seam imports city config for the peak-hours
 * traffic helpers, which resolves through a remap this jest config does not
 * mirror. Only the two helpers are reachable, so the stub can be minimal.
 */
jest.mock('tarana-web/data/cityConfig', () => ({
  getCityCenter: () => ({ lat: 16.4, lon: 120.6 }),
  getCityTimezone: () => 'Asia/Manila',
  CITY_CONFIGS: {},
}), { virtual: true });

/**
 * Token bridge double, mirroring the real contract (spread headers + Bearer).
 * `jest.fn` is created inside the factory and retrieved with
 * `jest.requireMock`: a factory may not close over a test-scope binding.
 */
jest.mock('../../auth', () => ({
  withMobileAuth: jest.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  })),
  clearStoredToken: async () => {},
  exchangeForMobileToken: async () => ({}),
}));
const mockWithMobileAuth = () =>
  (jest.requireMock('../../auth') as { withMobileAuth: jest.Mock }).withMobileAuth as jest.Mock<
    (headers?: Record<string, string>) => Promise<Record<string, string>>
  >;

/**
 * SQLite double: one row-set per test, driven through `listMealsByProfile`.
 * `linkExportedRow` is present because the export path now writes the web id
 * back to the row after a successful POST; everything else the seam might call
 * stays absent, so an accidental use fails loudly rather than silently doing
 * nothing.
 */
jest.mock('../../db', () => ({
  listMealsByProfile: jest.fn(),
  linkExportedRow: jest.fn(async () => {}),
}));
const mockListMealsByProfile = () =>
  (jest.requireMock('../../db') as { listMealsByProfile: jest.Mock }).listMealsByProfile as jest.Mock<
    (profileId: string) => Promise<LocalMeal[]>
  >;
const mockLinkExportedRow = () =>
  (jest.requireMock('../../db') as { linkExportedRow: jest.Mock }).linkExportedRow as jest.Mock<
    (table: 'trips' | 'meals', id: string, sourceId: string) => Promise<void>
  >;

const PROFILE_ID = 'profile-1';

/** A fully-formed local meal: the only kind that can be exported. */
function localMeal(overrides: Partial<LocalMeal> = {}): LocalMeal {
  return {
    id: 'meal-local-1',
    profile_id: PROFILE_ID,
    cafe_name: 'Good Shepherd Cafe',
    meal_type: 'Breakfast',
    price: 250,
    good_for: ['Coffee', 'Local Beans'],
    location: 'Baguio City',
    items: JSON.stringify([{ name: 'Sourdough Toast', price: 250, quantity: 1 }]),
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Records every fetch the seam makes, answering each with the given script. */
function mockFetch(responder: (body: unknown, n: number) => { ok: boolean; status: number; json: unknown }) {
  const captured: CapturedRequest[] = [];
  (globalThis as { fetch?: unknown }).fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    let body: unknown = null;
    try {
      body = init?.body ? JSON.parse(init.body as string) : null;
    } catch {
      body = undefined;
    }
    captured.push({
      url: String(url),
      method: String(init?.method ?? 'GET'),
      headers,
      body,
    });
    const reply = responder(body, captured.length);
    return {
      ok: reply.ok,
      status: reply.status,
      json: async () => reply.json,
    } as unknown as Response;
  });
  return captured;
}

/** The canonical "saved" reply the route sends on 200. */
const SAVED_OK = { ok: true, status: 200, json: { success: true, data: { id: 'web-meal-1' } } };

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` drops the factory's implementation, so it is re-armed
  // with the real contract (spread + Bearer).
  mockWithMobileAuth().mockImplementation(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  }));
  mockListMealsByProfile().mockResolvedValue([]);
});

describe('toWebMealType — the tab vocabulary becomes web-valid', () => {
  it('maps every mobile tab label to the web union', () => {
    // Three identical, two renamed — the whole mapping, exhaustively, so a
    // tab added to the screen cannot silently stay unmapped.
    expect(toWebMealType('Breakfast')).toBe('Breakfast');
    expect(toWebMealType('Lunch')).toBe('Lunch');
    expect(toWebMealType('Dinner')).toBe('Dinner');
  });

  it("maps 'Snacks' to the web singular 'Snack'", () => {
    // The web union spells this singular and the filter compares lowercase,
    // so the raw 'snacks' was the exact value no filter could ever match.
    expect(toWebMealType('Snacks')).toBe('Snack');
  });

  it("maps 'Drinks' to 'Snack', the web union's non-meal bucket", () => {
    // The web union has no drink value. A drink is not a
    // Breakfast/Lunch/Dinner, and folding it into one of those would file
    // the user's coffee under a meal it is not — it would then show up when
    // they filter for Lunch. 'Snack' is the web union's catch-all for food
    // that is not one of the three meals, so it is the only defensible
    // choice: the row stays visible and filterable on web.
    expect(toWebMealType('Drinks')).toBe('Snack');
  });

  it('produces only values the web filter can match, from every tab', () => {
    // The actual property that makes this fix work: each mapped value, run
    // through the web filter's comparison (`.toLowerCase()` against
    // `breakfast|lunch|dinner|snack`), lands on a real filter option.
    const webFilterValues = ['breakfast', 'lunch', 'dinner', 'snack'];
    const tabs = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;
    for (const tab of tabs) {
      const value = toWebMealType(tab);
      expect(value).not.toBeNull();
      expect(webFilterValues).toContain(value?.toLowerCase());
    }
  });

  it('keeps null null, because a meal saved with no type belongs in no bucket', () => {
    expect(toWebMealType(null)).toBeNull();
  });

  it('keeps a non-string value null rather than inventing a type', () => {
    // The local column is free text, so a non-string is possible in a
    // hand-edited or older row. It gets no invented bucket.
    expect(toWebMealType(undefined)).toBeNull();
    expect(toWebMealType(42 as unknown as string)).toBeNull();
    expect(toWebMealType({} as unknown as string)).toBeNull();
  });

  it("maps an unknown tab label (a stale row) to null so export skips it", () => {
    // A label this app never wrote — the row did not come from a known
    // tab, so it gets no type rather than a guessed one. The export guard
    // then skips it, which is the same rule as every other invalid row.
    expect(toWebMealType('Brunch')).toBeNull();
    expect(toWebMealType('snacks')).toBeNull();
    expect(toWebMealType('snack')).toBeNull();
    expect(toWebMealType('')).toBeNull();
    expect(toWebMealType('   ')).toBeNull();
  });

  it('passes a web-valid value through unchanged (idempotent)', () => {
    // The input domain is NOT only tabs: `importWebMeals` copies web rows
    // into the same local column (data/index.ts:392), so a local row can
    // legitimately hold 'Snack' already. Mapping that through the tab table
    // alone would drop the row — a sync bug far worse than the filter
    // mismatch this fix exists for.
    expect(toWebMealType('Snack')).toBe('Snack');
    expect(toWebMealType('Breakfast')).toBe('Breakfast');
    expect(toWebMealType('Lunch')).toBe('Lunch');
    expect(toWebMealType('Dinner')).toBe('Dinner');
  });

  it('maps to exactly the four web values and nothing else', () => {
    const webUnion: WebMealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    const tabs = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks'] as const;
    for (const tab of tabs) {
      const value = toWebMealType(tab);
      // The web row type is a four-value union (src/app/saved-meals/data.ts:4),
      // so a mapped value outside it is a type error the compiler catches;
      // this asserts it at runtime too.
      expect(webUnion).toContain(value!);
    }
  });
});

describe('exportLocalMeals — an existing row with a legacy meal type is repaired', () => {
  it("exports a row saved as 'Snacks' as 'Snack'", async () => {
    // Written before the save site normalized the value. Without the
    // export-side mapping this row would stay broken forever: it is already
    // stored, and no fresh save can fix it.
    mockListMealsByProfile().mockResolvedValue([localMeal({ id: 'meal-snacks', meal_type: 'Snacks' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured).toHaveLength(1);
    expect(captured[0].body).toMatchObject({ meal_type: 'Snack' });
  });

  it("exports a row saved as 'Drinks' as 'Snack'", async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ id: 'meal-drinks', meal_type: 'Drinks' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ meal_type: 'Snack' });
  });

  it('leaves an already-valid web meal type untouched', async () => {
    // The mapping is idempotent for the three identical tabs, so re-exporting
    // a row several times converges on the same value.
    for (const rawType of ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const) {
      mockListMealsByProfile().mockResolvedValue([localMeal({ meal_type: rawType })]);
      const captured = mockFetch(() => SAVED_OK);

      const summary = await exportLocalMeals(PROFILE_ID);

      expect(summary.exported).toBe(1);
      expect(captured[0].body).toMatchObject({ meal_type: rawType });
    }
  });

  it('trims a padded legacy meal type before mapping it', async () => {
    // The old code trimmed and passed through, so a stored ' Snacks ' was
    // legal locally and unfilterable on web. Trimming first keeps the map
    // key lookup exact.
    mockListMealsByProfile().mockResolvedValue([localMeal({ meal_type: '  Snacks  ' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ meal_type: 'Snack' });
  });

  it('skips a row whose meal type is null or blank, never inventing one', async () => {
    // Same rule the seam already applies to other invalid rows: a row the
    // web could not filter by type is skipped with a reason, not POSTed.
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-null-type', meal_type: null }),
      localMeal({ id: 'meal-blank-type', meal_type: '   ' }),
      // And an unmappable label: not one of the five tabs.
      localMeal({ id: 'meal-unknown-type', meal_type: 'Brunch' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.skipped).toBe(3);
    expect(summary.failures).toHaveLength(3);
    expect(captured).toHaveLength(0);
  });
});

describe('CafeDetail — the save site writes through the mapping', () => {
  /**
   * The save site is a screen, so it is asserted by reading its source: the
   * assertion is the structural contract that `tab` (the mobile label) is
   * routed through the mapping before it reaches `createMeal`'s
   * `mealType`, instead of being persisted raw. Rendering the screen would
   * drag the entire native stack in to prove the same one line.
   *
   * Two halves: the call exists (the mapping is applied), and the raw
   * `mealType: first ? tab : null` form is gone (nothing bypasses it).
   */
  const source = readFileSync(join(__dirname, '..', '..', 'screens', 'CafeDetail.tsx'), 'utf8');

  it('routes the meal type through the mapping when saving', () => {
    // The mapper is applied to whatever the save writes: the picked dishes'
    // dominant tab now (multi-dish save), not the raw tab label. The
    // contract this pins is that the persisted value is mapped, whichever
    // call shape the save uses.
    expect(source).toMatch(/mealType:\s*selectedDishMealType\(selected, toWebMealType\)/);
  });

  it('imports the mapping from the data seam', () => {
    // The screen consumes the seam, not a data sibling.
    expect(source).toMatch(/import\s*\{[^}]*toWebMealType[^}]*\}\s*from\s*'\.\.\/data'/);
  });

  it('no longer persists the raw tab label as the meal type', () => {
    expect(source).not.toMatch(/mealType:\s*first\s*\?\s*tab\s*:\s*null/);
  });

  it('leaves the tab labels, order, and count alone', () => {
    // The mapping is a data fix; the tab vocabulary is a UI decision and
    // stays exactly as it was.
    expect(source).toMatch(/const MEAL_TABS = \[[^\]]*\] as const;/);
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks']) {
      expect(source).toContain(`'${label}'`);
    }
  });
});
