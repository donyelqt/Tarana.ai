/**
 * `exportLocalTrips` — the observable contract of the export direction.
 *
 * The network boundary is the test seam: `../auth` (token issuance) and the
 * global `fetch` (the POST to `/api/saved-itineraries`) are doubled, while
 * the SQLite layer stays real-ish — the Db namespace is mocked only to hand
 * back a fixed trip list, so nothing under test touches a device database.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. Only `source === 'local'` trips WITH a payload are exported. A
 *    web-import row is already on the web; a hand-made row with no payload
 *    cannot satisfy `SaveItinerarySchema`. Both must be left alone.
 * 2. The SAME idempotency key on every attempt. A retry (after a partial
 *    failure, a crash, a flaky network) must converge to one web row, never
 *    duplicate. This is the whole point of deriving the key from the local
 *    trip id, so it is asserted on the header, twice over.
 * 3. A per-trip failure is collected, not thrown, and never aborts the rest
 *    of the batch — the three failure modes (rejected, unreachable,
 *    unreadable reply) each leave the other trips exported.
 * 4. The count summary is exactly right, including the "nothing to do" path.
 *
 * The DELETE absence is itself asserted: no test here may ever expect a
 * delete, and a `method` other than POST would fail the URL/shape assertions.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { exportLocalTrips, type ExportSummary } from '../../data';
import type { LocalTrip } from '../../db';

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
 * `generateWithLlama`: `expo-constants` + `expo-file-system/legacy` +
 * `llama.rn`, none of which jest can transform. Mocking it here is the same
 * cut the llm suite makes, but virtual, because this test resolves the
 * module through a path the seam (not the test) imports. The path is
 * relative to THIS file, so `../../llm/...` = `src/llm/...`.
 */
jest.mock('../../llm/modelManager', () => ({
  isLlamaAvailable: () => false,
  getModelStatus: async () => ({ state: 'not-downloaded', bytesDownloaded: 0, bytesTotal: 0, path: null }),
  MODEL_PATH: '/models/model.gguf',
}), { virtual: true });

/**
 * `../supabase` imports `expo-secure-store` (a native module whose package
 * entry jest cannot transform) and `tarana-web/data/supabaseClient`, which
 * reads `process.env.NEXT_PUBLIC_*` at load. Neither is on the export path —
 * `exportLocalTrips` talks to the web over `fetch` only — so the module is
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
 * SQLite double: one row-set per test, driven through `listTripsByProfile`.
 * `linkExportedRow` is present because the export path now writes the web id
 * back to the row after a successful POST; everything else the seam might call
 * stays absent so an accidental use fails loudly rather than silently doing
 * nothing.
 */
jest.mock('../../db', () => ({
  listTripsByProfile: jest.fn(),
  linkExportedRow: jest.fn(async () => {}),
}));
const mockListTripsByProfile = () =>
  (jest.requireMock('../../db') as { listTripsByProfile: jest.Mock }).listTripsByProfile as jest.Mock<
    (profileId: string) => Promise<LocalTrip[]>
  >;
const mockLinkExportedRow = () =>
  (jest.requireMock('../../db') as { linkExportedRow: jest.Mock }).linkExportedRow as jest.Mock<
    (table: 'trips' | 'meals', id: string, sourceId: string) => Promise<void>
  >;

const PROFILE_ID = 'profile-1';

