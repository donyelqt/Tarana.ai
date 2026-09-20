import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

export interface SavedMealInput {
  cafe_name: string;
  meal_type: string;
  price: number;
  good_for?: string;
  location?: string;
  image?: string;
  tags?: string[];
  menu_items?: unknown[];
}

/**
 * Thrown when Supabase reports an error on the list path. Carries the raw
 * provider details so the route can preserve its existing error wire shape
 * (`details`/`hint`/`code`) without touching the database itself.
 */
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

/**
 * List the caller's saved meals, newest first.
 *
 * The route owns auth (withAuth) and the HTTP shape; this service owns the
 * DB read so the route can be unit-tested by mocking one function instead
 * of the whole Supabase client chain.
 */
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

/**
 * Insert a validated meal row for the caller. Input is validated by the
 * route's Zod schema before it reaches here. Throws on DB error — the route
 * maps that to its 500 response.
 */
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

/**
 * Fetch one meal scoped to the caller. Returns null when absent — the route
 * treats that as 404, indistinguishable from another user's row (the RLS
 * remediation 2026-09-19 deliberately leaks nothing here).
 */
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

/**
 * Delete one meal scoped to the caller. Returns true when a row was deleted,
 * false otherwise (route maps false to 404).
 */
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
