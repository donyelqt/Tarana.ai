import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportLocalMeals, exportLocalTrips } from '../../data';

import {
  createMeal,
  createTrip,
  deleteTrip,
  getDb,
  linkExportedRow,
  upsertImportedMeal,
  upsertImportedTrip,
} from '../../db';
import type { LocalMeal, LocalTrip } from '../../db';

jest.mock('../../tokenStorage', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

interface Run {
  sql: string;
  params: unknown[];
}

interface DbSlot {
  db: DatabaseSync;
  runs: Run[];
}

const slot: DbSlot = { db: null as unknown as DatabaseSync, runs: [] };

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: typeof import('node:sqlite').DatabaseSync;
  };
  const db = new DatabaseSync(':memory:');
  const { readFileSync } = require('node:fs') as {
    readFileSync: typeof import('node:fs').readFileSync;
  };
  const { join } = require('node:path') as {
    join: typeof import('node:path').join;
  };
  const schema = readFileSync(join(__dirname, '..', '..', 'db', 'index.ts'), 'utf8');
  const match = schema.match(/const SCHEMA = `([\s\S]*?)`;/);
  if (!match) throw new Error('Could not read the db SCHEMA string.');
  db.exec(match[1]);
  return {
    openDatabaseAsync: async () => {
      slot.db = db;
      return {
        async execAsync(sql: string) {
          db.exec(sql);
        },
        async runAsync(sql: string, ...params: unknown[]) {
          slot.runs.push({ sql, params });
          db.prepare(sql).run(...(params as never[]));
          return { lastInsertRowId: 0, changes: 0, rows: [] };
        },
        async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
          slot.runs.push({ sql, params });
          return (db.prepare(sql).get(...(params as never[])) as T | null) ?? null;
        },
        async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
          slot.runs.push({ sql, params });
          return db.prepare(sql).all(...(params as never[])) as T[];
        },
      };
    },
  };
});

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

const PROFILE_ID = 'profile-1';

type AuthMock = jest.Mock<(headers?: Record<string, string>) => Promise<Record<string, string>>>;

const mockWithMobileAuth = (): AuthMock =>
  (jest.requireMock('../../auth') as { withMobileAuth: AuthMock }).withMobileAuth;

interface Stored {
  id: string;
  source: string;
  source_id: string | null;
}

function tripRows(): Stored[] {
  return slot.db.prepare('SELECT id, source, source_id FROM trips ORDER BY id').all() as unknown as Stored[];
}

function mealRows(): Stored[] {
  return slot.db.prepare('SELECT id, source, source_id FROM meals ORDER BY id').all() as unknown as Stored[];
}

function issued(): Run[] {
  return slot.runs;
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
    return { ok: reply.ok, status: reply.status, json: async () => reply.json } as unknown as Response;
  });
  return captured;
}

const TRIP_SAVED_OK = { ok: true, status: 201, json: { success: true, data: { id: 'web-trip-1' } } };
const MEAL_SAVED_OK = { ok: true, status: 200, json: { success: true, data: { id: 'web-meal-1' } } };

beforeEach(async () => {
  await getDb();
  slot.db
    .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?)')
    .run(PROFILE_ID, 'Tester');
  slot.db.exec('DELETE FROM trips; DELETE FROM meals;');
  slot.runs = [];
  jest.clearAllMocks();
  mockWithMobileAuth().mockImplementation(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  }));
});

async function seedLocalTrip(createdAt?: string): Promise<LocalTrip> {
  const trip = await createTrip({
    profileId: PROFILE_ID,
    title: 'Burnham Loop',
    date: '2026-11-02',
    budget: '5000',
    tags: ['Nature'],
    payload: JSON.stringify({
      formData: { budget: '5000', pax: '2', duration: '1 day', dates: { start: '2026-11-02', end: '2026-11-02' }, selectedInterests: ['Nature'] },
      itineraryData: { title: 'Burnham Loop', subtitle: 'A day out', items: [] },
    }),
  });
  if (createdAt) {
    slot.db.prepare('UPDATE trips SET created_at = ? WHERE id = ?').run(createdAt, trip.id);
  }
  return trip;
}

