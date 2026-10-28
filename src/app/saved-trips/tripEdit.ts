import type { SavedItinerary } from '@/lib/data';
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
 * are raw user strings; `tags` carries the stored array as one comma-separated
 * string so the payload builder reads it back through `parseTags`.
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
  /**
   * The generator's saved dates, used to seed the date pickers when the row's
   * `date` column is null, empty, or holds a single date rather than a pair.
   * Only the `dates` sub-object is read — the editor must not touch the rest
   * of `formData`, matching the rule that `formData` is generator input only.
   */
  formData?: { dates: { start: string; end: string } | null | undefined } | null;
};

/**
 * The draft as the form starts, seeded from the row. A null or absent column
 * renders as '', so the input never shows the string "null" the way a template
 * literal would.
 *
 * When the row's `date` column is null, empty, the generator's own
 * `'Date not specified'`, or a lone date that does not form a pair, the draft
 * is seeded from `formData.dates` instead. The saved trip's day plan was
 * planned against that duration, so the pickers must reflect it — not an empty
 * field or a single day — without the user having to re-pick the end date.
 */
export function draftFromTrip(trip: TripEditSource): TripEditDraft {
  return {
    title: trip.title ?? '',
    date: effectiveDateSeed(trip),
    budget: trip.budget ?? '',
    tags: (trip.tags ?? []).join(', '),
  };
}

/**
 * The row string the form should hold for `date`: the row's own value when it
 * is present, otherwise a locale pair regenerated from `formData.dates`.
 *
 * The row's own string passes through verbatim: `tripEditChanged` compares in
 * pair space, so reformatting is never an edit, and the raw token is what the
 * list page already renders. When the column is null/empty, the generator's own
 * `formData.dates` (ISO timestamps) are converted to the same locale pair the
 * generator wrote, so the pickers reflect the saved plan.
 */
function effectiveDateSeed(trip: TripEditSource): string {
  if (trip.date && trip.date.trim() !== '') {
    return trip.date;
  }
  const fs = trip.formData?.dates?.start;
  const fe = trip.formData?.dates?.end;
  if (fs && fe) {
    const range = datesToRange(fs, fe);
    if (range) return range;
  }
  return '';
}

/** Convert a Date to the `yyyy-mm-dd` ISO string the pair parser consumes. */
export function dateToIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Parse an ISO date string into a Date at local midnight. Handles both
 * `yyyy-mm-dd` and full ISO datetime strings like `2026-03-04T00:00:00.000Z`
 * (the form `formData.dates` stores) by extracting just the date portion.
 */
