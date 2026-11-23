import { describe, expect, it } from '@jest/globals';
import { mealNoteSummary, noteSavingLabel } from '../mealNoteCard';

describe('mealNoteSummary - the note surface in the saved meals list', () => {
  it('shows nothing when there is no note', () => {
    expect(mealNoteSummary(null)).toBeNull();
    expect(mealNoteSummary({ title: null, notes: null })).toBeNull();
    expect(mealNoteSummary({ title: '   ', notes: '' })).toBeNull();
  });

  it('leads with the nickname when one is written', () => {
    expect(mealNoteSummary({ title: 'Lunch spot', notes: 'Order the short rib' })).toBe('Lunch spot');
  });

  it('falls back to the body when only a body is written', () => {
    expect(mealNoteSummary({ title: null, notes: 'Order the short rib' })).toBe('Order the short rib');
  });

  it('collapses a multi-line body into one scannable line', () => {
    expect(mealNoteSummary({ title: null, notes: 'First line\nSecond line' })).toBe('First line Second line');
  });

  it('trims surrounding whitespace before it reaches the row', () => {
    expect(mealNoteSummary({ title: '  Lunch  ', notes: null })).toBe('Lunch');
  });
});

describe('noteSavingLabel - what the action reports while it runs', () => {
  it('reports idle as an enabled action', () => {
    expect(noteSavingLabel('idle')).toBe('Edit note');
  });

  it('reports a running save in the same voice as the trip editor', () => {
    expect(noteSavingLabel('saving')).toBe('Saving…');
  });
});