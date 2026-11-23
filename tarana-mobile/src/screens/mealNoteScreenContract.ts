import { getMealNote, saveMealNote, type MealNote } from '../data/notes';
import { noteDraftPayload } from './mealNoteDraft';

export async function loadMealNote(mealId: string): Promise<MealNote | null> {
  return getMealNote(mealId);
}

export async function saveMealNoteFor(mealId: string, draft: { title: string; notes: string }): Promise<MealNote | null> {
  return saveMealNote(mealId, noteDraftPayload(draft));
}