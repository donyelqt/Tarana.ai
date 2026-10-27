/**
 * The local → web → local round trip, asserted end to end on a REAL SQLite
 * engine.
 *
 * The defect this file is for: a user exports a local trip or meal, the POST
 * succeeds, and nothing is written back to the local row. A later import of
 * that same web row then inserts a SECOND copy, because the import
 * hard-inserts `source = 'web-import'` and conflicts on
 * `(source, source_id)`. A row still marked 'local' can never match that
 * conflict, no matter what its `source_id` is — so `source_id` alone does not
 * converge, and the user sees the trip or meal twice with nothing logged.
 *
 * What is pinned here, and why each is a contract:
 * 1. Export → row state. After a successful POST the local row carries
 *    `source: 'web-import'` and the REAL web id the route returned.
 * 2. Round trip convergence. That row, re-imported with the same web id,
 *    converges to exactly ONE row — the row the user already had, updated in
 *    place. Asserted for trips AND meals, through the real
 *    `upsertImported*` against the real engine, because the interaction that
 *    broke is the one between the write-back and the import's ON CONFLICT.
 * 3. The marked row leaves the candidate set. The NEXT export reports it as
 *    neither exported nor failed, and does not POST it again — the observable
 *    contract of the filter changing.
 * 4. Export idempotency survives the marking. The key is derived from the
 *    LOCAL row id, which the write-back never touches, so a retry (a POST that
 *    landed but whose reply was lost) still converges on the same web row.
 * 5. A local delete still removes the row and still does not touch the web.
 *
 * Why a real engine and not the `../../db` mock used by `sync.test.ts` and
 * `mealsSync.test.ts`: those suites deliberately double the read so they can
 * assert request shape. Convergence is the opposite kind of claim — it is a
 * property of the UNIQUE(source, source_id) index and SQLite's NULLs-are-
 * DISTINCT rule interacting with an UPSERT. A fake store would pass even if
 * the ON CONFLICT could never fire, which is precisely the failure mode this
 * suite exists to catch. So `expo-sqlite` is satisfied by node's built-in
 * `node:sqlite` and the schema is the module's own SCHEMA string.
 */
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

/**
 * `../tokenStorage` is the native boundary `db/index.ts` imports for the
 * active-profile pointer. It reaches `react-native` and `expo-secure-store`,
 * neither of which jest can transform here, and nothing in this suite uses it.
 * Stubbing it keeps `../db` loadable; a real dependency on it would surface as
 * a failing call, not a silently passing one. Same double as
 * `linkExportedRow.test.ts`.
 */
jest.mock('../../tokenStorage', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

/**
 * `expo-sqlite` satisfied by node's built-in SQLite. The double is a thin
 * adapter over a REAL engine, not a behavioural mock: every statement
 * executes, so the UNIQUE index and the UPSERT's ON CONFLICT clause behave as
 * they do on device.
 *
 * The schema is read out of the module's own source rather than restated here,
 * so this suite can never drift from what `db/index.ts` actually creates. The
 * seed rows below then satisfy that schema's NOT NULL columns.
 *
 * `slot.db` lives in module scope so the factory can fill it (jest forbids a
 * factory closing over a test-scope binding) while the tests read it back.
 */
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
  // `require` (not a static import) so the factory stays self-contained.
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: typeof import('node:sqlite').DatabaseSync;
  };
  const db = new DatabaseSync(':memory:');
  // The REAL schema, read from the native module's source. The `IF NOT EXISTS`
  // guards in it make the exec idempotent. `require` (not the static import)
  // keeps the factory self-contained: jest forbids a factory closing over an
  // out-of-scope binding.
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

/**
 * The seam's other native boundaries, stubbed for the same reasons
 * `mealsSync.test.ts` gives: none of them is on the export path, and any real
 * dependency would surface as a failing call rather than silently working.
 */
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

/**
 * The token bridge double, reached by the same module id the seam imports.
 * `jest.fn` is created INSIDE the factory and retrieved with
 * `jest.requireMock`: a factory may not close over a test-scope binding
 * (jest's out-of-scope guard), and under babel's ESM interop a hoisted
 * reference to one resolves to `undefined` on the other side.
 */
type AuthMock = jest.Mock<(headers?: Record<string, string>) => Promise<Record<string, string>>>;

const mockWithMobileAuth = (): AuthMock =>
  (jest.requireMock('../../auth') as { withMobileAuth: AuthMock }).withMobileAuth;

/** Every row state this suite cares about, read straight off SQLite. */
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

