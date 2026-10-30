import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { ReferralService, TierService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/referrals/stats', 'GET', async () => {
    try {
      const stats = await ReferralService.getReferralStats(userId);

      const tierProgress = await TierService.getTierProgress(userId);

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
