import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { ReferralService, TierService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * GET /api/referrals/stats
 * Get referral statistics for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/referrals/stats', 'GET', async () => {
    try {
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
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
