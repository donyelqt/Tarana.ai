import { config } from '../config';
import { withMobileAuth } from '../auth';

export type MealNote = {
  title: string | null;
  notes: string | null;
};

type NotesEnvelope = {
  notes?: { title?: string | null; notes?: string | null } | null;
};

type SaveEnvelope = {
  success?: boolean;
  data?: { title?: string | null; notes?: string | null } | null;
  error?: string;
};

function baseUrl(): string {
  return config.webBaseUrl.replace(/\/$/, '');
}

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error || `Request failed (HTTP ${res.status})`;
}

export async function getMealNote(mealId: string): Promise<MealNote | null> {
  const res = await fetch(`${baseUrl()}/api/saved-meals/${encodeURIComponent(mealId)}`, {
    method: 'GET',
    headers: await withMobileAuth({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const body = (await res.json()) as NotesEnvelope;
  const note = body.notes;
  if (!note) return null;
  return { title: note.title ?? null, notes: note.notes ?? null };
}

export async function saveMealNote(
  mealId: string,
  fields: { title: string | null; notes: string | null }
): Promise<MealNote | null> {
  const title = fields.title?.trim() ? fields.title : null;
  const notes = fields.notes?.trim() ? fields.notes : null;
  const res = await fetch(`${baseUrl()}/api/saved-meals/${encodeURIComponent(mealId)}`, {
    method: 'PATCH',
    headers: await withMobileAuth({ Accept: 'application/json', 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, notes }),
  });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const body = (await res.json()) as SaveEnvelope;
  if (body.success === false) {
    throw new Error('The note was not saved.');
  }
  const data = body.data;
  if (!data) return null;
  return { title: data.title ?? null, notes: data.notes ?? null };
}