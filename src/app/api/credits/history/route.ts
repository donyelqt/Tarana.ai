import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { CreditService } from '@/lib/referral-system';

/**
 * GET /api/credits/history
 * Get credit transaction history for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
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
    return handleApiError(error, req);
  }
});
