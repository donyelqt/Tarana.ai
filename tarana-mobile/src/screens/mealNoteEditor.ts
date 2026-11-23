import type { MealNote } from '../data/notes';
import { noteDraftError, type NoteDraft } from './mealNoteDraft';

export type NoteEditorPhase = 'idle' | 'editing' | 'saving';

export type NoteEditorModel = {
  open: boolean;
  phase: NoteEditorPhase;
  draft: NoteDraft;
};

export const closedNoteEditor: NoteEditorModel = {
  open: false,
  phase: 'idle',
  draft: { title: '', notes: '' },
};

export type NoteEditorMode = 'hidden' | 'summary' | 'form';

export function noteEditorMode(model: NoteEditorModel, stored: MealNote | null): NoteEditorMode {
  if (model.open) return 'form';
  const hasStored = !!stored && (stored.title?.trim() || stored.notes?.trim());
  return hasStored ? 'summary' : 'hidden';
}

export function noteEditorCaption(phase: NoteEditorPhase): string {
  if (phase === 'saving') return 'Saving…';
  if (phase === 'editing') return 'Save';
  return 'Edit note';
}

export function noteEditorFields(note: MealNote | null): NoteDraft {
  return { title: note?.title ?? '', notes: note?.notes ?? '' };
}

export function noteEditorError(draft: NoteDraft): string | null {
  return noteDraftError(draft);
}