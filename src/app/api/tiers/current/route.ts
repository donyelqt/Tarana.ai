import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { TierService } from '@/lib/referral-system';

/**
 * GET /api/tiers/current
 * Get current tier information for the authenticated user
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
    console.error('Error in /api/tiers/current:', error);
    return NextResponse.json(
      {
        error: 'Failed to get tier information',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
