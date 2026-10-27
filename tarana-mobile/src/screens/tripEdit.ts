/**
 * Pure logic behind TripDetail's edit mode: what the form holds, whether a
 * save is allowed, and what the save sends.
 *
 * Splitting this from the screen is not abstraction for its own sake — it
 * is what makes the edit contract testable here. The mobile suite renders
 * no views (jest runs `testEnvironment: 'node'`), so anything that only
 * exists as JSX is invisible to a test. The two rules worth pinning both
 * live in that category: a blank title must never reach the database as an
 * empty string, and a save with nothing changed must not write.
 */

/** A trip's own editable fields. `payload` is never editable here. */
export type TripEditDraft = {
  title: string;
  date: string;
  budget: string;
  tags: string;
};

/** The draft as the form starts, read off the row. Blank renders as ''. */
export function draftFromTrip(trip: {
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[];
}): TripEditDraft {
  return {
    title: trip.title ?? '',
    date: trip.date ?? '',
    budget: trip.budget ?? '',
    tags: (trip.tags ?? []).join(', '),
  };
}

/**
 * Tags as the form stores them: comma-separated, trimmed, with the empties
 * dropped. "Baguio, , food trip" is two tags, not three, because the third
 * would render as a stray pill with no name.
 */
export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Why a save cannot proceed, or null when it can.
 *
 * A blank title is rejected rather than trimmed away: `createTrip` already
 * refuses to fabricate a name, so an edit that writes an empty title would
 * produce an "Untitled trip" the user cannot name afterwards.
 */
export function tripEditError(draft: TripEditDraft): string | null {
  if (draft.title.trim().length === 0) return 'Give the trip a title before saving.';
  return null;
}

/** Whether the draft actually differs from the stored row. */
export function tripEditChanged(trip: {
  title: string | null;
  date: string | null;
  budget: string | null;
  tags: string[];
}, draft: TripEditDraft): boolean {
  if ((trip.title ?? '') !== draft.title) return true;
  if ((trip.date ?? '') !== draft.date) return true;
  if ((trip.budget ?? '') !== draft.budget) return true;
  const stored = [...(trip.tags ?? [])];
  const edited = parseTags(draft.tags);
  if (stored.length !== edited.length) return true;
  return stored.some((tag, i) => tag !== edited[i]);
}

/** The payload a permitted save sends to the seam. */
export function tripEditPayload(draft: TripEditDraft): {
  title: string;
  date: string | null;
  budget: string | null;
  tags: string[];
} {
  return {
    title: draft.title.trim(),
    date: draft.date.trim() === '' ? null : draft.date.trim(),
    budget: draft.budget.trim() === '' ? null : draft.budget.trim(),
    tags: parseTags(draft.tags),
  };
}
