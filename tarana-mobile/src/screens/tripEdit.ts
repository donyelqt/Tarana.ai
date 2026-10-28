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

/**
 * Trip date arithmetic shared by the edit form's end-date derivation.
 *
 * Ported from the web app (src/app/itinerary-generator/utils/travelDates.ts):
 * when a trip has a fixed duration, editing the start date must also move the
 * end date so the payload stays internally consistent. The mobile app stores
 * `formData.dates.start` and `formData.dates.end` inside the opaque `payload`
 * JSON — editing only `date` left `dates.end` stale, the same bug the web
 * dialog had before its fix.
 */

/** Days implied by a duration label such as "1 Day", "2 Days". `null` if no leading number. */
export function durationDays(label: string): number | null {
  const match = label.match(/\d+/);
  if (!match) return null;
  const days = parseInt(match[0], 10);
  return Number.isNaN(days) || days <= 0 ? null : days;
}

/**
 * The end date implied by a start date and a duration label.
 *
 * Inclusive of the first day, so "1 Day" ends on the start date and "2 Days"
 * ends one day later. Returns undefined when either input is missing.
 */
export function endDateForDuration(
  start: Date | undefined,
  durationLabel: string
): Date | undefined {
  if (!start) return undefined;
  const days = durationDays(durationLabel);
  if (days === null) return undefined;
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);
  return end;
}

/** `yyyy-mm-dd` ISO string from a Date, built to avoid Date's UTC rollover. */
export function dateToIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Locale date string (e.g. "March 4, 2026") → yyyy-mm-dd ISO, or null. */
export function parseLocaleDateToIso(token: string): string | null {
  const d = new Date(token);
  if (Number.isNaN(d.getTime())) return null;
  return dateToIso(d);
}

/**
 * Derive the end-date ISO for a trip whose start date and duration are known.
 *
 * Returns null when either side is missing, leaving the existing end untouched
 * rather than clearing it. This is the single source of truth for the
 * "auto calculated end date" feature, shared by every surface that edits a
 * start date.
 */
export function deriveEndDate(
  startIso: string | null,
  durationLabel: string
): string | null {
  if (!startIso) return null;
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;
  const derived = endDateForDuration(start, durationLabel);
  return derived ? dateToIso(derived) : null;
}

/** A trip's own editable fields. The `date` column holds the start date. */
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

/**
 * The payload a permitted save sends to the seam.
 *
 * The end date is re-derived from the edited start date + the trip's duration
 * so the payload's `formData.dates` stays consistent — the same rule the web
 * dialog uses (endDateForDuration from travelDates.ts). If the start date was
 * cleared or the duration cannot be parsed, the existing end is left alone.
 */
export function tripEditPayload(
  draft: TripEditDraft,
  options?: {
    /** The trip's `formData.duration` label (e.g. "1 day", "3 Days"). */
    duration?: string | null;
    /** The existing payload to patch in the new end date. */
    payload?: string | null;
  }
): {
  title: string;
  date: string | null;
  budget: string | null;
  tags: string[];
  /** When an end date is derivable, the patched payload string. */
  payload?: string | null;
} {
  const base = {
    title: draft.title.trim(),
    date: draft.date.trim() === '' ? null : draft.date.trim(),
    budget: draft.budget.trim() === '' ? null : draft.budget.trim(),
    tags: parseTags(draft.tags),
  };

  const duration = options?.duration ?? null;
  const startIso = base.date;

  // When start is cleared, drop the dates pair from the payload too — a
  // one-sided range has no honest serialized form.
  if (!startIso) {
    return { ...base, payload: patchPayloadEndDate(options?.payload ?? null, '', '') };
  }

  if (!duration) return { ...base, payload: options?.payload ?? null };

  const endIso = deriveEndDate(startIso, duration);
  if (!endIso) return { ...base, payload: options?.payload ?? null };

  const patched = patchPayloadEndDate(options?.payload ?? null, startIso, endIso);
  return { ...base, payload: patched };
}

/** Inject `dates.start` and `dates.end` into the payload's formData. */
function patchPayloadEndDate(
  rawPayload: string | null,
  startIso: string,
  endIso: string
): string | null {
  if (!rawPayload) return null;
  try {
    const parsed = JSON.parse(rawPayload);
    if (typeof parsed !== 'object' || parsed === null) return rawPayload;
    if (!parsed.formData || typeof parsed.formData !== 'object') {
      parsed.formData = {};
    }
    parsed.formData.dates = { start: startIso, end: endIso };
    return JSON.stringify(parsed);
  } catch {
    return rawPayload;
  }
}