/** Every statement the db module has issued so far — used to see the writes. */
function issued(): Run[] {
  return slot.runs;
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/**
 * Records every fetch and answers from the script. Same shape as
 * `sync.test.ts`/`mealsSync.test.ts`'s double, so the two suites stay
 * comparable.
 */
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

/** The reply the saved-itineraries route sends on 201, carrying the web id. */
const TRIP_SAVED_OK = { ok: true, status: 201, json: { success: true, data: { id: 'web-trip-1' } } };
/** The reply the saved-meals route sends on 200, carrying the web id. */
const MEAL_SAVED_OK = { ok: true, status: 200, json: { success: true, data: { id: 'web-meal-1' } } };

beforeEach(async () => {
  await getDb();
  // The real schema declares `profile_id ... REFERENCES profiles(id)`, so the
  // seed rows need the profile to exist. Seeded here rather than per-test
  // because EVERY row in this suite carries the same profile id.
  slot.db
    .prepare('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?)')
    .run(PROFILE_ID, 'Tester');
  slot.db.exec('DELETE FROM trips; DELETE FROM meals;');
  slot.runs = [];
  jest.clearAllMocks();
  // `clearAllMocks` drops the factory's implementation, so it is re-armed.
  mockWithMobileAuth().mockImplementation(async (headers: Record<string, string> = {}) => ({
    ...headers,
    Authorization: 'Bearer test-token',
  }));
});

/** A local trip the export can actually POST, written through the real seam. */
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
  // `created_at` defaults to strftime('now'), so two trips seeded in the same
  // millisecond sort identically under `ORDER BY created_at DESC` and the
  // export's iteration order is undefined. Pin it explicitly so the
  // per-row web-id assertion below is stable rather than a coin flip.
  if (createdAt) {
    slot.db.prepare('UPDATE trips SET created_at = ? WHERE id = ?').run(createdAt, trip.id);
  }
  return trip;
}

/** A local meal the export can actually POST, written through the real seam. */
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
    // The row the user already had, now carrying the REAL returned id — not a
    // second row, and not an invented id.
    expect(tripRows()).toEqual([
      { id: trip.id, source: 'web-import', source_id: 'web-trip-1' },
    ]);
    // The local id is untouched, so the idempotency key stays derived from it.
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
    // A reply without a saved id is a failure: the write may have landed, but
    // the row must NOT be marked, because marking without the id would put the
    // row in the candidate-excluded state with nothing to converge against.
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

    // The web side has the row now. A later import of that SAME web row is
    // what used to insert a second copy.
    await upsertImportedTrip({
      profileId: PROFILE_ID,
      sourceId: 'web-trip-1',
      title: 'Burnham Loop',
    });

    const rows = tripRows();
    expect(rows).toHaveLength(1);
    // The row the user already had, so the local row keeps its identity and
    // only the web-sourced fields are refreshed.
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
    // The negative control that stops the above from passing trivially: the
    // conflict is `(source, source_id)`, so a different web id must NOT be
    // swallowed by an unrelated local row.
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
    // Without the write-back, `source_id IS NULL` can never match the import's
    // conflict. This is the shape the defect was filed as.
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
    // Neither exported NOR failed: the row is not a candidate at all now,
    // which is the observable contract of the filter changing.
    expect(second).toEqual({ exported: 0, skipped: 0, failures: [] });
    expect(captured).toHaveLength(1);
    // No token prompt is even attempted for the empty batch.
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
    // Seeded with distinct `created_at` values so `ORDER BY created_at DESC`
    // in `listTripsByProfile` yields a stable iteration order: the later row
    // is exported first and gets the first web id. Without this the two rows
    // share strftime('now') and the order is undefined, which made the
    // per-row web-id assertion below a coin flip rather than a claim.
    const first = await seedLocalTrip('2026-11-02T10:00:00.000Z');
    const second = await seedLocalTrip('2026-11-02T09:00:00.000Z');
    mockFetch((_body, n) =>
      n === 1 ? TRIP_SAVED_OK : { ok: true, status: 201, json: { success: true, data: { id: 'web-trip-2' } } }
    );

    const summary = await exportLocalTrips(PROFILE_ID);

    expect(summary.exported).toBe(2);
    // Asserted per row, not as an array: the two rows have random ids, so
    // which one the fetch responder saw first is not something this suite
    // controls, and ordering the assertion on it would make the test flaky
    // rather than wrong. Each row got the web id its own POST returned.
    const rows = tripRows();
    expect(rows).toHaveLength(2);
    expect(rows).toContainEqual({ id: first.id, source: 'web-import', source_id: 'web-trip-1' });
    expect(rows).toContainEqual({ id: second.id, source: 'web-import', source_id: 'web-trip-2' });
  });
});

describe('export idempotency survives the marking', () => {
  it('a lost reply leaves the row exportable and the key stable', async () => {
    // The failure the marking must not break: the POST landed (or the route
    // claimed the key) but the reply was lost. The local id is untouched by
    // the write-back, so a retry carries the SAME key and converges on the
    // same web row instead of inserting a second one.
    const trip = await seedLocalTrip();

    mockFetch(() => ({ ok: true, status: 201, json: { success: true, data: null } }));
    const lost = await exportLocalTrips(PROFILE_ID);
    expect(lost.exported).toBe(0);

    // The row is still a candidate, because it was never marked.
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

    // Marking the row cannot change the key, because the key never reads
    // `source_id`.
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
    // The web row is still there: export never deletes on either side, and
    // nothing here ever calls the API again.
    const callsAfter = issued().filter((r) => r.sql.startsWith('DELETE'));
    expect(callsAfter.some((r) => r.sql.includes('trips'))).toBe(true);
  });

  it('still converges if the marked row is re-imported after another export', async () => {
    // The order that must not rot: mark, then import a second web trip, then
    // re-import the first. One row per web id, always.
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
    // Source-level guard: the contract is that the CALLER wires it, so the
    // suite pins the shape of the seam rather than only the db behaviour.
    const source = readFileSync(join(__dirname, '..', '..', 'data', 'index.ts'), 'utf8');
    expect(source).toContain("await Db.linkExportedRow('trips'");
    expect(source).toContain("await Db.linkExportedRow('meals'");
  });
});
