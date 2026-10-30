import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

export interface SavedMealInput {
  cafe_name: string;
  meal_type: string;
  price: number;
  good_for?: string | null;
  location?: string | null;
  image?: string | null;
  tags?: string[];
  menu_items?: unknown[];
}

export class MealDbError extends Error {
  details: string;
  hint?: string;
  code?: string;

  constructor(details: string, hint?: string, code?: string) {
    super(`Failed to fetch saved meals: ${details}`);
    this.name = 'MealDbError';
    this.details = details;
    this.hint = hint;
    this.code = code;
  }
}

export async function listMeals(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('saved_meals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new MealDbError(
      error.message,
      (error as { hint?: string }).hint,
      (error as { code?: string }).code
    );
  }

  return data ?? [];
}

export async function createMeal(userId: string, input: SavedMealInput) {
  const { data, error } = await supabaseAdmin
    .from('saved_meals')
    .insert({
      user_id: userId,
      cafe_name: input.cafe_name,
      meal_type: input.meal_type,
      price: input.price,
      good_for: input.good_for,
      location: input.location,
      image: input.image,
      tags: input.tags,
      menu_items: input.menu_items,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save meal: ${error?.message ?? 'no row returned'}`);
  }

  return data;
}

export async function getMealById(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('saved_meals')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function deleteMealById(id: string, userId: string): Promise<boolean> {
  const { data: deleted, error } = await supabaseAdmin
    .from('saved_meals')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !deleted) {
    return false;
  }

  return true;
}

export interface MealNotesInput {
  title: string | null;
  notes: string | null;
}

export async function updateMealNotes(
  mealId: string,
  userId: string,
  input: MealNotesInput
) {
  const { data, error } = await supabaseAdmin
    .from('saved_meal_notes')
    .upsert({
      meal_id: mealId,
      user_id: userId,
      title: input.title,
      notes: input.notes,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,meal_id',
    })
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export async function getMealNotes(mealId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('saved_meal_notes')
    .select('id, user_id, meal_id, title, notes, created_at, updated_at')
    .eq('meal_id', mealId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
