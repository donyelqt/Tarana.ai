import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * Single saved-meal access — session-scoped.
 *
 * RLS remediation 2026-09-19: the old client path (supabaseMeals.ts via the
 * anon key) filtered by id ONLY with no user_id, an authorization hole. The
 * server derives identity from the NextAuth session cookie and scopes every
 * query to session.user.id with the service-role admin client. A client can
 * never read or delete another user's meal by guessing an id.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('saved_meals')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      // Not found OR belongs to another user — indistinguishable on purpose.
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching meal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Scope by user_id so a client cannot delete another user's meal.
    const { data: deleted, error } = await supabaseAdmin
      .from('saved_meals')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id')
      .single();

    if (error || !deleted) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}