async function seedLocalMeal(): Promise<LocalMeal> {
  return createMeal({
    profileId: PROFILE_ID,
    cafeName: 'Good Shepherd Cafe',
    mealType: 'Breakfast',
    price: 250,
    goodFor: ['Coffee', 'Local Beans'],
    location: 'Baguio City',
    items: JSON.stringify([{ name: 'Sourdough Toast', price: 250, quantity: 1 }]),
  });
}

describe('export → row state', () => {
  it('marks the exported trip with its web id', async () => {
    const trip = await seedLocalTrip();
    const captured = mockFetch(() => TRIP_SAVED_OK);

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary).toEqual({ exported: 1, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    expect(tripRows()).toEqual([
      { id: trip.id, source: 'web-import', source_id: 'web-trip-1' },
    ]);
    expect(tripRows()[0].id).toBe(trip.id);
  });

  it('marks the exported meal with its web id', async () => {
    const meal = await seedLocalMeal();
    const captured = mockFetch(() => MEAL_SAVED_OK);

    const summary = await exportLocalMeals(PROFILE_ID);

    expect(summary).toEqual({ exported: 1, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    expect(mealRows()).toEqual([
      { id: meal.id, source: 'web-import', source_id: 'web-meal-1' },
    ]);
  });

  it('writes the link only once the POST returned a real id', async () => {
    const trip = await seedLocalTrip();
    mockFetch(() => ({ ok: true, status: 201, json: { success: true, data: null } }));

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(summary.failures[0]).toContain('did not include the saved trip');
    expect(tripRows()).toEqual([
      { id: trip.id, source: 'local', source_id: null },
    ]);
  });

  it('does not mark a row whose POST was rejected', async () => {
    const trip = await seedLocalTrip();
    mockFetch(() => ({ ok: false, status: 400, json: { error: 'Invalid input' } }));

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(0);
    expect(tripRows()).toEqual([
      { id: trip.id, source: 'local', source_id: null },
    ]);
  });
});

describe('round trip convergence', () => {
  it('a re-imported trip converges on ONE row, updated in place', async () => {
    const trip = await seedLocalTrip();
    mockFetch(() => TRIP_SAVED_OK);
    await exportLocalTrips(PROFILE_ID);

    await upsertImportedTrip({
      profileId: PROFILE_ID,
      sourceId: 'web-trip-1',
      title: 'Burnham Loop',
    });

    const rows = tripRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: trip.id, source: 'web-import', source_id: 'web-trip-1' });
  });

  it('a re-imported meal converges on ONE row, updated in place', async () => {
    const meal = await seedLocalMeal();
    mockFetch(() => MEAL_SAVED_OK);
    await exportLocalMeals(PROFILE_ID);

    await upsertImportedMeal({
      profileId: PROFILE_ID,
      sourceId: 'web-meal-1',
      cafeName: 'Good Shepherd Cafe',
    });

    const rows = mealRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: meal.id, source: 'web-import', source_id: 'web-meal-1' });
  });

  it('an import of a DIFFERENT web trip still inserts its own row', async () => {
    const trip = await seedLocalTrip();
    mockFetch(() => TRIP_SAVED_OK);
    await exportLocalTrips(PROFILE_ID);

    await upsertImportedTrip({
      profileId: PROFILE_ID,
      sourceId: 'web-trip-other',
      title: 'Session Road',
    });

    expect(tripRows()).toHaveLength(2);
  });

  it('an UNLINKED local row still duplicates on import — the failure the link prevents', async () => {
    await seedLocalTrip();

    await upsertImportedTrip({
      profileId: PROFILE_ID,
      sourceId: 'web-trip-1',
      title: 'Burnham Loop',
    });

    expect(tripRows()).toHaveLength(2);
  });
});

