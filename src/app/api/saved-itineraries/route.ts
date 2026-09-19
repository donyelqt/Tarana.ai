import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import { mapRowToSavedItinerary, resolveItineraryImage, SaveItinerarySchema } from '@/lib/data/itineraryMapper';
import { getRequestId } from '@/middleware/requestId';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('itineraries')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching itineraries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch itineraries', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: (data ?? []).map(mapRowToSavedItinerary),
      count: data?.length ?? 0,
    });
  } catch (error) {
    logger.error('Error fetching itineraries:', { error }, getRequestId(request));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
        user_id: session.user.id,
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
      console.error('Supabase error saving itinerary:', error);
      return NextResponse.json(
        { error: 'Failed to save itinerary', details: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, data: mapRowToSavedItinerary(data) }, { status: 201 });
  } catch (error) {
    logger.error('Error saving itinerary:', { error }, getRequestId(request));
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
