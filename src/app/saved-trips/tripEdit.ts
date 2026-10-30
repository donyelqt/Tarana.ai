import type { SavedItinerary } from '@/lib/data';


export type TripEditDraft = {
  title: string;
  date: string;
  budget: string;
  tags: string;
};

export type TripEditSource = {
  title: string | null | undefined;
  date: string | null | undefined;
  budget: string | null | undefined;
  tags: string[] | null | undefined;
  formData?: { dates: { start: string; end: string } | null | undefined } | null;
};

export function draftFromTrip(trip: TripEditSource): TripEditDraft {
  return {
    title: trip.title ?? '',
    date: effectiveDateSeed(trip),
    budget: trip.budget ?? '',
    tags: (trip.tags ?? []).join(', '),
  };
}

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

export function dateToIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isoToDate(iso: string): Date | null {
  const datePart = iso.trim().split('T')[0].split(' ')[0];
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(datePart);
  if (match === null) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function datesToRange(start: string, end: string): string | null {
  const s = isoToDate(start);
  const e = isoToDate(end);
  if (s === null || e === null) return null;
  return rowDateFromDateRange({ start: dateToIso(s), end: dateToIso(e) });
}

export type TripDateRange = {
  start: string;
  end: string;
};

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
  const single = parseLocaleDate(text);
  if (single === null) return { start: '', end: '' };
  return { start: single, end: single };
}

export function rowDateFromDateRange(range: TripDateRange): string | null {
  const start = range.start.trim();
  const end = range.end.trim();
  if (start === '' || end === '') return null;
  return `${localeOfIso(start)} - ${localeOfIso(end)}`;
}

export function dateRangeFromDraft(draft: TripEditDraft): TripDateRange {
  return dateRangeFromRowDate(draft.date);
}

function localeOfIso(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

function isoFromParts(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) return null;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(year)}-${pad(month)}-${pad(day)}`;
}

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
      [a, b, c], 
      [c, a, b], 
      [c, b, a], 
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

export function parseTags(raw: string): string[] {
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

export const MAX_TAGS = 50;

export function tripEditError(draft: TripEditDraft): string | null {
  if (draft.title.trim().length === 0) return 'Give the trip a title before saving.';
  if (parseTags(draft.tags).length > MAX_TAGS) return `A trip can hold at most ${MAX_TAGS} tags.`;
  return null;
}

export function tripEditChanged(
  trip: TripEditSource,
  draft: TripEditDraft
): boolean {
  if ((trip.title ?? '') !== draft.title) return true;
  if (rowDateFromDateRange(dateRangeFromRowDate(effectiveDateSeed(trip))) !== rowDateFromDateRange(dateRangeFromDraft(draft))) {
    return true;
  }
  if ((trip.budget ?? '') !== draft.budget) return true;
  const stored = trip.tags ?? [];
  const edited = parseTags(draft.tags);
  if (stored.length !== edited.length) return true;
  return stored.some((tag, index) => tag !== edited[index]);
}

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
