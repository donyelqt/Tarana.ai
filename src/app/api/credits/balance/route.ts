import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { CreditService } from '@/lib/referral-system';

/**
 * GET /api/credits/balance
 * Get current credit balance for the authenticated user
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

    // Get credit balance
    const balance = await CreditService.getCurrentBalance(userId);

    return NextResponse.json({
      success: true,
      balance,
    });
  } catch (error) {
    console.error('Error in /api/credits/balance:', error);
    return NextResponse.json(
      {
        error: 'Failed to get credit balance',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
