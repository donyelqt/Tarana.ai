import type { z } from 'zod';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import type { SaveItinerarySchema } from '@/lib/data/itineraryMapper';

export type SaveItineraryInput = z.infer<typeof SaveItinerarySchema>;

/**
 * List the caller's itineraries, newest first. Returns raw rows — the route
 * maps them to the wire shape via `mapRowToSavedItinerary`. Throws on DB
 * error; the route maps that to its 500 response.
 *
 * The route owns auth (withAuth), validation, and the HTTP shape; this
 * service owns the DB access so the route can be unit-tested by mocking one
 * function instead of the whole Supabase client chain.
 */
export async function listItineraries(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch itineraries: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Insert a validated itinerary for the caller. The image is resolved by the
 * route (it needs the request's tags) and passed in. Returns the raw row.
 * Throws on DB error — the route maps that to its 500 response.
 */
export async function createItinerary(
  userId: string,
  input: SaveItineraryInput,
  image: string
) {
  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .insert({
      user_id: userId,
      title: input.title,
      date: input.date,
      budget: input.budget,
      image,
      tags: input.tags,
      form_data: input.formData,
      itinerary_data: input.itineraryData,
      weather_data: input.weatherData ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to save itinerary: ${error?.message ?? 'no row returned'}`);
  }

  return data;
}

/**
 * Fetch one itinerary scoped to the caller. Returns null when absent — the
 * route treats that as 404, indistinguishable from another user's row.
 */
export async function getItineraryById(id: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('itineraries')
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
 * Partial-update one itinerary scoped to the caller. The payload is built by
 * the route from the validated PATCH body (see `toDbPayload` — explicit null
 * clears a field, absent keys are untouched). Returns null when the row is
 * missing or not owned; the route maps that to 404.
 */
export async function updateItineraryById(
  id: string,
  userId: string,
  payload: Record<string, unknown>
) {
  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Delete one itinerary scoped to the caller. Returns true when a row was
 * deleted, false otherwise (route maps false to 404).
 */
export async function deleteItineraryById(id: string, userId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('itineraries')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}
