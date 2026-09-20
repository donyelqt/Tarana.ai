import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
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

export const GET = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
) => {
  try {
    const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('saved_meals')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      // Not found OR belongs to another user — indistinguishable on purpose.
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, request);
  }
});

export const DELETE = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
) => {
  try {
    const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
    const { id } = await params;

    // Scope by user_id so a client cannot delete another user's meal.
    const { data: deleted, error } = await supabaseAdmin
      .from('saved_meals')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !deleted) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, request);
  }
});