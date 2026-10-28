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
 * 6. Reordering tags IS a change: the row's rendering order is user-visible,
 *    so nobody "optimizes" this into a set compare.
 * 7. A blanked date or budget saves as null, not '' — the columns are nullable
 *    and a cleared field should be absent, not an empty string.
 * 8. Blanks are not tags: "Baguio, , food" is two.
 */
import { describe, expect, it } from '@jest/globals';
import {
  draftFromTrip,
  MAX_TAGS,
  parseTags,
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
    // Both columns are nullable text and mobile preserves NULLs losslessly
    // (`tarana-mobile/src/data/index.ts:132-133`); the renderers fall back to a
    // placeholder, so a cleared value is not a broken row.
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
