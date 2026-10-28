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
  endDateForDuration,
  deriveEndDate,
  durationDays,
  dateToIso,
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


describe('durationDays — reads a leading integer from a duration label', () => {
  it('parses "1 day" as 1', () => {
    expect(durationDays('1 day')).toBe(1);
  });

  it('parses "3 Days" as 3', () => {
    expect(durationDays('3 Days')).toBe(3);
  });

  it('returns null for a label with no number', () => {
    expect(durationDays('Weekend')).toBeNull();
  });
});

describe('endDateForDuration — the single source of truth for end-date derivation', () => {
  it('ends on the same day for a 1-day trip', () => {
    const start = new Date(2026, 2, 10);
    const end = endDateForDuration(start, '1 day');
    expect(end).toBeInstanceOf(Date);
    expect(dateToIso(end!)).toBe('2026-03-10');
  });

  it('ends one day later for a 2-day trip', () => {
    const start = new Date(2026, 2, 10);
    const end = endDateForDuration(start, '2 Days');
    expect(dateToIso(end!)).toBe('2026-03-11');
  });

  it('ends three days later for a 3-day trip', () => {
    const start = new Date(2026, 2, 10);
    const end = endDateForDuration(start, '3 Days');
    expect(dateToIso(end!)).toBe('2026-03-12');
  });

  it('returns undefined when there is no start', () => {
    expect(endDateForDuration(undefined, '3 Days')).toBeUndefined();
  });

  it('returns undefined when the duration has no number', () => {
    expect(endDateForDuration(new Date(2026, 2, 10), 'Weekend')).toBeUndefined();
  });
});

describe('deriveEndDate — end-date derivation for the edit form', () => {
  it('derives a same-day end for a 1-day trip', () => {
    expect(deriveEndDate('2026-03-10', '1 day')).toBe('2026-03-10');
  });

  it('derives a 3-day end from start + duration', () => {
    expect(deriveEndDate('2026-03-10', '3 Days')).toBe('2026-03-12');
  });

  it('returns null when the start is missing', () => {
    expect(deriveEndDate(null, '3 Days')).toBeNull();
  });

  it('returns null when the duration has no number', () => {
    expect(deriveEndDate('2026-03-10', 'Weekend')).toBeNull();
  });
});

describe('tripEditPayload — auto-derived end date lands in the payload', () => {
  it('derives the end date and writes it into formData.dates', () => {
    const p = tripEditPayload(draft({ date: '2026-03-10' }), {
      duration: '3 Days',
      payload: JSON.stringify({
        formData: { dates: { start: '2026-03-04', end: '2026-03-04' } },
      }),
    });
    expect(p.date).toBe('2026-03-10');
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.start).toBe('2026-03-10');
    expect(parsed.formData.dates.end).toBe('2026-03-12');
  });

  it('derives a same-day end for a 1-day trip', () => {
    const p = tripEditPayload(draft({ date: '2026-03-10' }), {
      duration: '1 day',
      payload: JSON.stringify({
        formData: { dates: { start: '2026-03-04', end: '2026-03-04' } },
      }),
    });
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.end).toBe('2026-03-10');
  });

  it('clears the dates pair when the start is cleared', () => {
    const p = tripEditPayload(draft({ date: '' }), {
      duration: '3 Days',
      payload: JSON.stringify({
        formData: { dates: { start: '2026-03-10', end: '2026-03-12' } },
      }),
    });
    expect(p.date).toBeNull();
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.start).toBe('');
    expect(parsed.formData.dates.end).toBe('');
  });

  it('returns the original payload when duration is missing', () => {
    const raw = JSON.stringify({ formData: { duration: null } });
    const p = tripEditPayload(draft({ date: '2026-03-10' }), {
      duration: null,
      payload: raw,
    });
    expect(p.payload).toBe(raw);
  });
});
