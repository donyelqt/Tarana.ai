import * as SQLite from 'expo-sqlite';

export type MealNote = {
  meal_id: string;
  title: string | null;
  notes: string | null;
  updated_at: string;
};

type NoteRow = {
  meal_id: string;
  title: string | null;
  notes: string | null;
  updated_at: string;
};

const SCHEMA_VERSION = 4;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('tarana.db');
      const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const current = row?.user_version ?? 0;
      if (current < SCHEMA_VERSION) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS meal_notes (
            meal_id TEXT PRIMARY KEY NOT NULL,
            title TEXT,
            notes TEXT,
            updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
          );
          CREATE INDEX IF NOT EXISTS idx_meal_notes_updated ON meal_notes(updated_at DESC);
        `);
        await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      }
      return db;
    })();
  }
  return dbPromise;
}

function toNote(row: NoteRow): MealNote {
  return {
    meal_id: row.meal_id,
    title: row.title,
    notes: row.notes,
    updated_at: row.updated_at,
  };
}

export async function getMealNote(mealId: string): Promise<MealNote | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<NoteRow>(
    'SELECT meal_id, title, notes, updated_at FROM meal_notes WHERE meal_id = ?',
    mealId
  );
  return row ? toNote(row) : null;
}

export async function saveMealNote(
  mealId: string,
  input: { title: string | null; notes: string | null }
): Promise<MealNote | null> {
  const db = await getDb();
  const updatedAt = new Date().toISOString();
  const title = input.title?.trim() ? input.title : null;
  const notes = input.notes?.trim() ? input.notes : null;
  await db.runAsync(
    `INSERT INTO meal_notes (meal_id, title, notes, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(meal_id) DO UPDATE SET
       title = excluded.title,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
    mealId,
    title,
    notes,
    updatedAt
  );
  const row = await db.getFirstAsync<NoteRow>(
    'SELECT meal_id, title, notes, updated_at FROM meal_notes WHERE meal_id = ?',
    mealId
  );
  return row ? toNote(row) : null;
}

export async function deleteMealNote(mealId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meal_notes WHERE meal_id = ?', mealId);
}
