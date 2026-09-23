import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { deleteItineraryById, getItineraryById, updateItineraryById } from '@/lib/services/itineraryService';
import { handleApiError } from '@/lib/errors/handleApiError';
import { mapRowToSavedItinerary, resolveItineraryImage, UpdateItinerarySchema } from '@/lib/data/itineraryMapper';
import { z } from 'zod';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { claimIdempotency, completeIdempotency, getIdempotencyKey, hashIdempotencyPayload } from '@/lib/services/idempotencyService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

function toDbPayload(validated: z.infer<typeof UpdateItinerarySchema>) {
  const payload: Record<string, unknown> = {};
  if (validated.title !== undefined) payload.title = validated.title;
  if (validated.date !== undefined) payload.date = validated.date;
  if (validated.budget !== undefined) payload.budget = validated.budget;
  if (validated.image !== undefined) {
    const tags: unknown = validated.tags;
    payload.image = resolveItineraryImage(
      typeof validated.image === 'string' ? validated.image : validated.image.src,
      Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : []
    );
  }
  if (validated.tags !== undefined) payload.tags = validated.tags;
  if (validated.formData !== undefined) payload.form_data = validated.formData;
  if (validated.itineraryData !== undefined) payload.itinerary_data = validated.itineraryData;
  if (validated.weatherData !== undefined) payload.weather_data = validated.weatherData;
  if (validated.refreshMetadata !== undefined) payload.refresh_metadata = validated.refreshMetadata;
  if (validated.trafficSnapshot !== undefined) payload.traffic_snapshot = validated.trafficSnapshot;
  if (validated.activityCoordinates !== undefined)
    payload.activity_coordinates = validated.activityCoordinates;
  return payload;
}

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withAuth(async (request: NextRequest, userId: string, ...args: unknown[]) => {
  return timedHttp('/api/saved-itineraries/[id]', 'GET', async () => {
    try {
      const { params } = (args[0] ?? {}) as RouteParams;
      const { id } = await params;

      const data = await getItineraryById(id, userId);

      if (!data) {
        return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const PATCH = withAuth(async (request: NextRequest, userId: string, ...args: unknown[]) => {
  return timedHttp('/api/saved-itineraries/[id]', 'PATCH', async () => {
    try {
      const { params } = (args[0] ?? {}) as RouteParams;
      const { id } = await params;

      const body = await request.json();
      const validation = UpdateItinerarySchema.safeParse(body);
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
      const payload = toDbPayload(validation.data);
      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      const key = getIdempotencyKey(request);
      const claim = key
        ? await claimIdempotency(userId, `/api/saved-itineraries/${id}`, key, hashIdempotencyPayload(validation.data))
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
        data = await updateItineraryById(id, userId, payload);
      } catch {
        if (claim?.kind === 'owner') {
          await completeIdempotency(claim.rowId, 500, { error: 'Failed to update itinerary' }).catch(() => {
            logger.error('[idempotency] failed to cache mutation failure', { route: `/api/saved-itineraries/${id}`, rowId: claim.rowId }, getRequestId(request));
          });
        }
        return handleApiError(new Error('Failed to update itinerary'), request);
      }

      if (!data) {
        if (claim?.kind === 'owner') {
          await completeIdempotency(claim.rowId, 404, { error: 'Itinerary not found' }).catch(() => {
            logger.error('[idempotency] failed to cache mutation failure', { route: `/api/saved-itineraries/${id}`, rowId: claim.rowId }, getRequestId(request));
          });
        }
        return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
      }
      const responseBody = { success: true, data: mapRowToSavedItinerary(data) };
      const response = NextResponse.json(responseBody);

      if (claim?.kind === 'owner') {
        await completeIdempotency(claim.rowId, 200, responseBody).catch(() => {
          logger.error('[idempotency] failed to complete key', { route: `/api/saved-itineraries/${id}`, rowId: claim.rowId }, getRequestId(request));
        });
      }
      return response;
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});

export const DELETE = withAuth(async (request: NextRequest, userId: string, ...args: unknown[]) => {
  return timedHttp('/api/saved-itineraries/[id]', 'DELETE', async () => {
    try {
      const { params } = (args[0] ?? {}) as RouteParams;
      const { id } = await params;

      const deleted = await deleteItineraryById(id, userId);

      if (!deleted) {
        return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});