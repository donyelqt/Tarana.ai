/**
 * Pure logic behind the saved-trips editor: what the form holds, whether a
 * save is allowed, and what the save sends.
 *
 * Split out of the page for the same reason mobile keeps `tripEdit.ts` beside
 * its screen: the repo's test suite can exercise a module directly, while a
 * rule that only exists as JSX is invisible to it. Two rules are worth that
 * guarantee — a blank title must never reach the database, and a save with
 * nothing changed must not write — and both would otherwise live in onClick.
 *
 * The four fields are the row's own columns. `formData` and `itineraryData`
 * are generator inputs and are deliberately never editable here, matching
 * mobile #736: an edit must not silently rewrite the generated day plan.
 */

/**
 * A trip's own editable fields as the form holds them. The three text fields
 * are raw user strings; tags are comma-separated so the input can be one
 * native text field rather than a chip widget.
 */
export type TripEditDraft = {
  title: string;
  date: string;
  budget: string;
  tags: string;
};

/** The stored row shape this module reads. */
export type TripEditSource = {
  title: string | null | undefined;
  date: string | null | undefined;
  budget: string | null | undefined;
  tags: string[] | null | undefined;
};

/**
 * The draft as the form starts. A null or absent column renders as '', so the
 * input never shows the string "null" the way a template literal would.
 */
export function draftFromTrip(trip: TripEditSource): TripEditDraft {
  return {
    title: trip.title ?? '',
    date: trip.date ?? '',
    budget: trip.budget ?? '',
    tags: (trip.tags ?? []).join(', '),
  };
}

/**
 * Tags as the form stores them: comma-separated, trimmed, empties dropped.
 * "Baguio, , food trip" is two tags, because the third would render as a pill
 * with no name.
 */
export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

/**
 * Why a save cannot proceed, or null when it can.
 *
 * A blank title is rejected rather than trimmed away: the column is
 * declared `min(1)` in `UpdateItinerarySchema`, so a blank title would be
 * refused by the route anyway — refusing it here keeps the reason on screen
 * instead of coming back as a generic 400.
 */
export function tripEditError(draft: TripEditDraft): string | null {
  if (draft.title.trim().length === 0) return 'Give the trip a title before saving.';
  // Clearing both date and budget would strand the trip on mobile:
  // `toWebTrip` refuses to export a trip missing either, so the row would stop
  // syncing rather than merely losing a value.
  if (!draft.date.trim() && !draft.budget.trim()) {
    return 'A trip needs at least a date or a budget to sync to mobile.';
  }
  return null;
}

/** Whether the draft actually differs from the stored row. */
export function tripEditChanged(
  trip: TripEditSource,
  draft: TripEditDraft
): boolean {
  if ((trip.title ?? '') !== draft.title) return true;
  if ((trip.date ?? '') !== draft.date) return true;
  if ((trip.budget ?? '') !== draft.budget) return true;
  const stored = trip.tags ?? [];
  const edited = parseTags(draft.tags);
  if (stored.length !== edited.length) return true;
  return stored.some((tag, index) => tag !== edited[index]);
}

/**
 * The payload a permitted save sends.
 *
 * `date` and `budget` clear to `null`, not `''`, because the columns are
 * nullable text and the list page renders the raw value — an empty string
 * would leave a blank cell where a cleared field should be absent. The
 * write path (`updateItinerary`) drops empty strings before they reach the
 * route, so sending null is also what makes a clear survive at all.
 *
 * `title` is required and never null: an untitled row is what the schema
 * forbids, and 'Untitled trip' is not a name the user chose.
 */
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
