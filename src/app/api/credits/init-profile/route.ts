import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * POST /api/credits/init-profile
 * Initialize user profile for existing users (one-time fix)
 */
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database not available' },
        { status: 500 }
      );
    }

    // Check if profile already exists
    const { data: existing } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'Profile already exists',
        action: 'none',
      });
    }

    // Create user profile
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        current_tier: 'Default',
        daily_credits: 5,
        credits_used_today: 0,
        total_referrals: 0,
        active_referrals: 0,
      });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      action: 'created',
    });
  } catch (error) {
    return handleApiError(error, req);
  }
});
