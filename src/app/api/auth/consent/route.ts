import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { recordTosAcceptance } from '@/lib/services/userService';
import { timedHttp } from '@/lib/observability/httpMetrics';

/**
 * Records ToS/Privacy acceptance for the signed-in user.
 * Used by the post-login consent gate (/auth/consent).
 */
export const POST = withAuth(async (_req: NextRequest, userId: string) => {
  return timedHttp('/api/auth/consent', 'POST', async () => {
    try {
      const now = new Date().toISOString();
      await recordTosAcceptance(userId);

      return NextResponse.json({ success: true, tos_accepted_at: now });
    } catch (error) {
      console.error('Error recording ToS acceptance:', error);
      return NextResponse.json(
        { error: 'Could not record acceptance. Please try again.' },
        { status: 500 }
      );
    }
  }, (res) => res.status);
});