/** A fully-formed local trip: the only kind that can be exported. */
function localTrip(overrides: Partial<LocalTrip> = {}): LocalTrip {
  return {
    id: 'trip-local-1',
    profile_id: PROFILE_ID,
    title: 'Burnham Loop',
    date: '2026-11-02',
    budget: '5000',
    tags: ['Nature'],
    payload: JSON.stringify({
      formData: { budget: '5000', pax: '2', duration: '1 day', dates: { start: '2026-11-02', end: '2026-11-02' }, selectedInterests: ['Nature'] },
      itineraryData: { title: 'Burnham Loop', subtitle: 'A day out', items: [] },
    }),
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

/** The canonical "saved" reply the route sends on 201. */
const SAVED_OK = { ok: true, status: 201, json: { success: true, data: { id: 'web-1' } } };

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` drops the implementation declared in the factory, so
  // it is re-armed here with the real contract (spread + Bearer).
  mockWithMobileAuth().mockImplementation(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  }));
  mockListTripsByProfile().mockResolvedValue([]);
});

describe('exportLocalTrips — what gets exported', () => {
  it('exports a local trip that carries a payload', async () => {
    const trip = localTrip();
    mockListTripsByProfile().mockResolvedValue([trip]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary).toEqual({ exported: 1, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('http://localhost:3000/api/saved-itineraries');
    // POST only — export never deletes on the web side.
    expect(captured[0].method).toBe('POST');
    expect(captured[0].body).toMatchObject({
      title: 'Burnham Loop',
      date: '2026-11-02',
      budget: '5000',
      tags: ['Nature'],
      formData: { pax: '2' },
      itineraryData: { title: 'Burnham Loop' },
    });
  });

  it('excludes web-import rows and payload-less local rows', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ id: 'trip-local-1' }),
      // Already on the web: re-pushing it would fight the import-side dedupe.
      localTrip({ id: 'trip-imported', source: 'web-import', source_id: 'web-1' }),
      // No itinerary JSON → cannot satisfy SaveItinerarySchema.
      localTrip({ id: 'trip-empty', payload: null }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(1);
    // Not "skipped": these are not export candidates at all, so they are
    // neither sent nor counted as failures.
    expect(summary.skipped).toBe(0);
    expect(summary.failures).toEqual([]);
    expect(captured).toHaveLength(1);
    expect(captured[0].headers['Idempotency-Key']).toContain('trip-local-1');
  });

  it('reports nothing to do without touching the network', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip({ payload: null, source: 'web-import' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary).toEqual({ exported: 0, skipped: 0, failures: [] });
    // No bearer request is even attempted for an empty batch.
    expect(captured).toHaveLength(0);
    expect(mockWithMobileAuth()).not.toHaveBeenCalled();
  });
});

describe('exportLocalTrips — idempotency', () => {
  it('derives the key from the local trip id and sends it on every attempt', async () => {
    const trip = localTrip();
    mockListTripsByProfile().mockResolvedValue([trip]);
    const captured = mockFetch(() => SAVED_OK);

    await exportLocalTrips(PROFILE_ID);
    // Same local rows, same expected outcome: a retry must be identical.
    await exportLocalTrips(PROFILE_ID);

    expect(captured).toHaveLength(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain('trip-local-1');
    // The constructed key must be stable, not a per-run nonce.
    expect(typeof keys[0]).toBe('string');
    expect(keys[0]!.length).toBeGreaterThan(0);
  });

  it('keeps one distinct key per trip so retries never cross-contaminate', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip(), localTrip({ id: 'trip-local-2' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it('carries the bearer credential on the save request', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip()]);
    const captured = mockFetch(() => SAVED_OK);

    await exportLocalTrips(PROFILE_ID);

    expect(captured[0].headers.Authorization).toBe('Bearer test-token');
    expect(captured[0].headers['Content-Type']).toBe('application/json');
  });
});

describe('exportLocalTrips — failures are collected, never thrown', () => {
  it('records a 400 rejection and still exports the good trips', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ id: 'trip-bad', title: 'Rejected' }),
      localTrip({ id: 'trip-good', title: 'Fine' }),
    ]);
    const captured = mockFetch((_body, n) =>
      n === 1
        ? { ok: false, status: 400, json: { error: 'Invalid input' } }
        : SAVED_OK
    );

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(captured).toHaveLength(2);
    expect(summary.exported).toBe(1);
    expect(summary.failures).toHaveLength(1);
    expect(summary.failures[0]).toContain('Rejected');
    expect(summary.failures[0]).toContain('HTTP 400');
    expect(summary.failures[0]).toContain('Invalid input');
  });

  it('records a transport failure per trip and continues', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ id: 'trip-1', title: 'First' }),
      localTrip({ id: 'trip-2', title: 'Second' }),
    ]);
    const captured: CapturedRequest[] = [];
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(url), method: String(init?.method), headers: (init?.headers ?? {}) as Record<string, string>, body: null });
      if (captured.length === 1) throw new Error('network down');
      return { ok: true, status: 201, json: async () => ({ success: true, data: { id: 'web-2' } }) } as unknown as Response;
    });

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(captured).toHaveLength(2);
    expect(summary.exported).toBe(1);
    expect(summary.failures).toEqual([expect.stringContaining('First')]);
    expect(summary.failures[0]).toContain('could not reach the web app');
  });

  it('treats a reply without a saved id as a failure, not a silent success', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip()]);
    mockFetch(() => ({ ok: true, status: 201, json: { success: true, data: null } }));

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.failures[0]).toContain('did not include the saved trip');
  });

  it('survives an unreadable reply body', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip()]);
    // `json` rejects: a truncated/proxied body must not crash the loop.
    (globalThis as { fetch?: unknown }).fetch = jest.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => {
        throw new Error('bad json');
      },
    }) as unknown as Response);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.failures[0]).toContain('not valid JSON');
  });
});

describe('exportLocalTrips — local validation skips what the web would reject', () => {
  it('skips a trip with an unparseable payload instead of POSTing it', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip({ payload: '{not json' })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(summary.failures[0]).toContain('missing the details the web requires');
    // No round-trip for a trip already known to be invalid.
    expect(captured).toHaveLength(0);
  });

  it('skips a trip missing required fields rather than sending a doomed POST', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ title: null }),
      localTrip({ id: 'trip-2', date: null }),
      localTrip({ id: 'trip-3', budget: null }),
      localTrip({ id: 'trip-ok', title: 'Good' }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(1);
    expect(summary.skipped).toBe(3);
    expect(summary.failures).toHaveLength(3);
    expect(captured).toHaveLength(1);
    // The only request made is for the complete trip.
    expect(captured[0].headers['Idempotency-Key']).toContain('trip-ok');
  });

  it('skips a payload whose formData is not an object', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ payload: JSON.stringify({ formData: 'nope', itineraryData: {} }) }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.skipped).toBe(1);
    expect(captured).toHaveLength(0);
  });

  it('rounds an over-long local id into a skip, never a broken key', async () => {
    const longId = 'x'.repeat(300);
    mockListTripsByProfile().mockResolvedValue([localTrip({ id: longId })]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.skipped).toBe(1);
    expect(summary.failures[0]).toContain('too long');
    expect(captured).toHaveLength(0);
  });
});

describe('exportLocalTrips — summary accounting', () => {
  it('counts exported, skipped, and failed exactly once each', async () => {
    mockListTripsByProfile().mockResolvedValue([
      localTrip({ id: 'ok-1' }),
      localTrip({ id: 'ok-2' }),
      localTrip({ id: 'skip-1', payload: 'not json' }),
      localTrip({ id: 'fail-1' }),
    ]);
    mockFetch((_body, n) => (n <= 2 ? SAVED_OK : { ok: false, status: 500, json: { error: 'boom' } }));

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(2);
    expect(summary.skipped).toBe(1);
    expect(summary.failures).toHaveLength(2);
  });

  it('propagates a missing token as a whole-export failure', async () => {
    mockListTripsByProfile().mockResolvedValue([localTrip()]);
    mockWithMobileAuth().mockRejectedValue(new Error('No mobile token stored.'));

    await expect(exportLocalTrips(PROFILE_ID)).rejects.toThrow('No mobile token stored.');
  });
});
