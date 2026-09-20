import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { TierService } from '@/lib/referral-system';

/**
 * GET /api/tiers/current
 * Get current tier information for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    // Get user's current tier
    const currentTier = await TierService.getUserTier(userId);

    // Get tier configuration
    const tierConfig = TierService.getTierConfig(currentTier);

    // Get tier progress
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
});
