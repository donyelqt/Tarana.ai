import { describe, expect, it } from '@jest/globals';
import { noteDraftFrom, noteDraftError, noteDraftPayload, type NoteDraft } from '../mealNoteDraft';

function draft(over: Partial<NoteDraft> = {}): NoteDraft {
  return { title: '', notes: '', ...over };
}

describe('noteDraftPayload - the wire shape the web PATCH accepts', () => {
  it('sends null for a blank title rather than an empty string', () => {
    expect(noteDraftPayload(draft({ title: '   ', notes: 'Order the short rib' }))).toEqual({
      title: null,
      notes: 'Order the short rib',
    });
  });

  it('sends null for a blank body rather than an empty string', () => {
    expect(noteDraftPayload(draft({ title: 'Lunch', notes: '  ' }))).toEqual({
      title: 'Lunch',
      notes: null,
    });
  });

  it('keeps a body that only differs by surrounding whitespace', () => {
    expect(noteDraftPayload(draft({ title: 'Lunch', notes: '  Order the short rib  ' })).notes).toBe(
      'Order the short rib'
    );
  });

  it('sends both fields when both are written', () => {
    expect(noteDraftPayload(draft({ title: 'Lunch', notes: 'Short rib' }))).toEqual({
      title: 'Lunch',
      notes: 'Short rib',
    });
  });
});

describe('noteDraftError - the limits the web schema enforces', () => {
  it('refuses a title over 200 characters', () => {
    expect(noteDraftError(draft({ title: 'a'.repeat(201) }))).toBe(
      'The nickname can be at most 200 characters.'
    );
  });

  it('allows a title of exactly 200 characters', () => {
    expect(noteDraftError(draft({ title: 'a'.repeat(200) }))).toBeNull();
  });

  it('refuses a note over 5000 characters', () => {
    expect(noteDraftError(draft({ notes: 'a'.repeat(5001) }))).toBe(
      'The note can be at most 5000 characters.'
    );
  });

  it('allows a note of exactly 5000 characters', () => {
    expect(noteDraftError(draft({ notes: 'a'.repeat(5000) }))).toBeNull();
  });

  it('allows an entirely blank draft so a user can clear both fields', () => {
    expect(noteDraftError(draft())).toBeNull();
  });
});

describe('noteDraftFrom - seeding the form from what is stored', () => {
  it('reads a missing note as two empty strings', () => {
    expect(noteDraftFrom(null)).toEqual({ title: '', notes: '' });
  });

  it('reads a stored note into the form', () => {
    expect(noteDraftFrom({ title: 'Lunch', notes: 'Short rib' })).toEqual({
      title: 'Lunch',
      notes: 'Short rib',
    });
  });

  it('reads null columns as empty strings', () => {
    expect(noteDraftFrom({ title: null, notes: null })).toEqual({ title: '', notes: '' });
  });
});