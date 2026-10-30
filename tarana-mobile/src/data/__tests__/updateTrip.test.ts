import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createProfile, createTrip, listTrips, updateTrip } from '../../data';

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
    openDatabaseAsync: async () => ({
      async execAsync(sql: string) {
        db.exec(sql);
      },
      async runAsync(sql: string, ...params: unknown[]) {
        db.prepare(sql).run(...(params as never[]));
        return { lastInsertRowId: 0, changes: 0, rows: [] };
      },
      async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
        return (db.prepare(sql).get(...(params as never[])) as T | null) ?? null;
      },
      async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
        return db.prepare(sql).all(...(params as never[])) as T[];
      },
    }),
  };
});

jest.mock('../../tokenStorage', () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));

jest.mock('../../config', () => ({
  config: { webBaseUrl: 'http://localhost:3000' },
  requireConfig: (key: string) => {
    throw new Error(`Missing config: ${key}`);
  },
}));

jest.mock('../../auth', () => ({
  getWebToken: async () => null,
  linkAccount: async () => ({}),
  unlinkAccount: async () => {},
}));

jest.mock('../../llm/modelManager', () => ({
  isLlamaAvailable: () => false,
}));

jest.mock('../../supabase', () => ({}));

describe('updateTrip — an edit reaches the stored row', () => {
  let profileId: string;
  let tripId: string;

  beforeEach(async () => {
    const profile = await createProfile('Edit Tester');
    profileId = profile.id;
    const trip = await createTrip({
      profileId,
      title: 'Old title',
      date: '2026-03-04',
      budget: '5000',
      tags: ['Baguio', 'food'],
      payload: '{"formData":{}}',
    });
    tripId = trip.id;
  });

  it('returns the new values and re-reads them from the database', async () => {
    const updated = await updateTrip(tripId, profileId, {
      title: 'New title',
      date: '2026-04-01',
      budget: '9000',
      tags: ['Baguio', 'hikes'],
    });
    expect(updated?.title).toBe('New title');
    expect(updated?.date).toBe('2026-04-01');
    expect(updated?.budget).toBe('9000');
    expect(updated?.tags).toEqual(['Baguio', 'hikes']);

    const reread = (await listTrips(profileId)).find((t) => t.id === tripId);
    expect(reread?.title).toBe('New title');
    expect(reread?.tags).toEqual(['Baguio', 'hikes']);
  });

  it('stores a cleared field as SQL NULL, not the string "null"', async () => {
    const updated = await updateTrip(tripId, profileId, {
      title: 'Kept',
      date: null,
      budget: null,
      tags: [],
    });
    expect(updated?.date).toBeNull();
    expect(updated?.budget).toBeNull();
    expect(updated?.tags).toEqual([]);
  });

  it('leaves payload untouched, so a rename cannot drop the day plan', async () => {
    await updateTrip(tripId, profileId, { title: 'Renamed', budget: '1', tags: ['x'] });
    const reread = (await listTrips(profileId)).find((t) => t.id === tripId);
    expect(reread?.payload).toBe('{"formData":{}}');
    expect(reread?.source).toBe('local');
  });

  it('finds no row when the profile does not own it', async () => {
    const other = await createProfile('Someone Else');
    expect(await updateTrip(tripId, other.id, { title: 'Stolen', tags: [] })).toBeNull();
  });

  it('leaves the original row unchanged when the profile does not own it', async () => {
    const other = await createProfile('Someone Else');
    await updateTrip(tripId, other.id, { title: 'Stolen', tags: [] });
    const reread = (await listTrips(profileId)).find((t) => t.id === tripId);
    expect(reread?.title).toBe('Old title');
    expect(reread?.budget).toBe('5000');
  });

  it('returns null for an unknown id instead of throwing', async () => {
    expect(await updateTrip('no-such-trip', profileId, { title: 'x', tags: [] })).toBeNull();
  });

  it('writes the supplied payload when one is provided', async () => {
    const patched = '{"formData":{"dates":{"start":"2026-03-10","end":"2026-03-12"}}}';
    await updateTrip(tripId, profileId, {
      title: 'Renamed',
      date: '2026-03-10',
      budget: '1',
      tags: ['x'],
      payload: patched,
    });
    const reread = (await listTrips(profileId)).find((t) => t.id === tripId);
    expect(reread?.payload).toBe(patched);
  });

  it('preserves the existing payload when none is supplied', async () => {
    await updateTrip(tripId, profileId, { title: 'Renamed', budget: '1', tags: ['x'] });
    const reread = (await listTrips(profileId)).find((t) => t.id === tripId);
    expect(reread?.payload).toBe('{"formData":{}}');
  });
});
