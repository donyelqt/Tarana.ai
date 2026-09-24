import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { recordTosAcceptance } from '@/lib/services/userService';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

/**
 * Records ToS/Privacy acceptance for the signed-in user.
 * Used by the post-login consent gate (/auth/consent).
 */
export const POST = withAuth(async (req: NextRequest, userId: string) => {
  return timedHttp('/api/auth/consent', 'POST', async () => {
    try {
      const now = new Date().toISOString();
      await recordTosAcceptance(userId);

      return NextResponse.json({ success: true, tos_accepted_at: now });
    } catch (error) {
      logger.error(
        'Error recording ToS acceptance',
        {
          entryPoint: '/api/auth/consent',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
        getRequestId(req)
      );
      return NextResponse.json(
        { error: 'Could not record acceptance. Please try again.' },
        { status: 500 }
      );
    }
  }, (res) => res.status);
});