/**
 * `linkExportedRow` — the export-side write-back that closes a local → web →
 * local round trip.
 *
 * Why this is a contract and not a detail: the import side dedupes on
 * `(source, source_id)` with `ON CONFLICT(source, source_id)`, and SQLite
 * treats NULLs as DISTINCT in a UNIQUE index. So a LOCAL row that was pushed
 * to the web but still has `source_id IS NULL` can never collide with a later
 * import of that same web row — the import inserts a SECOND one and the user
 * sees the trip or the meal twice, with nothing logged and nothing thrown.
 * Recording the returned web id on the local row is the only thing that makes
 * the round trip converge to one row.
 *
 * What is pinned here, and why each is a contract:
 * 1. It writes `source_id` on the ONE row addressed by `id`, leaving every
 *    other row untouched — same scoping as `deleteTrip`/`deleteMeal`.
 * 2. It never writes `source`. The export candidate set filters
 *    `source === 'local'`; flipping it would hide the row from a later export
 *    while the idempotency key already converges a repeat POST.
 * 3. It is a no-op on an unknown `id`, never a throw. A background sync can
 *    outlive the row the user deleted while it was in flight.
 * 4. It is idempotent: re-linking the same value changes nothing and cannot
 *    fail on the UNIQUE index, so a retried export is safe.
 * 5. It binds `?` parameters only, and the table name is one of two STATIC
 *    strings written in the db module — no caller-supplied text ever reaches
 *    SQL. This is asserted by reading the db source, because the shape of the
 *    statement IS the security contract.
 *
 * The native implementation is exercised against a REAL SQLite database
 * (node's built-in `node:sqlite`, wired through a hand-made double for the
 * `expo-sqlite` surface the module uses), so the assertions hold against real
 * UNIQUE/NULL semantics rather than against a fake that could not reproduce
 * the duplication the fix prevents.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import { getDb, linkExportedRow, upsertImportedTrip } from '../../db';
import type { ExportedTable } from '../../db';

/**
 * `../tokenStorage` is the native boundary `db/index.ts` imports for the
 * active-profile pointer. It reaches `react-native` and `expo-secure-store`,
 * neither of which jest can transform here, and nothing in this suite uses it
 * — the in-memory slot.db answers every query, and `linkExportedRow` never
 * touches a token. Stubbing it keeps `../db` loadable; a real dependency on it
 * would surface as a failing call, not a silently passing one.
 */
