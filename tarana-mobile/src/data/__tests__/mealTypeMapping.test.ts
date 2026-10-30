import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportLocalMeals, toWebMealType } from '../../data';
import type { LocalMeal } from '../../db';
import type { WebMealType } from '../mealTypeMapping';

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
const mockWithMobileAuth = () =>
  (jest.requireMock('../../auth') as { withMobileAuth: jest.Mock }).withMobileAuth as jest.Mock<
    (headers?: Record<string, string>) => Promise<Record<string, string>>
  >;

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
  mockWithMobileAuth().mockImplementation(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  }));
  mockListMealsByProfile().mockResolvedValue([]);
});

describe('toWebMealType — the tab vocabulary becomes web-valid', () => {
  it('maps every mobile tab label to the web union', () => {
    expect(toWebMealType('Breakfast')).toBe('Breakfast');
    expect(toWebMealType('Lunch')).toBe('Lunch');
    expect(toWebMealType('Dinner')).toBe('Dinner');
  });

  it("maps 'Snacks' to the web singular 'Snack'", () => {
    expect(toWebMealType('Snacks')).toBe('Snack');
  });

  it("maps 'Drinks' to 'Snack', the web union's non-meal bucket", () => {
    expect(toWebMealType('Drinks')).toBe('Snack');
  });

  it('produces only values the web filter can match, from every tab', () => {
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
    expect(toWebMealType(undefined)).toBeNull();
    expect(toWebMealType(42 as unknown as string)).toBeNull();
    expect(toWebMealType({} as unknown as string)).toBeNull();
  });

  it("maps an unknown tab label (a stale row) to null so export skips it", () => {
    expect(toWebMealType('Brunch')).toBeNull();
    expect(toWebMealType('snacks')).toBeNull();
    expect(toWebMealType('snack')).toBeNull();
    expect(toWebMealType('')).toBeNull();
    expect(toWebMealType('   ')).toBeNull();
  });

  it('passes a web-valid value through unchanged (idempotent)', () => {
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
      expect(webUnion).toContain(value!);
    }
  });
});

describe('exportLocalMeals — an existing row with a legacy meal type is repaired', () => {
  it("exports a row saved as 'Snacks' as 'Snack'", async () => {
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
    for (const rawType of ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const) {
      mockListMealsByProfile().mockResolvedValue([localMeal({ meal_type: rawType })]);
      const captured = mockFetch(() => SAVED_OK);

      const summary = await exportLocalMeals(PROFILE_ID);

      expect(summary.exported).toBe(1);
      expect(captured[0].body).toMatchObject({ meal_type: rawType });
    }
  });

  it('trims a padded legacy meal type before mapping it', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ meal_type: '  Snacks  ' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ meal_type: 'Snack' });
  });

  it('skips a row whose meal type is null or blank, never inventing one', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-null-type', meal_type: null }),
      localMeal({ id: 'meal-blank-type', meal_type: '   ' }),
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
  const source = readFileSync(join(__dirname, '..', '..', 'screens', 'CafeDetail.tsx'), 'utf8');

  it('routes the meal type through the mapping when saving', () => {
    expect(source).toMatch(/mealType:\s*selectedDishMealType\(selected, toWebMealType\)/);
  });

  it('imports the mapping from the data seam', () => {
    expect(source).toMatch(/import\s*\{[^}]*toWebMealType[^}]*\}\s*from\s*'\.\.\/data'/);
  });

  it('no longer persists the raw tab label as the meal type', () => {
    expect(source).not.toMatch(/mealType:\s*first\s*\?\s*tab\s*:\s*null/);
  });

  it('leaves the tab labels, order, and count alone', () => {
    expect(source).toMatch(/const MEAL_TABS = \[[^\]]*\] as const;/);
    for (const label of ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Drinks']) {
      expect(source).toContain(`'${label}'`);
    }
  });
});
