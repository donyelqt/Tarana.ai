import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createMeal, listMeals, MealDbError, SavedMealInput } from '@/lib/services/mealService';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload } from '@/lib/services/idempotencyService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

const IDEMPOTENCY_ROUTE = '/api/saved-meals';
const SavedMealSchema = z.object({
  cafe_name: z.string().min(1, 'Cafe name is required').max(200),
  meal_type: z.string().min(1, 'Meal type is required'),
  price: z.number().positive('Price must be positive'),
  good_for: z.string().optional(),
  location: z.string().optional(),
  image: z.string().url().optional().or(z.literal('')),
  tags: z.array(z.string()).optional().default([]),
  menu_items: z.array(z.any()).optional().default([])
});

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  return timedHttp('/api/saved-meals', 'GET', async () => {
    try {
      const data = await listMeals(userId);

      return NextResponse.json({
        success: true,
        data,
        userId,
        count: data?.length || 0
      });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  return timedHttp('/api/saved-meals', 'POST', async () => {
  try {
    const body = await request.json();

    // Validate input with Zod
    const validation = SavedMealSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const validatedData: SavedMealInput = validation.data;

    const key = getIdempotencyKey(request);
    const claim = key
      ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(validatedData))
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

    let data;
    try {
      data = await createMeal(userId, validatedData);
    } catch {
      if (claim?.kind === 'owner') {
        await completeIdempotency(claim.rowId, 500, { error: 'Failed to save meal' }).catch(() => {
          logger.error('[idempotency] failed to cache mutation failure', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
        });
      }
      return NextResponse.json(
        { error: 'Failed to save meal' },
        { status: 500 }
      );
    }
    const responseBody = { success: true, data };
    const response = NextResponse.json(responseBody, { status: 200 });

    if (claim?.kind === 'owner') {
      await completeIdempotency(claim.rowId, 200, responseBody).catch(() => {
        logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
      });
    }
    return response;
  } catch (error) {
    return handleApiError(error, request);
  }
  }, (res) => res.status);
});
