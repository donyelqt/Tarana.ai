/**
 * `exportLocalMeals` — the observable contract of the meals export
 * direction.
 *
 * The network boundary is the test seam: `../auth` (token issuance) and the
 * global `fetch` (the POST to `/api/saved-meals`) are doubled, while the
 * SQLite layer stays real-ish — the Db namespace is mocked only to hand
 * back a fixed meal list, so nothing under test touches a device database.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. Only `source === 'local'` meals with a usable body are exported. A
 *    web-import row is already on the web and must be left alone.
 * 2. The SAME idempotency key on every attempt, derived from the LOCAL MEAL
 *    ID. A retry must converge to one web row, never duplicate, so the key
 *    is asserted stable across two runs and distinct per meal.
 * 3. The shape conversion that only this seam needs: local `good_for` is a
 *    string array, web `good_for` is ONE nullable string. It flattens to
 *    the first entry and to null when absent.
 * 4. A per-meal failure is collected, not thrown, and never aborts the rest
 *    of the batch — the three failure modes (rejected, unreachable,
 *    unreadable reply) each leave the other meals exported.
 * 5. A row the web schema would reject is skipped with a reason BEFORE the
 *    round-trip, never POSTed into a 400.
 *
 * The DELETE absence is itself asserted: no test here may ever expect a
 * delete, and a `method` other than POST would fail the URL/shape
 * assertions.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { exportLocalMeals, type ExportSummary } from '../../data';
import type { LocalMeal } from '../../db';

/**
 * `../config` is mocked so the seam's `config.webBaseUrl` resolves without
 * pulling `expo-constants`: that package ships an ESM entry jest's
 * `transformIgnorePatterns` cannot transform, and it would fail the whole
 * suite at import time for a value this test never varies. The seam reads it
 * through this object, so the mock is the same surface.
 */
jest.mock('../../config', () => ({
  config: { webBaseUrl: 'http://localhost:3000' },
  requireConfig: (key: string) => {
    throw new Error(`Missing config: ${key}`);
  },
}));

/**
 * `../llm/modelManager` is the native boundary the seam reaches through
 * `generateWithLlama`. The path is relative to THIS file, so
 * `../../llm/...` = `src/llm/...`.
 */
jest.mock('../../llm/modelManager', () => ({
  isLlamaAvailable: () => false,
  getModelStatus: async () => ({ state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: null }),
  MODEL_PATH: '/models/model.gguf',
}), { virtual: true });

/**
 * Diagnostic (temporary): print the identity this spec's relative mock
 * resolves to, so it can be compared with the failing prompt.test.ts side.
 */
describe('PROBE-B mock identity', () => {
  it('prints the modelManager mock identity', async () => {
    const mod: unknown = jest.requireMock('../../llm/modelManager');
    const statusFn = mod as unknown;
    let identity = 'UNKNOWN SHAPE';
    if (typeof statusFn === 'object' && statusFn !== null && 'getModelStatus' in statusFn) {
      const fn = (statusFn as { getModelStatus: unknown }).getModelStatus;
      const inner = fn as unknown;
      identity =
        typeof inner === 'function' && '_isMockFunction' in inner
          ? 'MOCK (getModelStatus is a jest mock fn)'
          : typeof fn === 'function'
            ? 'REAL/SOURCE-SHAPED (a plain function, not a jest mock wrapper)'
            : 'NOT A FUNCTION';
    }
    let resolved = 'UNRESOLVED';
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      resolved = jest.requireMock('../../llm/modelManager') ? 'requireMock ok' : 'empty';
    } catch (e: unknown) {
      resolved = `UNRESOLVED: ${String(e)}`;
    }
    // The fingerprint: this spec's factory returns `path: null`, while the real
    // module also exports downloadModel/cancelDownload/deleteModel. If the mock
    // is the executed module, getModelPath is undefined here.
    const hasGetModelPath = 'getModelPath' in (statusFn as object);
    console.log(
      '[PROBE-B] mealsSync mock identity =', identity, '|', resolved,
      '| hasGetModelPath(REAL has it) =', hasGetModelPath,
      '| getModelStatus source =', String(((statusFn as { getModelStatus?: unknown }).getModelStatus ?? '')).slice(0, 120)
    );
  });
});

/**
 * `../supabase` imports `expo-secure-store` (a native module whose package
 * entry jest cannot transform) and `tarana-web/data/supabaseClient`, which
 * reads `process.env.NEXT_PUBLIC_*` at load. Neither is on the export path —
 * `exportLocalMeals` talks to the web over `fetch` only — so the module is
 * stubbed; any dependency on it would surface as a failing call, not a
 * silently working import.
 */
jest.mock('../../supabase', () => ({
  createMobileSupabaseClient: () => {
    throw new Error('The export path must not use the Supabase client.');
  },
  getSupabaseUrl: () => 'http://localhost:54321',
}));