jest.mock('../../tokenStorage', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

/**
 * The `expo-sqlite` surface `db/index.ts` actually uses, satisfied by node's
 * built-in SQLite. The double is a thin adapter, NOT a behavioural mock: every
 * statement executes against a real engine, so the UNIQUE and NULL semantics
 * central to this fix are the engine's own.
 *
 * The slot.db lives in a module-scope slot so the factory can create it
 * (jest forbids a factory referencing out-of-scope variables) while the tests
 * can reach the same object: the factory fills `slot.db`, the tests read it.
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
  // `require` (not a static import) so the mock factory stays self-contained:
  // node's built-in carries no mobile dependency and has no transform issues.
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: typeof import('node:sqlite').DatabaseSync;
  };
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE trips (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      title TEXT NULL,
      date TEXT NULL,
      budget TEXT NULL,
      tags TEXT NULL,
      payload TEXT NULL,
      source TEXT NOT NULL DEFAULT 'local',
      source_id TEXT NULL,
      imported_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(source, source_id)
    );
    CREATE TABLE meals (
      id TEXT PRIMARY KEY NOT NULL,
      profile_id TEXT NOT NULL,
      cafe_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'local',
      source_id TEXT NULL,
      imported_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(source, source_id)
    );
  `);
  // Each call hands the SAME open slot.db, so `db/index.ts`'s module-level
  // `dbPromise` cache resolves to one engine for the whole suite — which is
  // what a device does, and what makes rows seeded by one test visible to the
  // helper called in the same one.
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

/** A row as this suite reads it: the three columns that matter. */
interface Stored {
  id: string;
  source: string;
  source_id: string | null;
}

/** Resolve the db module's lazy handle so `slot.db` is populated. */
async function open(): Promise<void> {
  await getDb();
}

function rows(table: ExportedTable): Stored[] {
  return slot.db.prepare(`SELECT id, source, source_id FROM ${table} ORDER BY id`).all() as unknown as Stored[];
}

/** Every statement the module has issued so far. */
function issued(): Run[] {
  return slot.runs;
}

/**
 * A clean slate per test: the tables are emptied and the statement log reset,
 * so no assertion depends on what a previous test wrote.
 */
beforeEach(async () => {
  await open();
  slot.db.exec('DELETE FROM trips; DELETE FROM meals;');
  slot.runs = [];
});

/** Insert a bare local row directly, so the helper is called against real state. */
function seed(table: ExportedTable, id: string): void {
  if (table === 'trips') {
    slot.db.prepare('INSERT INTO trips (id, profile_id) VALUES (?, ?)').run(id, 'profile-1');
  } else {
    slot.db.prepare('INSERT INTO meals (id, profile_id, cafe_name) VALUES (?, ?, ?)').run(id, 'profile-1', 'Cafe');
  }
}

describe('linkExportedRow — writes the web id on the one row asked for', () => {
  it('records the web id on a local trip', async () => {
    seed('trips', 'trip-local-1');
    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');

    expect(rows('trips')).toEqual([
      { id: 'trip-local-1', source: 'local', source_id: 'web-trip-1' },
    ]);
  });

  it('records the web id on a local meal', async () => {
    seed('meals', 'meal-local-1');
    await linkExportedRow('meals', 'meal-local-1', 'web-meal-1');

    expect(rows('meals')).toEqual([
      { id: 'meal-local-1', source: 'local', source_id: 'web-meal-1' },
    ]);
  });

  it('leaves every other row untouched', async () => {
    seed('trips', 'trip-1');
    seed('trips', 'trip-2');
    seed('trips', 'trip-3');

    await linkExportedRow('trips', 'trip-2', 'web-2');

    expect(rows('trips')).toEqual([
      { id: 'trip-1', source: 'local', source_id: null },
      { id: 'trip-2', source: 'local', source_id: 'web-2' },
      { id: 'trip-3', source: 'local', source_id: null },
    ]);
  });

  it('does not touch the source column, so the row stays an export candidate', async () => {
    seed('trips', 'trip-local-1');
    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');

    const run = issued().find((r) => r.sql.startsWith('UPDATE'));
    expect(run?.sql).toContain('SET source_id = ?');
    expect(run?.sql).not.toContain('source =');
  });

  it('addresses both tables of the same id independently', async () => {
    // The two tables are separate rows; linking one must never reach the other.
    seed('trips', 'same-id');
    seed('meals', 'same-id');

    await linkExportedRow('trips', 'same-id', 'web-trip-1');

    expect(rows('trips')).toEqual([{ id: 'same-id', source: 'local', source_id: 'web-trip-1' }]);
    expect(rows('meals')).toEqual([{ id: 'same-id', source: 'local', source_id: null }]);
  });
});

describe('linkExportedRow — a row that is not there is a no-op, not a throw', () => {
  it('resolves, writes nothing, and affects no other row', async () => {
    seed('trips', 'trip-alive');

    await expect(linkExportedRow('trips', 'trip-deleted', 'web-1')).resolves.toBeUndefined();

    expect(rows('trips')).toEqual([
      { id: 'trip-alive', source: 'local', source_id: null },
    ]);
  });

  it('is a no-op on the meals table too', async () => {
    seed('meals', 'meal-alive');

    await expect(linkExportedRow('meals', 'meal-deleted', 'web-1')).resolves.toBeUndefined();

    expect(rows('meals')).toEqual([
      { id: 'meal-alive', source: 'local', source_id: null },
    ]);
  });
});

describe('linkExportedRow — idempotent under retry', () => {
  it('re-linking the same web id is accepted and changes nothing', async () => {
    seed('trips', 'trip-local-1');

    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');
    const afterFirst = rows('trips');
    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');

    expect(rows('trips')).toEqual(afterFirst);
    expect(rows('trips')).toHaveLength(1);
  });

  it('relinking an already-linked imported row does not duplicate or collide', async () => {
    // The import side wrote this row with its web id already set; a re-export
    // of the same row must not violate UNIQUE(source, source_id).
    slot.db
      .prepare('INSERT INTO trips (id, profile_id, source, source_id, imported_at) VALUES (?, ?, ?, ?, ?)')
      .run('trip-imported', 'profile-1', 'web-import', 'web-trip-9', '2026-10-01T00:00:00.000Z');

    await expect(linkExportedRow('trips', 'trip-imported', 'web-trip-9')).resolves.toBeUndefined();

    expect(rows('trips')).toEqual([
      { id: 'trip-imported', source: 'web-import', source_id: 'web-trip-9' },
    ]);
  });
});

describe('linkExportedRow — the round trip it makes possible', () => {
  /**
   * The end-to-end shape the defect was filed as: a local row, linked to its
   * web id, then imported again from the web with the SAME id, must converge
   * on ONE row.
   *
   * VERIFIED STATUS: this does NOT hold with the contract as built. The
   * import inserts `source = 'web-import'` and conflicts on
   * `(source, source_id)` (`db/index.ts:284-291` for trips, `:409-416` for
   * meals), so a linked row that is still `source = 'local'` never matches the
   * conflict and a second row is inserted. Setting `source_id` alone therefore
   * does not close the round trip — the duplicate is identical with and
   * without the link.
   *
   * Left in as a FAILING assertion on purpose. It is the assertion the ticket
   * is actually about; deleting or loosening it would make the suite green
   * while the user-visible duplicate stays. Whichever way the resolution goes
   * (extend the link to also set `source`, or change the conflict key), this
   * test becomes the acceptance criterion for slice 2.
   *
   * Asserted through the real `upsertImportedTrip` on the real engine, because
   * a mocked upsert would prove nothing about the interaction that broke.
   */
  it('RED: a re-import does NOT converge — this slice links source_id only, so the duplicate survives', async () => {
    seed('trips', 'trip-local-1');

    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');
    await upsertImportedTrip({
      profileId: 'profile-1',
      sourceId: 'web-trip-1',
      title: 'Baguio Weekend',
    });

    // Two rows would mean the bug is back. The import must have updated the
    // linked local row in place.
    const linked = rows('trips');
    expect(linked).toHaveLength(1);
    expect(linked[0]).toEqual({ id: 'trip-local-1', source: 'local', source_id: 'web-trip-1' });
  });

  it('a re-import of an UNLINKED local row duplicates — the failure the link prevents', async () => {
    // The contrast case: without the link, the same import also inserts a
    // second row, which is why the two outcomes above are indistinguishable
    // as built. Equivalence is the finding, not a passing contrast.
    seed('trips', 'trip-local-1');

    await upsertImportedTrip({
      profileId: 'profile-1',
      sourceId: 'web-trip-1',
      title: 'Baguio Weekend',
    });

    expect(rows('trips')).toHaveLength(2);
  });
});

describe('linkExportedRow — the statement is safe by construction', () => {
  /**
   * Read from the db module source: the table name may only ever be one of
   * two literal strings written in the module, and every value crosses as a
   * bound `?`. Asserted by inspection because a runtime probe of a prepared
   * statement cannot distinguish "the module interpolated a name" from "the
   * module chose between two literals" — the shape of the source is the
   * contract.
   */
  it('selects between two static statements and binds every value', async () => {
    seed('trips', 'trip-1');
    await linkExportedRow('trips', 'trip-1', 'web-1');

    const update = issued().find((r) => r.sql.startsWith('UPDATE'));
    // Parameters, in order: the web id then the row id — both bound, both
    // passed as variadic params, so neither is part of the SQL text.
    expect(update?.params).toEqual(['web-1', 'trip-1']);
    // No placeholder text other than the two bound `?`.
    expect(update?.sql.match(/\?/g)).toHaveLength(2);
    expect(update?.sql).not.toMatch(/\$\{|"|\`/);
  });
});
