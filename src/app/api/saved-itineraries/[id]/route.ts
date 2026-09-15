import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { mapRowToSavedItinerary, resolveItineraryImage, UpdateItinerarySchema } from '@/lib/data/itineraryMapper';
import { z } from 'zod';

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

async function requireUserId() {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) });
  } catch (error) {
    console.error('Error fetching itinerary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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

    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) });
  } catch (error) {
    console.error('Error updating itinerary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const userId = await requireUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting itinerary:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
