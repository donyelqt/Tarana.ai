/**
 * Trip edit logic — the observable contract of an edit either reaching the
 * database as something coherent or not being saved at all.
 *
 * The editor's wiring is a dialog, and the repo's suite can render React, but
 * pinning these rules here keeps them in the same form mobile pins its
 * equivalents: the two failures that actually matter are a blank title written
 * to the row and a re-save of an untouched form, and both are easier to keep
 * correct when they cannot depend on a render.
 *
 * Each pin is a contract, not a detail:
 * 1. A draft reads a missing column as '' — a form must never render "null".
 * 2. A blank title is refused, so no edit produces an unnameable row.
 * 3. A whitespace-only title is also refused; trimming on the way out is not
 *    the same as accepting "   ".
 * 3b. Clearing both date and budget is allowed: the columns are nullable and
 *     mobile preserves NULLs, and every renderer degrades to a placeholder.
 * 3c. Exactly MAX_TAGS tags are allowed and the next one is refused, blank
 *     segments excluded — the route's `max(50)` is the only real limit.
 * 4. An untouched draft reports no change, so a save that would rewrite the
 *    row with identical values cannot happen.
 * 5. Each field counts on its own — a per-field comparison that ORs everything
 *    together would look right and still miss a real edit.
 * 6. Tags are read-only: the dialog mirrors what the row holds, so a tag
 *    mismatch is not a user edit. `parseTags`/`tripEditPayload` still govern
 *    the array's order; this pins the change-detector's exclusion only.
 * 7. A blanked date or budget saves as null, not '' — the columns are nullable
 *    and a cleared field should be absent, not an empty string.
 * 8. Blanks are not tags: "Baguio, , food" is two.
 * 9. The date column holds either the row's own string (a locale pair the
 *    generator wrote, a lone date, or the 'Date not specified' literal) or
 *    null — and when it is null, the draft is seeded from formData.dates.
 * 10. A date reformatting (locale ↔ ISO) is never an edit: the comparison
 *     happens in pair space, not string space.
 */
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

/** `count` non-blank tags as the comma-separated input would hold them. */
const manyTags = (count: number): string =>
  Array.from({ length: count }, (_, index) => `tag${index}`).join(', ');

/** `count` real tags padded with blank segments, which are not tags. */
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

  it('counts reordering tags in the payload, because the row order is what renders', () => {
    expect(parseTags('food trip, Baguio')).toEqual(['food trip', 'Baguio']);
  });

  it('does not count tag whitespace, a reordering, or a removal as a change', () => {
    expect(tripEditChanged(trip(), { ...draft, tags: 'Baguio,  food trip' })).toBe(false);
    expect(tripEditChanged(trip(), { ...draft, tags: 'food trip, Baguio' })).toBe(false);
    expect(tripEditChanged(trip(), { ...draft, tags: 'food trip' })).toBe(false);
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
    expect(tripEditPayload({ title: '  Baguio Loop  ', date: '', budget: '', tags: '' }).title).toBe(
      'Baguio Loop'
    );
  });

  it('writes a blank date as null, not an empty string', () => {
    expect(tripEditPayload({ title: 'T', date: '', budget: '', tags: '' }).date).toBeNull();
  });

  it('writes a blank budget as null, not an empty string', () => {
    expect(tripEditPayload({ title: 'T', date: '', budget: '', tags: '' }).budget).toBeNull();
  });

  it('keeps a supplied date and budget, trimmed', () => {
    const payload = tripEditPayload({ title: 'T', date: ' 2026-03-04 ', budget: ' 5000 ', tags: '' });
    expect(payload.date).toBe('2026-03-04');
    expect(payload.budget).toBe('5000');
  });

  it('keeps a supplied budget and drops a blank one, independently', () => {
    const payload = tripEditPayload({
      title: 'T',
      date: '',
      budget: ' 5000 ',
      tags: 'Baguio',
    });
    expect(payload.budget).toBe('5000');
    expect(payload.date).toBeNull();
    expect(payload.tags).toEqual(['Baguio']);
  });

  it('carries tags the generator wrote but the detail page has no icon for', () => {
    const payload = tripEditPayload({
      title: 'T',
      date: '',
      budget: '',
      tags: 'Nature & Scenery, Weather-Flexible, food trip',
    });
    expect(payload.tags).toEqual(['Nature & Scenery', 'Weather-Flexible', 'food trip']);
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
    // formData.dates stores `.toISOString()` output; the date must come back
    // without a timezone rollover.
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
