import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { CreditService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/credits/balance', 'GET', async () => {
    try {
      const balance = await CreditService.getCurrentBalance(userId);

      return NextResponse.json({
        success: true,
        balance,
      });
    } catch (error) {
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
