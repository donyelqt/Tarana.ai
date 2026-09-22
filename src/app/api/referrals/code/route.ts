import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { ReferralService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * GET /api/referrals/code
 * Get the authenticated user's referral code
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/referrals/code', 'GET', async () => {
    try {
      const code = await ReferralService.getUserReferralCode(userId);
      if (code === null) {
        return NextResponse.json({ error: 'Referral code not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, referralCode: code });
    } catch (error) {
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
