import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

export interface TaranaStats {
  itineraries: number;
  cafes: number;
  meals: number;
  explorers: number;
}

/**
 * Public aggregate counters for the dashboard Tarana Stats widget.
 *
 * No session required — all values are global aggregates, no per-user data.
 * Cafes come from the static restaurant dataset; the rest are exact-count
 * head queries (no rows transferred). Any failing query rejects the whole
 * batch so the widget never renders partial counts.
 */
export async function getStats(): Promise<TaranaStats> {
  const [itineraries, meals, explorers] = await Promise.all([
    supabaseAdmin.from('itineraries').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('saved_meals').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
  ]);

  const failed = [itineraries, meals, explorers].find((r) => r.error);
  if (failed?.error) {
    throw new Error(`Failed to get stats: ${failed.error.message}`);
  }

  return {
    itineraries: itineraries.count ?? 0,
    cafes: restaurants.length,
    meals: meals.count ?? 0,
    explorers: explorers.count ?? 0,
  };
}