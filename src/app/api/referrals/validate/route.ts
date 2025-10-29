import { NextRequest, NextResponse } from 'next/server';
import { ReferralService } from '@/lib/referral-system';

/**
 * POST /api/referrals/validate
 * Validate a referral code (no authentication required)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json(
        { error: 'Referral code is required' },
        { status: 400 }
      );
    }

    // Validate the referral code
    const isValid = await ReferralService.validateReferralCode(code);

    return NextResponse.json({
      success: true,
      valid: isValid,
      code,
    });
  } catch (error) {
    console.error('Error in /api/referrals/validate:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate referral code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
