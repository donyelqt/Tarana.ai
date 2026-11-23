export const MAX_TITLE = 200;
export const MAX_NOTES = 5000;

export type NoteDraft = {
  title: string;
  notes: string;
};

export type StoredNoteLike = {
  title: string | null;
  notes: string | null;
};

function clean(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function noteDraftFrom(note: StoredNoteLike | null): NoteDraft {
  return {
    title: note?.title ?? '',
    notes: note?.notes ?? '',
  };
}

export function noteDraftError(draft: NoteDraft): string | null {
  const title = clean(draft.title);
  if (title && title.length > MAX_TITLE) return `The nickname can be at most ${MAX_TITLE} characters.`;
  const notes = clean(draft.notes);
  if (notes && notes.length > MAX_NOTES) return `The note can be at most ${MAX_NOTES} characters.`;
  return null;
}

export function noteDraftPayload(draft: NoteDraft): { title: string | null; notes: string | null } {
  return { title: clean(draft.title), notes: clean(draft.notes) };
}