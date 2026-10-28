/**
 * Pure logic behind the saved-trips editor: what the form holds, whether a
 * save is allowed, and what the save sends.
 *
 * Split out of the page for the same reason mobile keeps `tripEdit.ts` beside
 * its screen: the repo's test suite can exercise a module directly, while a
 * rule that only exists as JSX is invisible to it. Three rules are worth that
 * guarantee — a blank title must never reach the database, a save with nothing
 * changed must not write, and more tags than the schema allows must not go
 * anywhere near the route — and all of them would otherwise live in onClick.
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
 * How many tags a save may carry. `UpdateItinerarySchema` declares
 * `tags: z.array(z.string().max(100)).max(50)` (`src/lib/data/itineraryMapper.ts:162`),
 * so the 51st tag is refused by the route; counting here keeps the reason on
 * screen instead of coming back as a generic 400.
 */
export const MAX_TAGS = 50;

/**
 * Why a save cannot proceed, or null when it can.
 *
 * A blank title is rejected rather than trimmed away: `UpdateItinerarySchema`
 * declares `title` as `.nullable().optional()`
 * (`src/lib/data/itineraryMapper.ts:158`), so a NULL title is accepted by the
 * schema and would write a NULL column. That row renders as an empty string in
 * the saved-trips list (`src/app/saved-trips/page.tsx:164`) — an unnameable row
 * with nothing to click by. Refusing it here names the problem instead.
 *
 * `date` and `budget` are freely clearable and get no guard of their own: both
 * are nullable text (`supabase/migrations/20231231000000_baseline_users_and_itineraries.sql:74-75`)
 * and `UpdateItinerarySchema` accepts an explicit null for each
 * (`src/lib/data/itineraryMapper.ts:159-160`), mobile's import binds each column
 * with `row.date ?? null` / `row.budget ?? null`
 * (`tarana-mobile/src/data/index.ts:132-133`) and so loses nothing in the round
 * trip, and the renderers degrade to an explicit placeholder rather than a
 * broken row — the saved-trips list prints `{itinerary.date || 'Date not set'}`
 * and `{itinerary.budget || 'Not set'}` (`src/app/saved-trips/page.tsx:173,183`),
 * `formatDateRange` returns 'Date not specified'
 * (`src/lib/data/savedItineraries.ts:347`) and the mobile detail view falls back
 * to 'No details' (`tarana-mobile/src/screens/TripDetail.tsx:284`). Clearing
 * either is a value the user chose to drop, not a state that needs this
 * module's permission.
 */
export function tripEditError(draft: TripEditDraft): string | null {
  if (draft.title.trim().length === 0) return 'Give the trip a title before saving.';
  if (parseTags(draft.tags).length > MAX_TAGS) return `A trip can hold at most ${MAX_TAGS} tags.`;
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
