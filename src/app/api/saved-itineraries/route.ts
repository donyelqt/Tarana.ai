import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createItinerary, listItineraries } from '@/lib/services/itineraryService';
import { handleApiError } from '@/lib/errors/handleApiError';
import { mapRowToSavedItinerary, resolveItineraryImage, SaveItinerarySchema } from '@/lib/data/itineraryMapper';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload } from '@/lib/services/idempotencyService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

const IDEMPOTENCY_ROUTE = '/api/saved-itineraries';

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  return timedHttp('/api/saved-itineraries', 'GET', async () => {
    try {
      let data;
      try {
        data = await listItineraries(userId);
      } catch {
        return NextResponse.json(
          { error: 'Failed to fetch itineraries' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: (data ?? []).map(mapRowToSavedItinerary),
        count: data?.length ?? 0,
      });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const POST = withAuth(async (request: NextRequest, userId: string) => {
  return timedHttp('/api/saved-itineraries', 'POST', async () => {
    try {
      const body = await request.json();
      const validation = SaveItinerarySchema.safeParse(body);
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

      const validated = validation.data;
      const image = resolveItineraryImage(
        typeof validated.image === 'string' ? validated.image : validated.image?.src,
        validated.tags
      );

      const key = getIdempotencyKey(request);
      const claim = key
        ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload(validated))
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
        data = await createItinerary(userId, validated, image);
      } catch {
        if (claim?.kind === 'owner') {
          await completeIdempotency(claim.rowId, 500, { error: 'Failed to save itinerary' }).catch(() => {
            logger.error('[idempotency] failed to cache mutation failure', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
          });
        }
        return NextResponse.json(
          { error: 'Failed to save itinerary' },
          { status: 500 }
        );
      }

      const responseBody = { success: true, data: mapRowToSavedItinerary(data) };
      const response = NextResponse.json(responseBody, { status: 201 });

      if (claim?.kind === 'owner') {
        await completeIdempotency(claim.rowId, 201, responseBody).catch(() => {
          logger.error('[idempotency] failed to complete key', { route: IDEMPOTENCY_ROUTE, rowId: claim.rowId }, getRequestId(request));
        });
      }

      return response;
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});