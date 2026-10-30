import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { TierService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/tiers/current', 'GET', async () => {
    try {
      const currentTier = await TierService.getUserTier(userId);

      const tierConfig = TierService.getTierConfig(currentTier);

      const tierProgress = await TierService.getTierProgress(userId);

      return NextResponse.json({
        success: true,
        currentTier,
        config: tierConfig,
        progress: tierProgress,
      });
    } catch (error) {
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
