import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { ReferralService, TierService } from '@/lib/referral-system';

/**
 * GET /api/referrals/stats
 * Get referral statistics for the authenticated user
 */
export async function GET(req: NextRequest) {
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

    // Get referral stats
    const stats = await ReferralService.getReferralStats(userId);
    
    // Get tier progress
    const tierProgress = await TierService.getTierProgress(userId);
    
    // Get user's referral code
    const referralCode = await ReferralService.getUserReferralCode(userId);

    return NextResponse.json({
      success: true,
      stats,
      tierProgress,
      referralCode,
    });
  } catch (error) {
    console.error('Error in /api/referrals/stats:', error);
    return NextResponse.json(
      {
        error: 'Failed to get referral stats',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
