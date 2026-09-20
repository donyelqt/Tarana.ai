import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { handleApiError } from '@/lib/errors/handleApiError';
import { mapRowToSavedItinerary, resolveItineraryImage, SaveItinerarySchema } from '@/lib/data/itineraryMapper';

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
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
});

export const POST = withAuth(async (request: NextRequest, userId: string) => {
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

    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .insert({
        user_id: userId,
        title: validated.title,
        date: validated.date,
        budget: validated.budget,
        image,
        tags: validated.tags,
        form_data: validated.formData,
        itinerary_data: validated.itineraryData,
        weather_data: validated.weatherData ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to save itinerary' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, request);
  }
});
