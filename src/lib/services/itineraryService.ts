import type { z } from 'zod';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import type { SaveItinerarySchema } from '@/lib/data/itineraryMapper';

export type SaveItineraryInput = z.infer<typeof SaveItinerarySchema>;

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
