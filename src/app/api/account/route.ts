import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { deleteUserAccount } from '@/lib/services/userService';
import { handleApiError } from '@/lib/errors/handleApiError';
import { timedHttp } from '@/lib/observability/httpMetrics';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from '@/lib/services/idempotencyService';

const IDEMPOTENCY_ROUTE = '/api/account';

export const DELETE = withAuth(async (req: NextRequest, userId: string) => {
  const requestId = getRequestId(req);
  return timedHttp('/api/account', 'DELETE', async () => {
    try {
      const contentLength = Number(req.headers.get('content-length') ?? 0);
      if (contentLength > 4 * 1024) {
        return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
      }

      let body: unknown = {};
      try {
        body = await req.json();
      } catch {
      }
      if ((body as { confirm?: unknown } | null)?.confirm !== 'DELETE') {
        return NextResponse.json(
          { error: 'Confirmation required', hint: 'Send {"confirm":"DELETE"}' },
          { status: 400 }
        );
      }

      const key = getIdempotencyKey(req);
      const claim = key
        ? await claimIdempotency(userId, IDEMPOTENCY_ROUTE, key, hashIdempotencyPayload({ confirm: 'DELETE' }))
        : null;

      if (claim?.kind === 'replay') {
        return NextResponse.json(claim.replay.body, { status: claim.replay.status });
      }
      if (claim?.kind === 'conflict') {
        const res = NextResponse.json({ error: 'Request is already being processed' }, { status: 409 });
        res.headers.set('Retry-After', '1');
        return res;
      }
      if (claim?.kind === 'payload-mismatch') {
        return NextResponse.json(
          { error: 'Idempotency key was already used with a different payload' },
          { status: 422 }
        );
      }

      const deletedItineraries = await deleteUserAccount(userId);
      const responseBody = { success: true, deletedItineraries };
      logger.info('Account deleted', { entryPoint: '/api/account', deletedItineraries }, requestId);

      if (claim?.kind === 'owner') {
        await completeIdempotency(claim.rowId, 200, responseBody);
      }
      return NextResponse.json(responseBody);
    } catch (error) {
      logger.error('Account deletion failed', { entryPoint: '/api/account' }, requestId);
      return handleApiError(error, req);
    }
  }, (res) => res.status);
});