describe('the marked row leaves the candidate set', () => {
  it('reports the next export as 0/0 with no second POST, for trips', async () => {
    await seedLocalTrip();
    const captured = mockFetch(() => TRIP_SAVED_OK);

    const first = await exportLocalTrips(PROFILE_ID);
    const second = await exportLocalTrips(PROFILE_ID);

    expect(first.exported).toBe(1);
    expect(second).toEqual({ exported: 0, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    expect(mockWithMobileAuth()).toHaveBeenCalledTimes(1);
  });

  it('reports the next export as 0/0 with no second POST, for meals', async () => {
    await seedLocalMeal();
    const captured = mockFetch(() => MEAL_SAVED_OK);

    const first = await exportLocalMeals(PROFILE_ID);
    const second = await exportLocalMeals(PROFILE_ID);

    expect(first.exported).toBe(1);
    expect(second).toEqual({ exported: 0, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
  });

  it('keeps other local rows exporting after one is marked', async () => {
    const first = await seedLocalTrip('2026-11-02T10:00:00.000Z');
    const second = await seedLocalTrip('2026-11-02T09:00:00.000Z');
    mockFetch((_body, n) =>
      n === 1 ? TRIP_SAVED_OK : { ok: true, status: 201, json: { success: true, data: { id: 'web-trip-2' } } }
    );

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(2);
    const rows = tripRows();
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ id: first.id, source: 'web-import', source_id: 'web-trip-1' });
    expect(rows).toContainEqual({ id: second.id, source: 'web-import', source_id: 'web-trip-2' });
  });
});

describe('export idempotency survives the marking', () => {
  it('a lost reply leaves the row exportable and the key stable', async () => {
    const trip = await seedLocalTrip();

    mockFetch(() => ({ ok: true, status: 201, json: { success: true, data: null } }));
    const lost = await exportLocalTrips(PROFILE_ID);
    expect(lost.exported).toBe(0);

    expect(tripRows()).toEqual([
      { id: trip.id, source: 'local', source_id: null },
    ]);

    const retried = mockFetch(() => TRIP_SAVED_OK);
    const recovered = await exportLocalTrips(PROFILE_ID);

    expect(recovered.exported).toBe(1);
    expect(retried[0].headers['Idempotency-Key']).toContain(trip.id);
  });

  it('the idempotency key is derived from the local id, not the web id', async () => {
    const trip = await seedLocalTrip();
    const captured = mockFetch(() => TRIP_SAVED_OK);

    await exportLocalTrips(PROFILE_ID);

    expect(captured[0].headers['Idempotency-Key']).toContain(trip.id);
    expect(captured[0].headers['Idempotency-Key']).not.toContain('web-trip-1');
  });
});

describe('local delete is unaffected by the marking', () => {
  it('removes the trip locally and leaves the web row alone', async () => {
    const trip = await seedLocalTrip();
    mockFetch(() => TRIP_SAVED_OK);
    await exportLocalTrips(PROFILE_ID);

    await deleteTrip(trip.id, PROFILE_ID);

    expect(tripRows()).toEqual([]);
    const callsAfter = issued().filter((r) => r.sql.startsWith('DELETE'));
    expect(callsAfter.some((r) => r.sql.includes('trips'))).toBe(true);
  });

  it('still converges if the marked row is re-imported after another export', async () => {
    const first = await seedLocalTrip();
    mockFetch(() => TRIP_SAVED_OK);
    await exportLocalTrips(PROFILE_ID);

    await upsertImportedTrip({ profileId: PROFILE_ID, sourceId: 'web-trip-1', title: 'Burnham Loop' });
    await upsertImportedTrip({ profileId: PROFILE_ID, sourceId: 'web-trip-1', title: 'Burnham Loop' });

    expect(tripRows()).toEqual([
      { id: first.id, source: 'web-import', source_id: 'web-trip-1' },
    ]);
  });
});

describe('linkExportedRow is what the caller writes back', () => {
  it('the seam calls it on the export path', async () => {
    const source = readFileSync(join(__dirname, '..', '..', 'data', 'index.ts'), 'utf8');
    expect(source).toContain("await Db.linkExportedRow('trips'");
    expect(source).toContain("await Db.linkExportedRow('meals'");
  });
});
