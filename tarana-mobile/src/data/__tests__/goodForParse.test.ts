/**
 * `parseStoredGoodFor` and the export path's use of it — the contract that a
 * stored `meals.good_for` column is read as an array, never as the raw JSON
 * string the column holds.
 *
 * Why this is a contract and not a detail: the column is `TEXT` (the schema
 * writes `JSON.stringify([]`)), `LocalMeal.good_for` is typed `string[]`, and
 * `toMeal` parses on the way OUT of SQLite — so a list read through
 * `listMealsByProfile` always sees an array, and the export path was the one
 * consumer of a value that had NOT been through `toMeal`. There
 * `(meal.good_for ?? []).find(...)` holds a string and throws
 * `TypeError: ... .find is not a function`, which takes down `exportLocalMeals`
 * for EVERY local meal, not just the offending row — a batch the user cannot
 * resume until the code changes. The existing export specs mocked `../../db`
 * and therefore never produced the storage shape, so nothing caught it.
 *
 * What is pinned here:
 * 1. Every storage form degrades to an array, never a throw: `null`, `''`,
 *    `'[]'`, non-JSON text, a JSON scalar, a JSON object, a number. A batch
 *    over every local meal may not be undone by one bad column.
 * 2. The JSON-string form that the column actually holds (`'["Halal"]'`) is
 *    decoded to its entries — this is the fix.
 * 3. An already-parsed array still works, so a caller on either side of
 *    `toMeal` never sees a different answer.
 * 4. The export body therefore flattens that array to the ONE web string
 *    exactly as it did before, so the crash fix changes nothing about what
 *    gets sent.
 *
 * The export is asserted through `exportLocalMeals` with the network doubled
 * (the same scaffolding as `mealsSync.test.ts`), because `buildMealExportBody`
 * is internal to the seam and its observable behaviour IS the request body.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { parseStoredGoodFor } from '../../db/goodFor';
import { exportLocalMeals } from '../../data';
import type { LocalMeal } from '../../db';

/**
 * `../config` is mocked so the seam's `config.webBaseUrl` resolves without
 * pulling `expo-constants`, which jest cannot transform. Same surface as
 * `mealsSync.test.ts` — the seam reads it through this object.
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
 * `tarana-web/*` is stubbed for the same reason as `mealsSync.test.ts`: the
 * remap resolves this suite, but nothing here needs city math.
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

/**
 * SQLite double: one row-set per test, driven through `listMealsByProfile`,
 * exactly as `mealsSync.test.ts` does. NOTE what this double cannot do: it
 * hands back the meal objects as written, so a test that wants the STORAGE
 * shape (`good_for` as a JSON string) must say so explicitly — that is how
 * the bug survived here in the first place.
 *
 * `linkExportedRow` is present because the export path now writes the web id
 * back to the row after a successful POST. It resolves without tracking
 * anything: this suite asserts the REQUEST the seam builds, and the write-back
 * is the db layer's contract, covered by `linkExportedRow.test.ts` and
 * `exportImportConvergence.test.ts`.
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

/**
 * A fully-formed local meal whose `good_for` holds whatever the TEXT column
 * can actually hold — a JSON string, `null`, blank, junk — rather than the
 * array `toMeal` hands back.
 *
 * This cast IS the bug under test: `LocalMeal.good_for` is typed `string[]`
 * while the column stores a string, and that mismatch is exactly what
 * `buildMealExportBody` used to choke on. The value is asserted, not
 * validated, because it is a fixture standing in for what a row on disk looks
 * like — no runtime check could produce the shape being proved. It is the
 * test seam for the storage shape, so it is worth a function of its own.
 */
function mealWithStoredGoodFor(storage: unknown, overrides: Partial<LocalMeal> = {}): LocalMeal {
  return localMeal({ ...overrides, good_for: storage as string[] });
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
  mockListMealsByProfile().mockResolvedValue([]);
});

