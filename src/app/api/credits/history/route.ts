import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { handleApiError } from '@/lib/errors/handleApiError';
import { CreditService } from '@/lib/referral-system';
import { timedHttp } from '@/lib/observability/httpMetrics';

export const GET = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/credits/history', 'GET', async () => {
    try {
      const url = new URL(req.url);
      const limitParam = url.searchParams.get('limit');
      const parsedLimit = Number.parseInt(limitParam ?? '20', 10);
      const limit = Number.isFinite(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 100)
        : 20;

      const history = await CreditService.getCreditHistory(userId, limit);

      return NextResponse.json({
        success: true,
        history,
        count: history.length,
      });
    } catch (error) {
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