/**
 * `tarana-web/*` is stubbed: the seam imports city config for the peak-hours
 * traffic helpers (utterly unrelated to export), and the shared module
 * resolves through a tsconfig `paths`/Metro `extraNodeModules` remap that
 * this jest config does not mirror. Only the two helpers are reachable from
 * the import, so the stub can be minimal — but it is a stub, NOT a mock of
 * behaviour: nothing here needs city math.
 */
jest.mock('tarana-web/data/cityConfig', () => ({
  getCityCenter: () => ({ lat: 16.4, lon: 120.6 }),
  getCityTimezone: () => 'Asia/Manila',
  CITY_CONFIGS: {},
}), { virtual: true });

/**
 * Token bridge double. `withMobileAuth` is the only auth surface the export
 * touches (it never re-exchanges), so a resolved header object is enough.
 *
 * The double mirrors the real contract: it spreads the caller's headers and
 * attaches the Bearer credential (auth.ts:125-133). Asserting the merged
 * shape proves the seam passes `Content-Type` — a double that returned only
 * the token would pass a broken implementation.
 *
 * `jest.fn` is created INSIDE the factory and retrieved with
 * `jest.requireMock`: a factory may not close over a test-scope binding
 * (jest's out-of-scope guard), and under babel's ESM interop a hoisted
 * reference to one resolves to `undefined` on the other side. The mock is
 * then reached by the same module id the seam imports.
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
 * Everything else the seam might call stays absent so an accidental use
 * fails loudly rather than silently doing nothing.
 */
jest.mock('../../db', () => ({
  listMealsByProfile: jest.fn(),
}));
const mockListMealsByProfile = () =>
  (jest.requireMock('../../db') as { listMealsByProfile: jest.Mock }).listMealsByProfile as jest.Mock<
    (profileId: string) => Promise<LocalMeal[]>
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
    // The dish snapshot createMeal writes: name + price + quantity.
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
    // Headers arrive as a plain object here (the seam builds them itself), so
    // a Record read is exact — no shape is assumed of the wider Request init.
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
  // `clearAllMocks` drops the implementation declared in the factory, so
  // it is re-armed here with the real contract (spread + Bearer).
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
    // POST only — export never deletes on the web side.
    expect(captured[0].method).toBe('POST');
    expect(captured[0].body).toMatchObject({
      cafe_name: 'Good Shepherd Cafe',
      meal_type: 'Breakfast',
      price: 250,
      location: 'Baguio City',
      // The local `items` JSON string is forwarded as parsed `menu_items`.
      menu_items: [{ name: 'Sourdough Toast', price: 250, quantity: 1 }],
    });
  });

  it('excludes web-import rows', async () => {
    mockListMealsByProfile().mockResolvedValue([
      localMeal({ id: 'meal-local-1' }),
      // Already on the web: re-pushing it would fight the import-side dedupe.
      localMeal({ id: 'meal-imported', source: 'web-import', source_id: 'web-1' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary.exported).toBe(1);
    // Not "skipped": an imported row is not an export candidate at all, so
    // it is neither sent nor counted as a failure.
    expect(summary.skipped).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['Idempotency-Key']).toContain('meal-local-1');
  });

  it('never rewrites the exported row as web-import, so it re-exports', async () => {
    // The Db mock exposes ONLY the read, so any local write attempt throws
    // loudly instead of silently flipping `source` to 'web-import' and
    // hiding the meal from a later export.
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    const first = await exportLocalMeals(PROFILE_ID);
    const second = await exportLocalMeals(PROFILE_ID);

    expect(first.exported).toBe(1);
    // The idempotency key makes the second run converge to the same web row
    // rather than needing a local write to keep it a candidate.
    expect(second.exported).toBe(1);
    expect(captured).toHaveLength(2);
    expect(captured[0].headers['Idempotency-Key']).toBe(captured[1].headers['Idempotency-Key']);
  });

  it('reports nothing to do without touching the network', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal({ source: 'web-import' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 0, skipped: 0, failures: [] });
    // No bearer request is even attempted for an empty batch.
    expect(captured).toHaveLength(0);
    expect(mockWithMobileAuth()).not.toHaveBeenCalled();
  });
});

describe('exportLocalMeals — idempotency', () => {
  it('derives the key from the local meal id and sends it on every attempt', async () => {
    mockListMealsByProfile().mockResolvedValue([localMeal()]);
    const captured = mockFetch(() => SAVED_OK);

    await exportLocalMeals(PROFILE_ID);
    // Same local rows, same expected outcome: a retry must be identical.
    await exportLocalMeals(PROFILE_ID);

    expect(captured).toHaveLength(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain('meal-local-1');
    // The constructed key must be stable, not a per-run nonce.
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
    // `json` rejects: a truncated/proxied body must not crash the loop.
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
    // No round-trip for a meal already known to be invalid.
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
    // The only request made is for the priced meal.
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
