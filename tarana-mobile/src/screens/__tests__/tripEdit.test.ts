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
    endDate: '2026-03-04',
    budget: '5000',
    tags: 'Baguio, food',
    ...over,
  };
}

describe('draftFromTrip — the form never shows a null', () => {
  it('reads a null title/date/budget/tags as empty', () => {
    const d = draftFromTrip(trip({ title: null, date: null, budget: null, tags: [], payload: null }));
    expect(d).toEqual({ title: '', date: '', endDate: '', budget: '', tags: '' });
  });

  it('joins tags with a comma so the field is editable as one string', () => {
    expect(draftFromTrip(trip()).tags).toBe('Baguio, food');
  });

  it('seeds endDate from the payload formData.dates.end', () => {
    const d = draftFromTrip(
      trip({ payload: JSON.stringify({ formData: { dates: { start: '2026-03-04', end: '2026-03-06' } } }) })
    );
    expect(d.endDate).toBe('2026-03-06');
  });

  it('seeds endDate as empty when the payload has no dates', () => {
    const d = draftFromTrip(trip({ payload: '{"formData":{}}' }));
    expect(d.endDate).toBe('');
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
    expect(tripEditChanged(trip(), draft({ endDate: '' }))).toBe(false);
  });

  it('reports a title change', () => {
    expect(tripEditChanged(trip(), draft({ title: 'Baguio long weekend', endDate: '' }))).toBe(true);
  });

  it('reports a date change', () => {
    expect(tripEditChanged(trip(), draft({ date: '2026-04-01', endDate: '' }))).toBe(true);
  });

  it('reports an end-date change', () => {
    expect(tripEditChanged(trip({ payload: '{"formData":{"dates":{"start":"2026-03-04","end":"2026-03-04"}}}' }), draft({ endDate: '' }))).toBe(true);
  });

  it('reports a budget change', () => {
    expect(tripEditChanged(trip(), draft({ budget: '9000', endDate: '' }))).toBe(true);
  });

  it('reports added and removed tags', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio, food, hikes', endDate: '' }))).toBe(true);
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio', endDate: '' }))).toBe(true);
  });

  it('reports no change when endDate matches the payload', () => {
    const t = trip({ payload: '{"formData":{"dates":{"start":"2026-03-04","end":"2026-03-04"}}}' });
    expect(tripEditChanged(t, draft({ endDate: '2026-03-04' }))).toBe(false);
  });
  it('counts a reordered tag list as a change, because row order is visible', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'food, Baguio', endDate: '' }))).toBe(true);
  });

  it('ignores tag whitespace that only came from typing', () => {
    expect(tripEditChanged(trip(), draft({ tags: 'Baguio ,  food', endDate: '' }))).toBe(false);
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

describe('tripEditPayload — dates land in formData.dates', () => {
  it('writes the draft start and end into formData.dates', () => {
    const p = tripEditPayload(
      draft({ date: '2026-03-10', endDate: '2026-03-12' }),
      {
        payload: JSON.stringify({
          formData: { dates: { start: '2026-03-04', end: '2026-03-04' } },
        }),
      }
    );
    expect(p.date).toBe('2026-03-10');
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.start).toBe('2026-03-10');
    expect(parsed.formData.dates.end).toBe('2026-03-12');
  });

  it('writes a same-day end when start and end match', () => {
    const p = tripEditPayload(
      draft({ date: '2026-03-10', endDate: '2026-03-10' }),
      {
        payload: JSON.stringify({
          formData: { dates: { start: '2026-03-04', end: '2026-03-04' } },
        }),
      }
    );
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.end).toBe('2026-03-10');
  });

  it('clears the dates pair when the start is cleared', () => {
    const p = tripEditPayload(
      draft({ date: '', endDate: '' }),
      {
        payload: JSON.stringify({
          formData: { dates: { start: '2026-03-10', end: '2026-03-12' } },
        }),
      }
    );
    expect(p.date).toBeNull();
    const parsed = JSON.parse(p.payload!);
    expect(parsed.formData.dates.start).toBe('');
    expect(parsed.formData.dates.end).toBe('');
  });

  it('leaves the payload untouched when endDate is blank but start is set', () => {
    const raw = JSON.stringify({ formData: { dates: { start: '2026-03-04', end: '2026-03-04' } } });
    const p = tripEditPayload(
      draft({ date: '2026-03-10', endDate: '' }),
      { payload: raw }
    );
    expect(p.payload).toBe(raw);
  });
});
