import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { exportLocalTrips, type ExportSummary } from '../../data';
import type { LocalTrip } from '../../db';

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

const SAVED_OK = { ok: true, status: 201, json: { success: true, data: { id: 'web-1' } } };

beforeEach(() => {
  jest.clearAllMocks();
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
      localTrip({ id: 'trip-imported', source: 'web-import', source_id: 'web-1' }),
      localTrip({ id: 'trip-empty', payload: null }),
    ]);
    const captured = mockFetch(() => SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(1);
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
    await exportLocalTrips(PROFILE_ID);

    expect(captured).toHaveLength(2);
    const keys = captured.map((c) => c.headers['Idempotency-Key']);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain('trip-local-1');
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
