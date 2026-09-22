import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createItinerary, listItineraries } from '@/lib/services/itineraryService';
import { handleApiError } from '@/lib/errors/handleApiError';
import { mapRowToSavedItinerary, resolveItineraryImage, SaveItinerarySchema } from '@/lib/data/itineraryMapper';
import { timedHttp } from '@/lib/observability/httpMetrics';

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

    let data;
    try {
      data = await createItinerary(userId, validated, image);
    } catch {
      return NextResponse.json(
        { error: 'Failed to save itinerary' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request);
  }
  }, (res) => res.status);
});
