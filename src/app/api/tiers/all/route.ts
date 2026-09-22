import { NextRequest, NextResponse } from 'next/server';
import { TierService } from '@/lib/referral-system';
import { handleApiError } from '@/lib/errors/handleApiError';
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
    return handleApiError(error, req);
  }
}
