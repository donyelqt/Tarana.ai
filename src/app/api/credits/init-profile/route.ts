import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { supabaseAdmin } from '@/lib/data/supabaseAdmin';

/**
 * POST /api/credits/init-profile
 * Initialize user profile for existing users (one-time fix)
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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
      console.error('Error creating profile:', error);
      return NextResponse.json(
        { error: 'Failed to create profile', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User profile created successfully',
      action: 'created',
    });
  } catch (error) {
    console.error('Error in /api/credits/init-profile:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
