import { beforeEach, describe, expect, it, jest } from '@jest/globals';

type StoredNote = { mealId: string; title: string | null; notes: string | null };

const mockStored = new Map<string, StoredNote>();

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: typeof import('node:sqlite').DatabaseSync;
  };
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_notes (
      meal_id TEXT PRIMARY KEY NOT NULL,
      title TEXT,
      notes TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  return {
    openDatabaseAsync: async () => ({
      async execAsync(sql: string) {
        db.exec(sql);
      },
      async runAsync(sql: string, ...params: unknown[]) {
        const info = db.prepare(sql).run(...(params as never[]));
        if (sql.includes('INSERT INTO meal_notes')) {
          mockStored.set(params[0] as string, {
            mealId: params[0] as string,
            title: params[1] as string | null,
            notes: params[2] as string | null,
          });
        }
        if (sql.includes('DELETE FROM meal_notes')) {
          mockStored.delete(params[0] as string);
        }
        return { lastInsertRowId: Number(info.lastInsertRowid), changes: Number(info.changes), rows: [] };
      },
      async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
        if (sql.includes('PRAGMA user_version')) return { user_version: 4 } as T;
        if (sql.includes('FROM meal_notes')) {
          const row = mockStored.get(params[0] as string);
          if (!row) return null;
          return { meal_id: row.mealId, title: row.title, notes: row.notes } as T;
        }
        return null;
      },
      async getAllAsync<T>(): Promise<T[]> {
        return [] as T[];
      },
      async closeAsync() {},
    }),
  };
});

import { getMealNote, saveMealNote } from '../notes';

describe('meal notes storage', () => {
  beforeEach(() => mockStored.clear());

  it('returns null when no note row exists for the meal', async () => {
    await expect(getMealNote('m1')).resolves.toBeNull();
  });

  it('round-trips a title and body', async () => {
    await saveMealNote('m1', { title: 'Lunch', notes: 'Order the short rib' });
    const row = await getMealNote('m1');
    expect(row?.title).toBe('Lunch');
    expect(row?.notes).toBe('Order the short rib');
  });

  it('overwrites the previous note instead of stacking a second row', async () => {
    await saveMealNote('m1', { title: 'First', notes: 'a' });
    await saveMealNote('m1', { title: 'Second', notes: 'b' });
    const row = await getMealNote('m1');
    expect(row?.title).toBe('Second');
    expect(mockStored.size).toBe(1);
  });

  it('stores blank input as null rather than an empty string', async () => {
    await saveMealNote('m1', { title: '   ', notes: '' });
    const row = await getMealNote('m1');
    expect(row?.title).toBeNull();
    expect(row?.notes).toBeNull();
  });
});