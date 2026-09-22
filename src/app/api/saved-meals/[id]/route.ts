import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { deleteMealById, getMealById } from '@/lib/services/mealService';
import { timedHttp } from '@/lib/observability/httpMetrics';

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
  return timedHttp('/api/saved-meals/[id]', 'GET', async () => {
    try {
      const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
      const { id } = await params;

      const data = await getMealById(id, userId);

      if (!data) {
        // Not found OR belongs to another user — indistinguishable on purpose.
        return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const DELETE = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
) => {
  return timedHttp('/api/saved-meals/[id]', 'DELETE', async () => {
    try {
      const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
      const { id } = await params;

      // Scope by user_id so a client cannot delete another user's meal.
      const deleted = await deleteMealById(id, userId);

      if (!deleted) {
        return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});