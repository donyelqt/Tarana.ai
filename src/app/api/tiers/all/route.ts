import { NextRequest, NextResponse } from 'next/server';
import { TierService } from '@/lib/referral-system';

/**
 * GET /api/tiers/all
 * Get all available tier configurations (no authentication required)
 */
export async function GET(req: NextRequest) {
  try {
    // Get all tier configurations
    const tiers = TierService.getAllTiers();

    return NextResponse.json({
      success: true,
      tiers,
    });
  } catch (error) {
    console.error('Error in /api/tiers/all:', error);
    return NextResponse.json(
      {
        error: 'Failed to get tier configurations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
