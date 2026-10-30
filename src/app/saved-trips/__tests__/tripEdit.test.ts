import { describe, expect, it } from '@jest/globals';
import {
  dateRangeFromDraft,
  dateRangeFromRowDate,
  draftFromTrip,
  isoToDate,
  dateToIso,
  MAX_TAGS,
  parseTags,
  rowDateFromDateRange,
  tripEditChanged,
  tripEditError,
  tripEditPayload,
  type TripEditSource,
} from '../tripEdit';

const trip = (over: Partial<TripEditSource> = {}): TripEditSource => ({
  title: 'Baguio Loop',
  date: '2026-03-04',
  budget: '5000',
  tags: ['Baguio', 'food trip'],
  ...over,
});

const formData = (
  over: Partial<{
    budget: string;
    pax: string;
    duration: string;
    dates: { start: string; end: string };
    selectedInterests: string[];
  }> = {}
) => ({
  budget: '5000',
  pax: '2',
  duration: '1 day',
  dates: { start: '2026-03-04', end: '2026-03-04' },
  selectedInterests: ['Culture & Arts'],
  ...over,
});

const manyTags = (count: number): string =>
  Array.from({ length: count }, (_, index) => `tag${index}`).join(', ');

const paddedTags = (count: number = MAX_TAGS): string =>
  Array.from({ length: count }, (_, index) => `tag${index}`)
    .join(', , , ');

describe('draftFromTrip — the form never shows a null', () => {
  it('reads missing columns as empty strings, not the string "null"', () => {
    const draft = draftFromTrip({ title: null, date: undefined, budget: undefined, tags: null });
    expect(draft).toEqual({ title: '', date: '', budget: '', tags: '' });
  });

  it('joins tags for a single comma-separated input', () => {
    expect(draftFromTrip(trip())).toEqual({
      title: 'Baguio Loop',
      date: '2026-03-04',
      budget: '5000',
      tags: 'Baguio, food trip',
    });
  });

  it('seeds the date from formData.dates when the row date is null', () => {
    const draft = draftFromTrip({
      title: 'Baguio Loop',
      date: null,
      budget: '5000',
      tags: ['Baguio'],
      formData: { dates: { start: '2026-03-04T00:00:00.000Z', end: '2026-03-05T00:00:00.000Z' } },
    });
    const range = dateRangeFromRowDate(draft.date);
    expect(range).toEqual({ start: '2026-03-04', end: '2026-03-05' });
  });

  it('prefers a row date pair over formData.dates', () => {
    const draft = draftFromTrip({
      title: 'Baguio Loop',
      date: '2026-03-10 - 2026-03-12',
      budget: '',
      tags: [],
      formData: { dates: { start: '2026-03-04T00:00:00.000Z', end: '2026-03-05T00:00:00.000Z' } },
    });
    expect(draft.date).toBe('2026-03-10 - 2026-03-12');
  });

  it('leaves the date blank when both the row and formData dates are missing', () => {
    expect(draftFromTrip({ title: 'T', date: null, budget: '', tags: [] }).date).toBe('');
    expect(
      draftFromTrip({
        title: 'T',
        date: '',
        budget: '',
        tags: [],
        formData: { dates: { start: '', end: '' } },
      }).date
    ).toBe('');
  });
});

describe('tripEditError — a blank title never reaches the row', () => {
  it('refuses an empty title', () => {
    expect(tripEditError({ title: '', date: '', budget: '', tags: '' })).toBe(
      'Give the trip a title before saving.'
    );
  });

  it('refuses a whitespace-only title', () => {
    expect(tripEditError({ title: '   ', date: '', budget: '', tags: '' })).toBe(
      'Give the trip a title before saving.'
    );
  });

  it('allows a non-blank title with either date or budget present', () => {
    expect(tripEditError({ title: 'Trip', date: '', budget: '5000', tags: '' })).toBeNull();
    expect(tripEditError({ title: 'Trip', date: '2026-03-04', budget: '', tags: '' })).toBeNull();
  });

  it('allows clearing both date and budget together', () => {
    expect(tripEditError({ title: 'Trip', date: '', budget: '', tags: '' })).toBeNull();
  });

  it('allows exactly MAX_TAGS tags, and refuses the next one', () => {
    expect(tripEditError({ title: 'Trip', date: '', budget: '', tags: manyTags(MAX_TAGS) })).toBeNull();
    expect(tripEditError({ title: 'Trip', date: '', budget: '', tags: manyTags(MAX_TAGS + 1) })).toBe(
      `A trip can hold at most ${MAX_TAGS} tags.`
    );
  });

  it('does not count blank tag segments toward the cap', () => {
    expect(tripEditError({ title: 'Trip', date: '', budget: '', tags: manyTags(MAX_TAGS + 10) })).toBe(
      `A trip can hold at most ${MAX_TAGS} tags.`
    );
    expect(tripEditError({ title: 'Trip', date: '', budget: '', tags: paddedTags() })).toBeNull();
  });

  it('reports a blank title before an over-limit tag list', () => {
    expect(tripEditError({ title: '   ', date: '', budget: '', tags: manyTags(MAX_TAGS + 1) })).toBe(
      'Give the trip a title before saving.'
    );
  });
});

