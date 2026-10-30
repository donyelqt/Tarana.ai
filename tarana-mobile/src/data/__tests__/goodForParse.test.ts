import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { parseStoredGoodFor } from '../../db/goodFor';
import { exportLocalMeals } from '../../data';
import type { LocalMeal } from '../../db';

jest.mock('../../config', () => ({
  config: { webBaseUrl: 'http://localhost:3000' },
  requireConfig: (key: string) => {
    throw new Error(`Missing config: ${key}`);
  },
}));

jest.mock('../../llm/modelManager', () => ({
  isLlamaAvailable: () => false,
  getModelStatus: async () => ({ state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: null }),
  MODEL_PATH: '/models/model.gguf',
}), { virtual: true });

jest.mock('../../supabase', () => ({
  createMobileSupabaseClient: () => {
    throw new Error('The export path must not use the Supabase client.');
  },
  getSupabaseUrl: () => 'http://localhost:54321',
}));

jest.mock('tarana-web/data/cityConfig', () => ({
  getCityCenter: () => ({ lat: 16.4, lon: 120.6 }),
  getCityTimezone: () => 'Asia/Manila',
  CITY_CONFIGS: {},
}), { virtual: true });

jest.mock('../../auth', () => ({
  withMobileAuth: jest.fn(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  })),
  clearStoredToken: async () => {},
  exchangeForMobileToken: async () => ({}),
}));

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

function mealWithStoredGoodFor(storage: unknown, overrides: Partial<LocalMeal> = {}): LocalMeal {
  return localMeal({ ...overrides, good_for: storage as string[] });
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

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
    mockListMealsByProfile().mockResolvedValue([localMeal({ good_for: ['Vegan'] })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: 'Vegan' });
  });
});