describe('parseStoredGoodFor — every stored form degrades to an array', () => {
  it('decodes the JSON-string form the column actually holds', () => {
    expect(parseStoredGoodFor('["Coffee", "Local Beans"]')).toEqual(['Coffee', 'Local Beans']);
    expect(parseStoredGoodFor('["Halal"]')).toEqual(['Halal']);
  });

  it('takes an empty array from an empty JSON array', () => {
    expect(parseStoredGoodFor('[]')).toEqual([]);
  });

  it('degrades null and undefined to an empty array', () => {
    expect(parseStoredGoodFor(null)).toEqual([]);
    expect(parseStoredGoodFor(undefined)).toEqual([]);
  });

  it("degrades '' and whitespace, which String.prototype.trim is truthy for but carry no value", () => {
    expect(parseStoredGoodFor('')).toEqual([]);
    expect(parseStoredGoodFor('   ')).toEqual([]);
  });

  it('degrades non-JSON text to an empty array, never a throw', () => {
    expect(parseStoredGoodFor('Halal')).toEqual([]);
    expect(parseStoredGoodFor('not json at all')).toEqual([]);
    expect(parseStoredGoodFor('{broken')).toEqual([]);
  });

  it('degrades a JSON scalar to an empty array: a lone string is storage, not a label', () => {
    // This is the deliberate split from `mealGoodFor`, where the web row type
    // means `"Halal"` as the single label it is. Here a bare string is an
    // encoding, and accepting it would send a label the column never stored.
    expect(parseStoredGoodFor('"Halal"')).toEqual([]);
    expect(parseStoredGoodFor('17')).toEqual([]);
    expect(parseStoredGoodFor('true')).toEqual([]);
    expect(parseStoredGoodFor('null')).toEqual([]);
  });

  it('degrades a JSON object to an empty array', () => {
    expect(parseStoredGoodFor('{"good_for":["Halal"]}')).toEqual([]);
  });

  it('keeps only the string entries of a parsed array, dropping junk rather than trusting it', () => {
    expect(parseStoredGoodFor('["Halal", 1, null, true, "Vegan"]')).toEqual(['Halal', 'Vegan']);
  });

  it('passes an already-parsed array through, so a caller on either side of toMeal agrees', () => {
    expect(parseStoredGoodFor(['Coffee', 'Local Beans'])).toEqual(['Coffee', 'Local Beans']);
    expect(parseStoredGoodFor([])).toEqual([]);
    // The signature is `unknown`, so a mixed array needs no assertion — and
    // the parser's own filtering is what makes it safe to hand in.
    expect(parseStoredGoodFor(['Halal', 1, null])).toEqual(['Halal']);
  });

  it('degrades a non-array non-string value to an empty array', () => {
    expect(parseStoredGoodFor(17)).toEqual([]);
    expect(parseStoredGoodFor(true)).toEqual([]);
    expect(parseStoredGoodFor({})).toEqual([]);
  });
});

describe('exportLocalMeals — a stored good_for no longer breaks the batch', () => {
  it('decodes the JSON-string storage into the one web string it always sends', async () => {
    mockListMealsByProfile().mockResolvedValue([
      mealWithStoredGoodFor('["Coffee", "Local Beans"]'),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 1, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    // Identical to the pre-fix body: the fix changes how the value is READ,
    // never what is sent.
    expect(captured[0].body).toMatchObject({ good_for: 'Coffee' });
  });

  it('exports with a null good_for when the stored array is empty', async () => {
    mockListMealsByProfile().mockResolvedValue([mealWithStoredGoodFor('[]')]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: null });
  });

  it('exports with a null good_for when the stored value is null or blank, instead of throwing', async () => {
    mockListMealsByProfile().mockResolvedValue([
      mealWithStoredGoodFor(''),
      mealWithStoredGoodFor(null, { id: 'meal-null-good-for' }),
      mealWithStoredGoodFor('   ', { id: 'meal-blank-good-for' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 3, skipped: 0, failures: [] });
    for (const request of captured) {
      expect(request.body).toMatchObject({ good_for: null });
    }
  });

  it('exports with a null good_for when the stored value is not valid JSON', async () => {
    // A malformed column must cost the row its label, never the batch: the
    // other meals still export.
    mockListMealsByProfile().mockResolvedValue([
      mealWithStoredGoodFor('[oops', { id: 'meal-corrupt' }),
      mealWithStoredGoodFor('"Halal"', { id: 'meal-scalar' }),
      mealWithStoredGoodFor('{"good_for":["Halal"]}', { id: 'meal-object' }),
      localMeal({ id: 'meal-fine', cafe_name: 'Also Fine' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 4, skipped: 0, failures: [] });
    expect(captured[0].body).toMatchObject({ good_for: null });
    expect(captured[1].body).toMatchObject({ good_for: null });
    expect(captured[2].body).toMatchObject({ good_for: null });
    // The healthy row is unaffected and still carries its first entry.
    expect(captured[3].body).toMatchObject({ good_for: 'Coffee' });
  });

  it('still skips a blank first entry and the 20-character cap from stored JSON', async () => {
    mockListMealsByProfile().mockResolvedValue([
      mealWithStoredGoodFor('["", "Cozy"]', { id: 'meal-blank-first' }),
      mealWithStoredGoodFor('["An extremely verbose popular-for label that would 400"]', { id: 'meal-over-cap' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: 'Cozy' });
  });

  it('still exports a meal whose good_for is already a parsed array', async () => {
    // The list path (`toMeal`) hands back an array; the export must not now
    // depend on the storage shape alone.
    mockListMealsByProfile().mockResolvedValue([localMeal({ good_for: ['Vegan'] })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: 'Vegan' });
  });
});
