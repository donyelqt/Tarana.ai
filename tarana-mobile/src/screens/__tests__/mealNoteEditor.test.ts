import { describe, expect, it } from '@jest/globals';
import {
  noteEditorCaption,
  noteEditorError,
  noteEditorFields,
  noteEditorMode,
  type NoteEditorModel,
} from '../mealNoteEditor';
import { noteDraftPayload } from '../mealNoteDraft';
import type { MealNote } from '../../data/notes';

const saved: MealNote = { title: 'Lunch spot', notes: 'Order the short rib' };

const closed: NoteEditorModel = { open: false, phase: 'idle', draft: { title: '', notes: '' } };

describe('noteEditorMode - what the row shows when the editor is shut', () => {
  it('shows the stored note as a read-only summary', () => {
    expect(noteEditorMode(closed, saved)).toBe('summary');
  });

  it('shows no note section at all when nothing is stored', () => {
    expect(noteEditorMode({ ...closed, draft: { title: '', notes: '' } }, null)).toBe('hidden');
  });
});

describe('noteEditorCaption - the action label on the row', () => {
  it('says Edit note when idle', () => {
    expect(noteEditorCaption('idle')).toBe('Edit note');
  });

  it('says Saving in the same voice as the trip editor', () => {
    expect(noteEditorCaption('saving')).toBe('Saving…');
  });

  it('says Save when the form is open', () => {
    expect(noteEditorCaption('editing')).toBe('Save');
  });
});

describe('noteEditorFields - what the form renders', () => {
  it('seeds an empty form when nothing is stored', () => {
    expect(noteEditorFields(null)).toEqual({ title: '', notes: '' });
  });

  it('seeds the form from the stored note', () => {
    expect(noteEditorFields(saved)).toEqual({ title: 'Lunch spot', notes: 'Order the short rib' });
  });

  it('seeds empty strings from null columns', () => {
    expect(noteEditorFields({ title: null, notes: null })).toEqual({ title: '', notes: '' });
  });
});

describe('noteEditorError - the message the row shows', () => {
  it('shows nothing when the draft is valid', () => {
    expect(noteEditorError({ title: 'Lunch', notes: 'Short rib' })).toBeNull();
  });

  it('shows nothing for an untouched draft so a user can clear a note', () => {
    expect(noteEditorError({ title: '', notes: '' })).toBeNull();
  });

  it('surfaces a refused nickname limit', () => {
    expect(noteEditorError({ title: 'a'.repeat(201), notes: '' })).toBe(
      'The nickname can be at most 200 characters.'
    );
  });

  it('surfaces a refused note limit', () => {
    expect(noteEditorError({ title: '', notes: 'a'.repeat(5001) })).toBe(
      'The note can be at most 5000 characters.'
    );
  });
});

describe('the save payload the editor hands the sync client', () => {
  it('trims the fields and nulls the blanks', () => {
    expect(noteDraftPayload({ title: '  Lunch  ', notes: '  ' })).toEqual({
      title: 'Lunch',
      notes: null,
    });
  });

  it('clears both fields to null, which is how a note is deleted', () => {
    expect(noteDraftPayload({ title: '', notes: '' })).toEqual({ title: null, notes: null });
  });
});