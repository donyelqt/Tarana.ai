/**
 * Local-first store — SQLite source of truth for the mobile app (§2.1).
 *
 * Two tables, one contract:
 * - `profiles` — a single active local profile in v1 (`profile_id` is
 *   nullable on trips so multi-profile later is additive, not a migration).
 * - `trips` — local CRUD + one-way web imports. Imports dedupe on
 *   `(source, source_id)` so re-importing never duplicates.
 *
 * Security: every value crosses via bound `?` parameters (prepared
 * statements under the hood). `execAsync` runs the static schema string
 * only — never interpolated input.
 * API verified against expo-sqlite SDK 57 docs
 * (https://docs.expo.dev/versions/latest/sdk/sqlite/):
 * `openDatabaseAsync` / `execAsync` / `runAsync` / `getFirstAsync` /
 * `getAllAsync`, WAL via PRAGMA, versioning via `PRAGMA user_version`.
 */
import * as SQLite from 'expo-sqlite';
import * as TokenStorage from '../tokenStorage';

const DB_NAME = 'tarana.db';
const SCHEMA_VERSION = 1;
const ACTIVE_PROFILE_KEY = 'tarana.activeProfileId';

const MAX_DISPLAY_NAME = 60;

export type LocalProfile = {
  id: string;
  display_name: string;
  created_at: string;
};

export type LocalTrip = {
  id: string;
  profile_id: string | null;
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[];
  /** Full itinerary JSON, opaque to queries. Null for hand-made/imported-light rows. */
  payload: string | null;
  source: 'local' | 'web-import';
  source_id: string | null;
  imported_at: string | null;
  created_at: string;
};

type TripRow = Omit<LocalTrip, 'tags' | 'source'> & {
  tags: string | null;
  source: string;
};

const SCHEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  profile_id TEXT NULL REFERENCES profiles(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_trips_profile ON trips(profile_id, created_at DESC);
`;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  // v1: fresh tables only. Future versions add `if (current === N)` steps
  // above the version bump, per the docs migration pattern.
  await db.execAsync(SCHEMA);
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

function newId(): string {
  try {
    // Hermes (modern) implements crypto.randomUUID.
    return crypto.randomUUID();
  } catch {
    return `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffff).toString(36)}`;
  }
}

function cleanDisplayName(input: string): string {
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Please enter a display name.');
  if (name.length > MAX_DISPLAY_NAME) {
    throw new Error(`Display name must be ${MAX_DISPLAY_NAME} characters or fewer.`);
  }
  return name;
}

function toTrip(row: TripRow): LocalTrip {
  let tags: string[] = [];
  if (row.tags) {
    try {
      const parsed: unknown = JSON.parse(row.tags);
      if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === 'string');
    } catch {
      tags = [];
    }
  }
  return {
    id: row.id,
    profile_id: row.profile_id,
    title: row.title,
    date: row.date,
    budget: row.budget,
    tags,
    payload: row.payload,
    source: row.source === 'web-import' ? 'web-import' : 'local',
    source_id: row.source_id,
    imported_at: row.imported_at,
    created_at: row.created_at,
  };
}

// ── Profiles ─────────────────────────────────────────────

export async function createProfile(displayName: string): Promise<LocalProfile> {
  const name = cleanDisplayName(displayName);
  const db = await getDb();
  const id = newId();
  await db.runAsync('INSERT INTO profiles (id, display_name) VALUES (?, ?)', id, name);
  await TokenStorage.setItemAsync(ACTIVE_PROFILE_KEY, id);
  const row = await db.getFirstAsync<LocalProfile>('SELECT * FROM profiles WHERE id = ?', id);
  if (!row) throw new Error('Profile was not created.');
  return row;
}

export async function getActiveProfileId(): Promise<string | null> {
  return TokenStorage.getItemAsync(ACTIVE_PROFILE_KEY);
}

export async function getActiveProfile(): Promise<LocalProfile | null> {
  const id = await getActiveProfileId();
  if (!id) return null;
  const db = await getDb();
  return db.getFirstAsync<LocalProfile>('SELECT * FROM profiles WHERE id = ?', id);
}

export async function clearActiveProfile(): Promise<void> {
  await TokenStorage.deleteItemAsync(ACTIVE_PROFILE_KEY);
}

// ── Trips ────────────────────────────────────────────────

export async function createTrip(input: {
  profileId: string;
  title?: string | null;
  date?: string | null;
  budget?: string | null;
  tags?: string[];
  payload?: string | null;
}): Promise<LocalTrip> {
  const db = await getDb();
  const id = newId();
  await db.runAsync(
    'INSERT INTO trips (id, profile_id, title, date, budget, tags, payload, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id,
    input.profileId,
    input.title ?? null,
    input.date ?? null,
    input.budget ?? null,
    JSON.stringify(input.tags ?? []),
    input.payload ?? null,
    'local'
  );
  const row = await db.getFirstAsync<TripRow>('SELECT * FROM trips WHERE id = ?', id);
  if (!row) throw new Error('Trip was not created.');
  return toTrip(row);
}

export async function listTripsByProfile(profileId: string): Promise<LocalTrip[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<TripRow>(
    'SELECT * FROM trips WHERE profile_id = ? ORDER BY created_at DESC',
    profileId
  );
  return rows.map(toTrip);
}

/**
 * One-way web import. Idempotent on (source, source_id): re-importing the
 * same web itinerary updates the local copy instead of duplicating it.
 */
export async function upsertImportedTrip(input: {
  profileId: string;
  sourceId: string;
  title?: string | null;
  date?: string | null;
  budget?: string | null;
  tags?: string[];
  payload?: string | null;
}): Promise<LocalTrip> {
  if (!input.sourceId) throw new Error('Import requires a source id.');
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO trips (id, profile_id, title, date, budget, tags, payload, source, source_id, imported_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'web-import', ?, ?)
     ON CONFLICT(source, source_id) DO UPDATE SET
       title = excluded.title,
       date = excluded.date,
       budget = excluded.budget,
       tags = excluded.tags,
       payload = excluded.payload,
       imported_at = excluded.imported_at`,
    newId(),
    input.profileId,
    input.title ?? null,
    input.date ?? null,
    input.budget ?? null,
    JSON.stringify(input.tags ?? []),
    input.payload ?? null,
    input.sourceId,
    now
  );
  const row = await db.getFirstAsync<TripRow>(
    "SELECT * FROM trips WHERE source = 'web-import' AND source_id = ?",
    input.sourceId
  );
  if (!row) throw new Error('Imported trip was not saved.');
  return toTrip(row);
}

export async function deleteTrip(id: string, profileId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM trips WHERE id = ? AND profile_id = ?', id, profileId);
}
