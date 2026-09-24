import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/withAuth";
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const LOG_ENTRY_POINT = '/api/referrals/debug';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/referrals/debug', 'GET', async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      logger.error('Referrals debug: profile fetch failed', { error: profileError }, getRequestId(req));
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 2. Get all referrals where user is referrer
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select(`
        id,
        referee_id,
        referral_code,
        status,
        created_at,
        activated_at,
        referee:user_profiles!referrals_referee_id_fkey(
          id,
          referral_code,
          current_tier,
          created_at
        )
      `)
      .eq('referrer_id', userId);

    if (referralsError) {
      logger.error("Error fetching referrals", { error: referralsError }, getRequestId(req));
    }

    // 3. Count active referrals manually
    const activeCount = referrals?.filter(r => r.status === 'active').length || 0;
    const pendingCount = referrals?.filter(r => r.status === 'pending').length || 0;

    // 4. Calculate expected tier
    const expectedTier = activeCount >= 5 ? 'Voyager' 
      : activeCount >= 3 ? 'Smart Traveler'
      : activeCount >= 1 ? 'Explorer'
      : 'Default';

    const expectedCredits = expectedTier === 'Voyager' ? 10
      : expectedTier === 'Smart Traveler' ? 8
      : expectedTier === 'Explorer' ? 6
      : 5;

    // 5. Check if tier is correct
    const tierMismatch = profile.current_tier !== expectedTier || profile.daily_credits !== expectedCredits;

    return NextResponse.json({
      status: "success",
      profile: {
        id: profile.id,
        referralCode: profile.referral_code,
        currentTier: profile.current_tier,
        dailyCredits: profile.daily_credits,
        totalReferrals: profile.total_referrals,
        activeReferrals: profile.active_referrals,
      },
      referrals: referrals?.map(r => ({
        id: r.id,
        refereeId: r.referee_id,
        status: r.status,
        createdAt: r.created_at,
        activatedAt: r.activated_at,
        refereeProfile: r.referee
      })) || [],
      counts: {
        total: referrals?.length || 0,
        active: activeCount,
        pending: pendingCount,
      },
      expected: {
        tier: expectedTier,
        credits: expectedCredits,
      },
      issues: {
        tierMismatch,
        details: tierMismatch 
          ? `Current: ${profile.current_tier} (${profile.daily_credits} credits), Expected: ${expectedTier} (${expectedCredits} credits)`
          : "No issues detected"
      }
    });

  } catch (error) {
    return handleApiError(error, req);
  }
  }, (res) => res.status);
});
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const requestId = getRequestId(req);
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    logger.info('Referral tier fix started', { entryPoint: LOG_ENTRY_POINT }, requestId);

    // 1. Get active referral count
    const { data: referrals, error: referralsError } = await supabase
      .from('referrals')
      .select('id, status')
      .eq('referrer_id', userId);

    if (referralsError) {
      logger.error('Referrals debug: referrals fetch failed', { entryPoint: LOG_ENTRY_POINT }, requestId);
      return NextResponse.json({ error: "Failed to fetch referrals" }, { status: 500 });
    }

    const activeCount = referrals?.filter(r => r.status === 'active').length || 0;

    // 2. Calculate correct tier
    const correctTier = activeCount >= 5 ? 'Voyager' 
      : activeCount >= 3 ? 'Smart Traveler'
      : activeCount >= 1 ? 'Explorer'
      : 'Default';

    const correctCredits = correctTier === 'Voyager' ? 10
      : correctTier === 'Smart Traveler' ? 8
      : correctTier === 'Explorer' ? 6
      : 5;

    // 3. Update user profile
    const { data: updated, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        active_referrals: activeCount,
        current_tier: correctTier,
        daily_credits: correctCredits,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      logger.error('Referrals debug: tier fix failed', { entryPoint: LOG_ENTRY_POINT }, requestId);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    logger.info(
      'Referral tier fixed',
      {
        entryPoint: LOG_ENTRY_POINT,
        activeReferrals: updated.active_referrals,
        currentTier: updated.current_tier,
        dailyCredits: updated.daily_credits,
      },
      requestId
    );

    return NextResponse.json({
      status: "success",
      message: "Referral tier updated successfully",
      updated: {
        activeReferrals: updated.active_referrals,
        currentTier: updated.current_tier,
        dailyCredits: updated.daily_credits,
      },
      previous: {
        tier: correctTier,
        credits: correctCredits
      }
    });

  } catch (error) {
    return handleApiError(error, req);
  }
});
