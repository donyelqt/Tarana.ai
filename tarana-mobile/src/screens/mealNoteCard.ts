export type MealNoteLike = {
  title: string | null;
  notes: string | null;
};

export type NoteSaveState = 'idle' | 'saving';

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function mealNoteSummary(note: MealNoteLike | null): string | null {
  if (!note) return null;
  const title = oneLine(note.title ?? '');
  if (title) return title;
  const notes = oneLine(note.notes ?? '');
  return notes.length > 0 ? notes : null;
}

export function noteSavingLabel(state: NoteSaveState): string {
  return state === 'saving' ? 'Saving…' : 'Edit note';
}