export function isoToDate(iso: string): Date | null {
  const datePart = iso.trim().split('T')[0].split(' ')[0];
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  if (match === null) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Build the row string for a pair of ISO date strings (from `formData.dates`),
 * returning null if either date is unparseable.
 */
function datesToRange(start: string, end: string): string | null {
  const s = isoToDate(start);
  const e = isoToDate(end);
  if (s === null || e === null) return null;
  return rowDateFromDateRange({ start: dateToIso(s), end: dateToIso(e) });
}

/**
 * The two halves of the date pair the dialog owns. Both are the native
 * `<input type="date">` ISO form `yyyy-mm-dd`, which is what the control emits
 * and the only form the parser below can produce. An empty string means the
 * control is blank, not that a date is missing.
 */
export type TripDateRange = {
  start: string;
  end: string;
};

/**
 * Read a stored `date` column (the row's own string) into the pair the form
 * owns.
 *
 * The column holds one string for both halves — the generator writes
 * `<toLocaleDateString(start)> - <toLocaleDateString(end)>`
 * (`src/app/itinerary-generator/hooks/useItineraryGenerator.ts:143-145`). When
 * it holds that pair, the parser splits on ` - ` and reads each token back to
 * ISO. A lone date (legacy or hand-typed) folds into a one-day range so the
 * form never drops it: the column holds one string for both halves, so a single
 * date has no honest two-sided form, and emptying the pair would erase it on
 * the next save. The literal `'Date not specified'` — the generator's own
 * placeholder for an unset pair — and any token no field order can reproduce
 * both seed as empty.
 */
export function dateRangeFromRowDate(raw: string | null | undefined): TripDateRange {
  if (raw == null) return { start: '', end: '' };
  const text = raw.trim();
  if (text === '') return { start: '', end: '' };
  const parts = text.split(' - ');
  if (parts.length === 2) {
    const start = parseLocaleDate(parts[0]);
    const end = parseLocaleDate(parts[1]);
    if (start === null || end === null) return { start: '', end: '' };
    return { start, end };
  }
  // A lone date seeds a one-day range rather than nothing.
  const single = parseLocaleDate(text);
  if (single === null) return { start: '', end: '' };
  return { start: single, end: single };
}

/**
 * The row string a pair writes, in the shape the generator writes so the list
 * page keeps rendering a familiar value and re-reading the column gives the
 * same pair back.
 *
 * Both unset → null: the column is nullable and the list renders its own
 * placeholder, so a cleared date is an absent column rather than a blank
 * string. Otherwise it is
 * `<toLocaleDateString(start)> - <toLocaleDateString(end)>`, matching
 * `src/app/itinerary-generator/hooks/useItineraryGenerator.ts:143-145` exactly.
 *
 * A one-sided range also writes null rather than a lone date: the column holds
 * one string for both halves, so a half-filled pair has no honest single-string
 * form, and writing a half value would read back as an unparseable token on the
 * next pass.
 */
export function rowDateFromDateRange(range: TripDateRange): string | null {
  const start = range.start.trim();
  const end = range.end.trim();
  if (start === '' || end === '') return null;
  return `${localeOfIso(start)} - ${localeOfIso(end)}`;
}

/**
 * The pair a form holds, read back out of the draft's `date` column.
 *
 * The draft stores the row string, so this is the inverse of
 * `dateRangeFromRowDate`: it re-splits the same shape so the dialog can round
 * a stored value through the pair controls without re-parsing a half-entered
 * token.
 */
export function dateRangeFromDraft(draft: TripEditDraft): TripDateRange {
  return dateRangeFromRowDate(draft.date);
}

/** `yyyy-mm-dd` → the locale string the row column holds, built to avoid Date's UTC rollover. */
function localeOfIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

/** The zero-padded ISO form a `<input type="date">` holds. */
function isoFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(year)}-${pad(month)}-${pad(day)}`;
}

/**
 * A single token of a stored range, read back to the control's `yyyy-mm-dd`.
 *
 * The locale form is read numerically against every plausible field order and
 * accepted only when re-formatting that order reproduces the token exactly,
 * which is what makes the read symmetric: `10/1/2026` is day-first in one
 * locale and month-first in another, so a fixed guess would silently swap a
 * March 10th and an October 1st. Anything that matches nothing — including a
 * garbage string and the legacy literal — returns null and seeds empty.
 */
function parseLocaleDate(token: string): string | null {
  const text = token.trim();
  if (text === '') return null;
  const asString = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day).toLocaleDateString();

  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (isoMatch) return isoFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const numeric = /^(\d{1,4})\D+(\d{1,2})\D+(\d{1,4})$/.exec(text);
  if (numeric) {
    const [a, b, c] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    for (const order of [
      [a, b, c], // m/d/y
      [c, a, b], // y/m/d
      [c, b, a], // y/d/m
    ]) {
      const candidate = isoFromParts(order[0], order[1], order[2]);
      if (candidate !== null && asString(order[0], order[1], order[2]) === text) return candidate;
    }
    return null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = parsed.getMonth() + 1;
  const day = parsed.getDate();
  const iso = isoFromParts(year, month, day);
  if (iso === null || asString(year, month, day) !== text) return null;
  return iso;
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

/**
 * Whether the draft actually differs from the stored row.
 *
 * Tags count because the dialog still renders an editable tag input: the row's
 * rendering order is user-visible, so neither reordering nor removal is folded
 * into a set compare. If the dialog is later rewritten to show tags read-only,
 * this is the place to drop the comparison, not `tripEditPayload`.
 */
export function tripEditChanged(
  trip: TripEditSource,
  draft: TripEditDraft
): boolean {
  if ((trip.title ?? '') !== draft.title) return true;
  // Compare in pair space so a reformatting is never an edit. The row's
  // date may be null while `formData.dates` holds the saved plan —
  // `effectiveDateSeed` reproduces that plan as a locale pair, so a draft that
  // was seeded from formData and left untouched does not look "changed".
  if (rowDateFromDateRange(dateRangeFromRowDate(effectiveDateSeed(trip))) !== rowDateFromDateRange(dateRangeFromDraft(draft))) {
    return true;
  }
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
 * `date` is trimmed but otherwise left as the form holds it: the dialog writes
 * the canonical `locale - locale` range into the draft when the user picks
 * dates, so a draft that came through the UI already carries the generator's
 * own shape. A programmatic caller may pass any parseable token; the
 * change-detector compares in pair space, so a reformatting is never an edit,
 * and whatever reaches the route round-trips back through `dateRangeFromRowDate`.
 *
 * `title` is required and never null: an untitled row is what the schema
 * forbids, and 'Untitled trip' is not a name the user chose.
 */
export function tripEditPayload(
  draft: TripEditDraft,
  options: { dates: TripDateRange; formData: SavedItinerary['formData'] } = {
    dates: { start: '', end: '' },
    formData: {} as SavedItinerary['formData'],
  }
): {
  title: string;
  date: string | null;
  budget: string | null;
  tags: string[];
  formData: SavedItinerary['formData'];
} {
  const dateStr = draft.date.trim();
  const hasPair = options.dates.start !== '' && options.dates.end !== '';
  return {
    title: draft.title.trim(),
    date: dateStr === '' ? null : dateStr,
    budget: draft.budget.trim() === '' ? null : draft.budget.trim(),
    tags: parseTags(draft.tags),
    formData: {
      ...options.formData,
      dates: hasPair
        ? { start: options.dates.start, end: options.dates.end }
        : { start: '', end: '' },
    },
  };
}
