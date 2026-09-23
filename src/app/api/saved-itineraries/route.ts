import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createItinerary, listItineraries } from '@/lib/services/itineraryService';
import { handleApiError } from '@/lib/errors/handleApiError';
import { mapRowToSavedItinerary, resolveItineraryImage, SaveItinerarySchema } from '@/lib/data/itineraryMapper';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { checkIdempotency, getIdempotencyKey, recordIdempotency } from '@/lib/services/idempotencyService';

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

      // Idempotency (Phase 2.3): a caller-supplied Idempotency-Key makes a
      // double-click, retry, or concurrent duplicate a safe replay instead
      // of a second saved trip. Check BEFORE the write — the only ordering
      // that makes replay semantics correct; a check-then-write helper
      // would race, letting two concurrent requests both miss and both run
      // the mutation. The underlying createItinerary is INSERT-only with a
      // caller-owned id, so a replay that slips through is still not a
      // duplicate — but the cached response is the real protection.
      const key = getIdempotencyKey(request);
      if (key) {
        const replay = await checkIdempotency(userId, '/api/saved-itineraries', key);
        if (replay) {
          return NextResponse.json(replay.body, { status: replay.status });
        }
      }

      let data;
      try {
        data = await createItinerary(userId, validated, image);
      } catch {
        return NextResponse.json(
          { error: 'Failed to save itinerary' },
          { status: 500 }
        );
      }
      const response = NextResponse.json(
        { success: true, data: mapRowToSavedItinerary(data) },
        { status: 201 }
      );

      if (key) {
        // Best-effort: a failed record only means a future replay runs the
        // mutation again, which is safe (see comment above). The response
        // is returned regardless — the caller already got its result.
        await recordIdempotency(
          userId,
          '/api/saved-itineraries',
          key,
          201,
          { success: true, data: mapRowToSavedItinerary(data) }
        );
      }

      return response;
    } catch (error) {
      return handleApiError(error, request);
    }
  }, (res) => res.status);
});