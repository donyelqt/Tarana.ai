import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { z } from 'zod';

// Zod validation schema for saved meals
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - No session found' },
        { status: 401 }
      );
    }

    // Use admin client and filter by user_id manually
    const { data, error } = await supabaseAdmin
      .from('saved_meals')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch saved meals',
          details: error.message,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      userId: session.user.id,
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Error fetching saved meals:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const validatedData = validation.data;

    // Use admin client to insert
    const { data, error } = await supabaseAdmin
      .from('saved_meals')
      .insert({
        user_id: session.user.id,
        cafe_name: validatedData.cafe_name,
        meal_type: validatedData.meal_type,
        price: validatedData.price,
        good_for: validatedData.good_for,
        location: validatedData.location,
        image: validatedData.image,
        tags: validatedData.tags,
        menu_items: validatedData.menu_items
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to save meal', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error saving meal:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