describe('tripEditChanged — only a real edit writes', () => {
  const draft = { title: 'Baguio Loop', date: '2026-03-04', budget: '5000', tags: 'Baguio, food trip' };

  it('reports no change for an untouched draft', () => {
    expect(tripEditChanged(trip(), draft)).toBe(false);
  });

  it('counts a title edit alone', () => {
    expect(tripEditChanged(trip(), { ...draft, title: 'Baguio Loop v2' })).toBe(true);
  });

  it('counts a date edit alone', () => {
    expect(tripEditChanged(trip(), { ...draft, date: '2026-03-05' })).toBe(true);
  });

  it('counts a budget edit alone', () => {
    expect(tripEditChanged(trip(), { ...draft, budget: '9000' })).toBe(true);
  });

  it('counts reordering tags, because the row order is what renders', () => {
    expect(tripEditChanged(trip(), { ...draft, tags: 'food trip, Baguio' })).toBe(true);
  });

  it('does not count tag whitespace typing as a change', () => {
    expect(tripEditChanged(trip(), { ...draft, tags: 'Baguio,  food trip' })).toBe(false);
  });

  it('counts removing a tag', () => {
    expect(tripEditChanged(trip(), { ...draft, tags: 'Baguio' })).toBe(true);
  });

  it('still counts a title, date or budget edit when tags differ too', () => {
    expect(tripEditChanged(trip(), { ...draft, title: 'v2', tags: 'food trip' })).toBe(true);
    expect(tripEditChanged(trip(), { ...draft, date: '2026-03-05', tags: 'food trip' })).toBe(true);
    expect(tripEditChanged(trip(), { ...draft, budget: '9000', tags: 'food trip' })).toBe(true);
  });

  it('does not count seeding from formData as a change when the row date is null', () => {
    const source: TripEditSource = {
      title: 'Baguio Loop',
      date: null,
      budget: '5000',
      tags: ['Baguio'],
      formData: { dates: { start: '2026-03-04T00:00:00.000Z', end: '2026-03-05T00:00:00.000Z' } },
    };
    const seeded = draftFromTrip(source);
    expect(tripEditChanged(source, seeded)).toBe(false);
  });
});

describe('tripEditPayload — what a permitted save sends', () => {
  it('trims the title', () => {
    expect(
      tripEditPayload(
        { title: '  Baguio Loop  ', date: '', budget: '', tags: '' },
        { dates: { start: '', end: '' }, formData: formData() }
      ).title
    ).toBe('Baguio Loop');
  });

  it('writes a blank date as null, not an empty string', () => {
    expect(
      tripEditPayload(
        { title: 'T', date: '', budget: '', tags: '' },
        { dates: { start: '', end: '' }, formData: formData() }
      ).date
    ).toBeNull();
  });

  it('writes a blank budget as null, not an empty string', () => {
    expect(
      tripEditPayload(
        { title: 'T', date: '', budget: '', tags: '' },
        { dates: { start: '', end: '' }, formData: formData() }
      ).budget
    ).toBeNull();
  });

  it('keeps a supplied date and budget, trimmed', () => {
    const payload = tripEditPayload(
      { title: 'T', date: ' 2026-03-04 ', budget: ' 5000 ', tags: '' },
      { dates: { start: '', end: '' }, formData: formData() }
    );
    expect(payload.date).toBe('2026-03-04');
    expect(payload.budget).toBe('5000');
  });

  it('keeps a supplied budget and drops a blank one, independently', () => {
    const payload = tripEditPayload(
      {
        title: 'T',
        date: '',
        budget: ' 5000 ',
        tags: 'Baguio',
      },
      { dates: { start: '', end: '' }, formData: formData() }
    );
    expect(payload.budget).toBe('5000');
    expect(payload.date).toBeNull();
    expect(payload.tags).toEqual(['Baguio']);
  });

  it('carries tags the generator wrote but the detail page has no icon for', () => {
    const payload = tripEditPayload(
      {
        title: 'T',
        date: '',
        budget: '',
        tags: 'Nature & Scenery, Weather-Flexible, food trip',
      },
      { dates: { start: '', end: '' }, formData: formData() }
    );
    expect(payload.tags).toEqual(['Nature & Scenery', 'Weather-Flexible', 'food trip']);
  });

  it('writes the date pair into formData.dates', () => {
    const payload = tripEditPayload(
      { title: 'T', date: '2026-03-04', budget: '5000', tags: '' },
      {
        dates: { start: '2026-03-04', end: '2026-03-06' },
        formData: formData({ dates: { start: '2026-02-01', end: '2026-02-01' } }),
      }
    );
    expect(payload.formData.dates.start).toBe('2026-03-04');
    expect(payload.formData.dates.end).toBe('2026-03-06');
  });

  it('keeps the rest of formData untouched when the dates change', () => {
    const payload = tripEditPayload(
      { title: 'T', date: '2026-03-04', budget: '5000', tags: '' },
      { dates: { start: '2026-03-04', end: '2026-03-06' }, formData: formData() }
    );
    expect(payload.formData.budget).toBe('5000');
    expect(payload.formData.pax).toBe('2');
    expect(payload.formData.duration).toBe('1 day');
    expect(payload.formData.selectedInterests).toEqual(['Culture & Arts']);
  });

  it('clears formData.dates to an empty pair when the range is empty', () => {
    const payload = tripEditPayload(
      { title: 'T', date: '', budget: '', tags: '' },
      { dates: { start: '', end: '' }, formData: formData() }
    );
    expect(payload.formData.dates).toEqual({ start: '', end: '' });
  });
});

