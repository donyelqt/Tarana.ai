/**
 * Trip edit logic — the observable contract of an edit either reaching the
 * database as something coherent or not being saved at all.
 *
 * The screen's own wiring cannot be rendered here (this suite is
 * `testEnvironment: 'node'`), and that is exactly where the harmful
 * mistakes live: a blank title written to the row, or a re-save of an
 * untouched form overwriting a concurrent change with the same values.
 *
 * What is pinned here, and why each is a contract rather than a detail:
 * 1. A draft reads a null column as '' — an edit form must never show the
 *    string "null" to a user.
 * 2. A blank title is refused, matching createTrip's own refusal to
 *    fabricate a name, so no edit produces an unnameable row.
 * 3. A whitespace-only title is also refused — `.trim()` on the way out is
 *    not the same as accepting "   ".
 * 4. An untouched draft reports no change, so a save button that appears
 *    for an unedited form cannot write.
 * 5. Each field on its own counts as a change (title/date/budget), because
 *    a per-field comparison that accidentally ORs everything together
 *    would look correct here and still miss a real edit.
 * 6. Tags compare as SETS by order-insensitive equality is NOT claimed
 *    here: reordering tags IS a change, since the row's rendering order is
 *    user-visible. Pinned so nobody "optimizes" it to a set compare.
 * 7. An empty blank field saves as null, not '' — the column is NULL in the
 *    schema and a form-cleared date should not become an empty string.
 * 8. Tags drop their blanks, so "Baguio, , food" is two tags.
 */
import { describe, expect, it } from '@jest/globals';
import {
  draftFromTrip,
  parseTags,
  tripEditChanged,
  tripEditError,
  tripEditPayload,
  type TripEditDraft,
} from '../tripEdit';
import type { LocalTrip } from '../../data';

function trip(over: Partial<LocalTrip> = {}): LocalTrip {
  return {
    id: 't1',
    profile_id: 'p1',
    title: 'Baguio weekend',
    date: '2026-03-04',
    budget: '5000',
    tags: ['Baguio', 'food'],
    payload: null,
    source: 'local',
    source_id: null,
    imported_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function draft(over: Partial<TripEditDraft> = {}): TripEditDraft {
  return {
    title: 'Baguio weekend',
    date: '2026-03-04',
    budget: '5000',
    tags: 'Baguio, food',
    ...over,
  };
}

describe('draftFromTrip — the form never shows a null', () => {
  it('reads a null title/date/budget/tags as empty', () => {
    const d = draftFromTrip(trip({ title: null, date: null, budget: null, tags: [] }));
    expect(d).toEqual({ title: '', date: '', budget: '', tags: '' });
  });

  it('joins tags with a comma so the field is editable as one string', () => {
    expect(draftFromTrip(trip()).tags).toBe('Baguio, food');
  });
});

describe('tripEditError — a blank title never reaches the row', () => {
  it('refuses an empty title', () => {
    expect(tripEditError(draft({ title: '' }))).not.toBeNull();
  });

  it('refuses a whitespace-only title', () => {
    expect(tripEditError(draft({ title: '   ' }))).not.toBeNull();
  });

  it('allows a titled draft', () => {
    expect(tripEditError(draft())).toBeNull();
  });
});

describe('tripEditChanged — only a real edit writes', () => {
  it('reports no change for an untouched draft', () => {
    expect(tripEditChanged(trip(), draft())).toBe(false);
  });

  it('reports a title change', () => {
    expect(tripEditChanged(trip(), draft({ title: 'Baguio long weekend' }))).toBe(true);
  });

  it('reports a date change', () => {
    expect(tripEditChanged(trip(), draft({ date: '2026-04-01' }))).toBe(true);
  });

  it('reports a budget change', () => {
    expect(tripEditChanged(trip(), draft({ budget: '9000' }))).toBe(true);
  });

  it('reports added and removed tags', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio, food, hikes' }))).toBe(true);
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio' }))).toBe(true);
  });

  it('counts a reordered tag list as a change, because row order is visible', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'food, Baguio' }))).toBe(true);
  });

  it('ignores tag whitespace that only came from typing', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio ,  food' }))).toBe(false);
  });
});

describe('tripEditPayload — what a permitted save sends', () => {
  it('clears a blanked field to null, not an empty string', () => {
    const p = tripEditPayload(draft({ date: '', budget: '   ' }));
    expect(p.date).toBeNull();
    expect(p.budget).toBeNull();
  });

  it('trims the title and drops blank tags', () => {
    const p = tripEditPayload(draft({ title: '  Baguio weekend  ', tags: 'Baguio, , food' }));
    expect(p.title).toBe('Baguio weekend');
    expect(p.tags).toEqual(['Baguio', 'food']);
  });
});

describe('parseTags — blanks are not tags', () => {
  it('drops empty and whitespace-only entries', () => {
    expect(parseTags('Baguio, ,  ,food')).toEqual(['Baguio', 'food']);
  });

  it('returns an empty list for a blank field', () => {
    expect(parseTags('')).toEqual([]);
  });
});
