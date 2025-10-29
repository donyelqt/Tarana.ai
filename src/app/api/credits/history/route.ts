import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { CreditService } from '@/lib/referral-system';

/**
 * GET /api/credits/history
 * Get credit transaction history for the authenticated user
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

    // Get limit from query params (default: 20, max: 100)
    const url = new URL(req.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '20'), 100);

    // Get credit history
    const history = await CreditService.getCreditHistory(userId, limit);

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error) {
    console.error('Error in /api/credits/history:', error);
    return NextResponse.json(
      {
        error: 'Failed to get credit history',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