describe('dateToIso / isoToDate — ISO date conversion', () => {
  it('round-trips a date through the ISO form', () => {
    const d = new Date(2026, 2, 4);
    expect(dateToIso(d)).toBe('2026-03-04');
    expect(isoToDate('2026-03-04')).toEqual(new Date(2026, 2, 4));
  });

  it('rejects a malformed ISO token', () => {
    expect(isoToDate('not a date')).toBeNull();
    expect(isoToDate('2026-13-01')).not.toBeNull();
  });

  it('parses a full ISO datetime string to its date part', () => {
    const parsed = isoToDate('2026-03-04T00:00:00.000Z');
    expect(parsed).not.toBeNull();
    expect(dateToIso(parsed!)).toBe('2026-03-04');
  });
});

describe('dateRangeFromRowDate — the pair the form seeds from the row', () => {
  const written = `${new Date(2026, 2, 4).toLocaleDateString()} - ${new Date(
    2026,
    2,
    5
  ).toLocaleDateString()}`;

  it('seeds a range from a generator-written locale pair', () => {
    expect(dateRangeFromRowDate(written)).toEqual({
      start: '2026-03-04',
      end: '2026-03-05',
    });
  });

  it("seeds nothing from the generator's own 'Date not specified' literal", () => {
    expect(dateRangeFromRowDate('Date not specified')).toEqual({ start: '', end: '' });
  });

  it('seeds nothing from a null or empty column', () => {
    expect(dateRangeFromRowDate(null)).toEqual({ start: '', end: '' });
    expect(dateRangeFromRowDate(undefined)).toEqual({ start: '', end: '' });
    expect(dateRangeFromRowDate('')).toEqual({ start: '', end: '' });
  });

  it('seeds nothing from a token no field order can reproduce', () => {
    expect(dateRangeFromRowDate('not a date')).toEqual({ start: '', end: '' });
  });

  it('folds a lone date into a one-day range instead of dropping it', () => {
    expect(dateRangeFromRowDate(new Date(2026, 2, 4).toLocaleDateString())).toEqual({
      start: '2026-03-04',
      end: '2026-03-04',
    });
  });

  it('is symmetric: a pair writes and re-reads to the same pair', () => {
    const range = dateRangeFromRowDate(written);
    expect(rowDateFromDateRange(range)).toBe(written);
    expect(dateRangeFromRowDate(rowDateFromDateRange(range))).toEqual(range);
  });

  it('writes null for an empty or one-sided pair', () => {
    expect(rowDateFromDateRange({ start: '', end: '' })).toBeNull();
    expect(rowDateFromDateRange({ start: '2026-03-04', end: '' })).toBeNull();
    expect(rowDateFromDateRange({ start: '', end: '2026-03-04' })).toBeNull();
  });
});

describe('tripEditChanged — the date compares in pair space', () => {
  const draft = { title: 'Baguio Loop', date: '2026-03-04 - 2026-03-05', budget: '5000', tags: 'Baguio, food trip' };

  it('does not count reformatting a stored pair as a change', () => {
    expect(
      tripEditChanged(
        { ...trip(), date: `${new Date(2026, 2, 4).toLocaleDateString()} - ${new Date(
          2026,
          2,
          5
        ).toLocaleDateString()}` },
        draft
      )
    ).toBe(false);
  });

  it('counts moving the end date alone', () => {
    expect(
      tripEditChanged(
        { ...trip(), date: `${new Date(2026, 2, 4).toLocaleDateString()} - ${new Date(
          2026,
          2,
          5
        ).toLocaleDateString()}` },
        { ...draft, date: '2026-03-04 - 2026-03-06' }
      )
    ).toBe(true);
  });
});

describe('parseTags — blanks are not tags', () => {
  it('drops the empty segment between commas', () => {
    expect(parseTags('Baguio, , food trip')).toEqual(['Baguio', 'food trip']);
  });

  it('returns an empty list for whitespace only', () => {
    expect(parseTags('   ')).toEqual([]);
  });

  it('trims each tag', () => {
    expect(parseTags(' Baguio ,  food trip ')).toEqual(['Baguio', 'food trip']);
  });
});
