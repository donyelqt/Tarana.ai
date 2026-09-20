import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { CreditService } from '@/lib/referral-system';

/**
 * GET /api/credits/balance
 * Get current credit balance for the authenticated user
 */
export const GET = withAuth(async (req: NextRequest, userId: string) => {
  try {
    // Get credit balance
    const balance = await CreditService.getCurrentBalance(userId);

    return NextResponse.json({
      success: true,
      balance,
    });
  } catch (error) {
    return handleApiError(error, req);
  }
});
