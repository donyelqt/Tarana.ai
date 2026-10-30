import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from '@/lib/services/idempotencyService';
import { deleteMealById, getMealById, getMealNotes, updateMealNotes, type MealNotesInput } from '@/lib/services/mealService';
import { z } from 'zod';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * PATCH body for saved-meal notes. Both fields are optional and nullable:
 * null clears the field, absent keys are left untouched on the row.
 */
const UpdateMealNotesSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
}).strict()

const IDEMPOTENCY_ROUTE = '/api/saved-meals/[id]';
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

      // Fetch the caller's notes row separately — it may be null (not written
      // yet), which is a valid state, not a 404.
      const notes = await getMealNotes(id, userId);

      return NextResponse.json({ success: true, data, notes });
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

      // A retried DELETE must not delete twice. Claim the key before the
      // mutation so a client retry gets the cached response instead of a
      // second deleteMealById call — which would return 404 after the
      // first one already succeeded.
      const key = getIdempotencyKey(request);
      const claim = key
        ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload({ id }))
        : null;

      if (claim?.kind === 'replay') {
        return NextResponse.json(claim.replay.body, { status: claim.replay.status });
      }

      if (claim?.kind === 'conflict') {
        const response = NextResponse.json(
          { error: 'Request is already being processed' },
          { status: 409 }
        );
        response.headers.set('Retry-After', '1');
        return response;
      }

      if (claim?.kind === 'payload-mismatch') {
        return NextResponse.json(
          { error: 'Idempotency key was already used with a different payload' },
          { status: 422 }
        );
      }

      // Scope by user_id so a client cannot delete another user's meal.
      const deleted = await deleteMealById(id, userId);

      if (claim?.kind === 'owner') {
        await completeIdempotency(
          claim.rowId,
          deleted ? 200 : 404,
          deleted ? { success: true } : { error: 'Meal not found' }
        ).catch(() => {
          logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
        });
      }

      if (!deleted) {
        return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const PATCH = withAuth(async (
  request: NextRequest,
  userId: string,
  ...args: unknown[]
) => {
  return timedHttp('/api/saved-meals/[id]', 'PATCH', async () => {
    try {
      const { params } = (args[0] ?? {}) as { params: Promise<{ id: string }> };
      const { id } = await params;

      const rawBody = await request.json();
      const validation = UpdateMealNotesSchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validation.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
          { status: 400 }
        );
      }

      // Reject an empty PATCH (no fields to update) — mirrors the saved-itineraries
      // route contract.
      if (Object.keys(validation.data).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      // Idempotency: a retried PATCH must not double-write.
      const key = getIdempotencyKey(request);
      const claim = key
        ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(validation.data))
        : null;

      if (claim?.kind === 'replay') {
        return NextResponse.json(claim.replay.body, { status: claim.replay.status });
      }

      if (claim?.kind === 'conflict') {
        const response = NextResponse.json(
          { error: 'Request is already being processed' },
          { status: 409 }
        );
        response.headers.set('Retry-After', '1');
        return response;
      }

      if (claim?.kind === 'payload-mismatch') {
        return NextResponse.json(
          { error: 'Idempotency key was already used with a different payload' },
          { status: 422 }
        );
      }

      const input: MealNotesInput = {
        title: validation.data.title ?? null,
        notes: validation.data.notes ?? null,
      };

      const data = await updateMealNotes(id, userId, input);

      if (claim?.kind === 'owner') {
        if (data) {
          await completeIdempotency(claim.rowId, 200, { success: true, data }).catch(() => {
            logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
          });
        } else {
          await completeIdempotency(claim.rowId, 404, { error: 'Meal not found' }).catch(() => {
            logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
          });
        }
      }

      if (!data) {
        return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, data });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});