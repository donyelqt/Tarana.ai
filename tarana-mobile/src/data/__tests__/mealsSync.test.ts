import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { exportLocalMeals, type ExportSummary } from '../../data';
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

describe('exportLocalMeals — what gets exported', () => {
  it('exports a local meal with its dish snapshot', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 1, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('http://localhost:3000/api/saved-meals');
    expect(captured[0].method).toBe('POST');
    expect(captured[0].body).toMatchObject({
      cafe_name: 'Good Shepherd Cafe',
      meal_type: 'Breakfast',
      price: 250,
      location: 'Baguio City',
      menu_items: [{ name: 'Sourdough Toast', price: 250, quantity: 1 }],
    });
  });

  it('excludes web-import rows', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-local-1' }),
      localMeal({ id: 'meal-imported', source: 'web-import', source_id: 'web-1' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(summary.skipped).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['Idempotency-Key']).toContain('meal-local-1');
  });

  it('marks the exported row web-import, so it is not re-POSTed', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    const first = await exportLocalMeals(PROFILE_ID);

    expect(first.exported).toBe(1);
    expect(mockLinkExportedRow()).toHaveBeenCalledWith('meals', 'meal-local-1', 'web-meal-1');
    expect(captured).toHaveLength(1);
  });

  it('reports nothing to do without touching the network', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ source: 'web-import' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 0, skipped: 0, failures: [] });
    expect(captured).toHaveLength(0);
    expect(mockWithMobileAuth()).not.toHaveBeenCalled();
  });
});

describe('exportLocalMeals — idempotency', () => {
  it('derives the key from the local meal id and sends it on every attempt', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    await exportLocalMeals(PROFILE_ID);
    await exportLocalMeals(PROFILE_ID);

    expect(captured).toHaveLength(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain('meal-local-1');
    expect(typeof keys[0]).toBe('string');
    expect(keys[0]!.length).toBeGreaterThan(0);
  });

  it('keeps one distinct key per meal so retries never cross-contaminate', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal(), localMeal({ id: 'meal-local-2' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('carries the bearer credential on the save request', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    await exportLocalMeals(PROFILE_ID);

    expect(captured[0].headers.Authorization).toBe('Bearer test-token');
    expect(captured[0].headers['Content-Type']).toBe('application/json');
  });

  it('rounds an over-long local id into a skip, never a broken key', async () => {
    const longId = 'x'.repeat(300);
    mockListMealsByProfile().mockResolvedValue([localMeal({ id: longId })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.skipped).toBe(1);
    expect(summary.failures[0]).toContain('too long');
    expect(captured).toHaveLength(0);
  });
});

describe('exportLocalMeals — good_for flattens array to web string', () => {
  it('sends the first non-empty entry as the web string', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ good_for: ['Coffee', 'Local Beans'] })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: 'Coffee' });
  });

  it('sends null when good_for is empty, which the schema allows', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ good_for: [] })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: null });
  });

  it('skips a blank first entry instead of sending an empty string', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ good_for: ['', '  ', 'Cozy'] })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ good_for: 'Cozy' });
  });

  it('skips a first entry longer than the 20-character cap', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ good_for: ['An extremely verbose popular-for label that would 400'] }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(captured).toHaveLength(0);
  });
});

describe('exportLocalMeals — failures are collected, never thrown', () => {
  it('records a 400 rejection and still exports the good meals', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-bad', cafe_name: 'Rejected' }),
      localMeal({ id: 'meal-good', cafe_name: 'Fine' }),
    ]);
    const captured = mockFetch((_body, n) =>
      n === 1
        ? { ok: false, status: 400, json: { error: 'Invalid input' } }
        : SAVED_OK
    );

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(captured).toHaveLength(2);
    expect(summary.exported).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toContain('Rejected');
    expect(summary.failures[0]).toContain('HTTP 400');
    expect(summary.failures[0]).toContain('Invalid input');
  });

  it('records a transport failure per meal and continues', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-1', cafe_name: 'First' }),
      localMeal({ id: 'meal-2', cafe_name: 'Second' }),
    ]);
    const captured: CapturedRequest[] = [];
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(url), method: String(init?.method), headers: (init?.headers ?? {}) as Record<string, string>, body: null });
      if (captured.length === 1) throw new Error('network down');
      return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 'web-meal-2' } }) } as unknown as Response;
    });

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(captured).toHaveLength(2);
    expect(summary.exported).toBe(1);
    expect(summary.failures).toEqual([expect.stringContaining('First')]);
    expect(summary.failures[0]).toContain('could not reach the web app');
  });

  it('treats a reply without a saved id as a failure, not a silent success', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    mockFetch(() => ({ ok: true, status: 200, json: { success: true, data: null } }));

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.failures[0]).toContain('did not include the saved meal');
  });

  it('survives an unreadable reply body', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as Response);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.failures[0]).toContain('not valid JSON');
  });

  it('propagates a missing token as a whole-export failure', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    mockWithMobileAuth().mockRejectedValue(new Error('No mobile token stored.'));

    await expect(exportLocalMeals(PROFILE_ID)).rejects.toThrow('No mobile token stored.');
  });
});

describe('exportLocalMeals — local validation skips what the web would reject', () => {
  it('skips a meal with a null price instead of POSTing a 400', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ price: null })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.failures[0]).toContain('missing the details the web requires');
    expect(captured).toHaveLength(0);
  });

  it('skips a meal with a zero or negative price', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-zero', price: 0 }),
      localMeal({ id: 'meal-negative', price: -5 }),
      localMeal({ id: 'meal-ok', price: 120 }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(summary.skipped).toBe(2);
    expect(summary.failures).toHaveLength(2);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['Idempotency-Key']).toContain('meal-ok');
  });

  it('skips a meal with a null or blank meal_type', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-null-type', meal_type: null }),
      localMeal({ id: 'meal-blank-type', meal_type: '   ' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.skipped).toBe(2);
    expect(summary.failures).toHaveLength(2);
    expect(captured).toHaveLength(0);
  });

  it('skips a meal with a blank cafe name', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ cafe_name: '   ' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.skipped).toBe(1);
    expect(captured).toHaveLength(0);
  });

  it('skips a meal whose items JSON is unparseable rather than sending noise', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ items: '{not json' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.skipped).toBe(1);
    expect(summary.failures[0]).toContain('missing the details the web requires');
    expect(captured).toHaveLength(0);
  });

  it('exports a meal with null items as an empty menu_items array', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ items: null })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(captured[0].body).toMatchObject({ menu_items: [] });
  });
});

describe('exportLocalMeals — summary accounting', () => {
  it('counts exported, skipped, and failed exactly once each', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'ok-1' }),
      localMeal({ id: 'ok-2' }),
      localMeal({ id: 'skip-1', price: null }),
      localMeal({ id: 'fail-1', cafe_name: 'Failing' }),
    ]);
    mockFetch((_body, n) => (n <= 2 ? SAVED_OK : { ok: false, status: 500, json: { error: 'boom' } }));

    const summary: ExportSummary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.failures).toHaveLength(2);
  });
});
