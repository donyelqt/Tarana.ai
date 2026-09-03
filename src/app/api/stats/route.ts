import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { restaurants } from '@/app/tarana-eats/data/taranaEatsData';

/**
 * GET /api/stats
 * Public aggregate counters for the dashboard Tarana Stats widget.
 * No session required — all values are global aggregates, no per-user data.
 * Cafes come from the static restaurant dataset; the rest are exact-count
 * head queries (no rows transferred).
 */
export async function GET() {
  try {
    const [itineraries, meals, explorers] = await Promise.all([
      supabaseAdmin.from('itineraries').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('saved_meals').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    ]);

    const failed = [itineraries, meals, explorers].find((r) => r.error);
    if (failed?.error) {
      console.error('Error fetching Tarana stats:', failed.error);
      return NextResponse.json(
        { error: 'Failed to get stats' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: {
        itineraries: itineraries.count ?? 0,
        cafes: restaurants.length,
        meals: meals.count ?? 0,
        explorers: explorers.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Error in /api/stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
