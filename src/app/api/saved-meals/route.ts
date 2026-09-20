import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { createMeal, listMeals, MealDbError, SavedMealInput } from '@/lib/services/mealService';
import { z } from 'zod';
import { handleApiError } from '@/lib/errors/handleApiError';
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

export const GET = withAuth(async (request: NextRequest, userId: string) => {
  try {
    const data = await listMeals(userId);

    return NextResponse.json({
      success: true,
      data,
      userId,
      count: data?.length || 0
    });
  } catch (error) {
    if (error instanceof MealDbError) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch saved meals',
          details: error.details,
          hint: error.hint,
          code: error.code
        },
        { status: 500 }
      );
    }
    return handleApiError(error, request);
  }
});

export const POST = withAuth(async (request: NextRequest, userId: string) => {
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

    let data;
    try {
      data = await createMeal(userId, validatedData);
    } catch {
      return NextResponse.json(
        { error: 'Failed to save meal' },
        { status: 500 }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, request);
  }
});
