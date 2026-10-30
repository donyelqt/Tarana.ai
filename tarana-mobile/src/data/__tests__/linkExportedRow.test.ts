import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import { getDb, linkExportedRow, upsertImportedMeal, upsertImportedTrip } from '../../db';
import type { ExportedTable } from '../../db';

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
      meal_type TEXT NULL,
      price REAL NULL,
      good_for TEXT NULL,
      location TEXT NULL,
      items TEXT NULL,
      source TEXT NOT NULL DEFAULT 'local',
      source_id TEXT NULL,
      imported_at TEXT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(source, source_id)
    );
  `);
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

interface Stored {
  id: string;
  source: string;
  source_id: string | null;
}

async function open(): Promise<void> {
  await getDb();
}

function rows(table: ExportedTable): Stored[] {
  return slot.db.prepare(`SELECT id, source, source_id FROM ${table} ORDER BY id`).all() as unknown as Stored[];
}

function issued(): Run[] {
  return slot.runs;
}

beforeEach(async () => {
  await open();
  slot.db.exec('DELETE FROM trips; DELETE FROM meals;');
  slot.runs = [];
});

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
      { id: 'trip-local-1', source: 'web-import', source_id: 'web-trip-1' },
    ]);
  });

  it('records the web id on a local meal', async () => {
    seed('meals', 'meal-local-1');
    await linkExportedRow('meals', 'meal-local-1', 'web-meal-1');

    expect(rows('meals')).toEqual([
      { id: 'meal-local-1', source: 'web-import', source_id: 'web-meal-1' },
    ]);
  });

  it('leaves every other row untouched', async () => {
    seed('trips', 'trip-1');
    seed('trips', 'trip-2');
    seed('trips', 'trip-3');

    await linkExportedRow('trips', 'trip-2', 'web-2');

    expect(rows('trips')).toEqual([
      { id: 'trip-1', source: 'local', source_id: null },
      { id: 'trip-2', source: 'web-import', source_id: 'web-2' },
      { id: 'trip-3', source: 'local', source_id: null },
    ]);
  });

  it('marks the row web-import, so the import conflict can match it', async () => {
    seed('trips', 'trip-local-1');
    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');

    const run = issued().find((r) => r.sql.startsWith('UPDATE'));
    expect(run?.sql).toMatch(/SET source = \?, source_id = \? WHERE id = \?/);
    expect(run?.params).toEqual(['web-import', 'web-trip-1', 'trip-local-1']);
  });

  it('addresses both tables of the same id independently', async () => {
    seed('trips', 'same-id');
    seed('meals', 'same-id');

    await linkExportedRow('trips', 'same-id', 'web-trip-1');

    expect(rows('trips')).toEqual([{ id: 'same-id', source: 'web-import', source_id: 'web-trip-1' }]);
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
  it('a re-import of a linked local row converges on ONE row', async () => {
    seed('trips', 'trip-local-1');

    await linkExportedRow('trips', 'trip-local-1', 'web-trip-1');
    await upsertImportedTrip({
      profileId: 'profile-1',
      sourceId: 'web-trip-1',
      title: 'Baguio Weekend',
    });

    const linked = rows('trips');
    expect(linked).toHaveLength(1);
    expect(linked[0]).toEqual({ id: 'trip-local-1', source: 'web-import', source_id: 'web-trip-1' });
  });

  it('a re-import of a linked local meal also converges on ONE row', async () => {
    seed('meals', 'meal-local-1');

    await linkExportedRow('meals', 'meal-local-1', 'web-meal-1');
    await upsertImportedMeal({
      profileId: 'profile-1',
      sourceId: 'web-meal-1',
      cafeName: 'Good Shepherd Cafe',
    });

    expect(rows('meals')).toEqual([
      { id: 'meal-local-1', source: 'web-import', source_id: 'web-meal-1' },
    ]);
  });

  it('a re-import of an UNLINKED local row still duplicates — the failure the link prevents', async () => {
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
  it('selects between two static statements and binds every value', async () => {
    seed('trips', 'trip-1');
    await linkExportedRow('trips', 'trip-1', 'web-1');

    const update = issued().find((r) => r.sql.startsWith('UPDATE'));
    expect(update?.params).toEqual(['web-import', 'web-1', 'trip-1']);
    expect(update?.sql.match(/\?/g)).toHaveLength(3);
    expect(update?.sql).not.toMatch(/\$\{|"|\`/);
  });
});
