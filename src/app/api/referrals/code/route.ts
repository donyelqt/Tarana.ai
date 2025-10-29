import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { ReferralService } from '@/lib/referral-system';

/**
 * GET /api/referrals/code
 * Get the authenticated user's referral code
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

    // Get user's referral code
    const referralCode = await ReferralService.getUserReferralCode(userId);

    if (!referralCode) {
      return NextResponse.json(
        { error: 'Referral code not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      referralCode,
    });
  } catch (error) {
    console.error('Error in /api/referrals/code:', error);
    return NextResponse.json(
      {
        error: 'Failed to get referral code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
