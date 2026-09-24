/**
 * Cron Job API Endpoint - Evaluate Itinerary Refreshes
 * Scheduled background job to check all itineraries for refresh needs.
 *
 * @route GET /api/cron/evaluate-refreshes
 * @author Tarana.ai Engineering Team
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { evaluateAllItineraries, notifyUsersOfRefreshNeeds } from '@/lib/services/refreshScheduler';
import {
  claimIdempotency,
  completeIdempotency,
  getIdempotencyKey,
  hashIdempotencyPayload,
} from '@/lib/services/idempotencyService';
import type { IdempotencyClaim } from '@/lib/services/idempotencyService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

const LOG_ENTRY_POINT = '/api/cron/evaluate-refreshes';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
const CRON_PENDING_TTL_MS = 60 * 60 * 1000;
const MAX_REQUEST_BODY_BYTES = 16 * 1024;

const manualOptionsSchema = z.object({
  notify: z.boolean().optional().default(true),
}).strict();

type AuthFailure = 'missing_config' | 'unauthorized' | null;
type RequestOutcome = { status: number; body: Record<string, unknown> };

function checkCronAuth(request: NextRequest): AuthFailure {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return 'missing_config';

  const authorization = request.headers.get('authorization');
  if (!authorization) return 'unauthorized';

  const [scheme, providedToken, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !providedToken || extra.length > 0) {
    return 'unauthorized';
  }

  const provided = createHash('sha256').update(providedToken).digest();
  const expected = createHash('sha256').update(cronSecret).digest();
  if (!timingSafeEqual(provided, expected)) {
    return 'unauthorized';
  }

  return null;
}

function authFailureResponse(failure: Exclude<AuthFailure, null>): NextResponse {
  if (failure === 'missing_config') {
    return NextResponse.json(
      {
        success: false,
        error: 'Configuration error',
        message: 'Cron authentication is not configured',
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authentication token',
    },
    { status: 401 }
  );
}


async function evaluateAndNotify(notify: boolean, message: string, requestId: string): Promise<RequestOutcome> {
  try {
    const stats = await evaluateAllItineraries();
    if (notify && stats.needsRefreshCount > 0) {
      await notifyUsersOfRefreshNeeds(stats.results);
    }

    return {
      status: 200,
      body: {
        success: true,
        message,
        stats: {
          totalItineraries: stats.totalItineraries,
          evaluatedCount: stats.evaluatedCount,
          needsRefreshCount: stats.needsRefreshCount,
          skippedCount: stats.skippedCount,
          errorCount: stats.errorCount,
          duration: stats.duration,
        },
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error(
      'Refresh evaluation failed',
      { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error },
      requestId
    );
    return {
      status: 500,
      body: {
        success: false,
        error: 'Internal server error',
        message: 'Evaluation failed',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

function claimResponse(claim: IdempotencyClaim): NextResponse | null {
  if (claim.kind === 'replay') {
    return NextResponse.json(claim.replay.body, { status: claim.replay.status });
  }

  if (claim.kind === 'conflict') {
    const response = NextResponse.json(
      { error: 'Request is already being processed' },
      { status: 409 }
    );
    response.headers.set('Retry-After', '1');
    return response;
  }

  if (claim.kind === 'payload-mismatch') {
    return NextResponse.json(
      { error: 'Idempotency key was already used with a different payload' },
      { status: 422 }
    );
  }

  return null;
}

async function executeKeyed(
  requestId: string,
  key: string,
  payload: unknown,
  notify: boolean,
  message: string
): Promise<NextResponse> {
  const claim = await claimIdempotency(
    SYSTEM_USER_ID,
    LOG_ENTRY_POINT,
    key,
    hashIdempotencyPayload(payload),
    CRON_PENDING_TTL_MS
  );
  const earlyResponse = claimResponse(claim);
  if (earlyResponse) return earlyResponse;
  if (claim.kind !== 'owner') {
    throw new Error('Unexpected idempotency claim state');
  }

  const outcome = await evaluateAndNotify(notify, message, requestId);
  await completeIdempotency(claim.rowId, outcome.status, outcome.body);
  return NextResponse.json(outcome.body, { status: outcome.status });
}


export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const authFailure = checkCronAuth(request);
  if (authFailure) {
    logger.warn(
      'Cron authentication rejected',
      { entryPoint: LOG_ENTRY_POINT, reason: authFailure },
      requestId
    );
    return authFailureResponse(authFailure);
  }

  const hourBucket = new Date().toISOString().slice(0, 13);
  const key = `scheduled:${hourBucket}:00Z`;

  try {
    logger.info('Scheduled refresh evaluation started', { entryPoint: LOG_ENTRY_POINT }, requestId);
    const response = await executeKeyed(
      requestId,
      key,
      { trigger: 'scheduled', hourBucket, notify: true },
      true,
      'Evaluation completed successfully'
    );
    logger.info('Scheduled refresh evaluation completed', { entryPoint: LOG_ENTRY_POINT, status: response.status }, requestId);
    return response;
  } catch (error) {
    logger.error('Scheduled refresh evaluation failed', { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error }, requestId);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: 'Evaluation failed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = getRequestId(request);
  const authFailure = checkCronAuth(request);
  if (authFailure) {
    logger.warn(
      'Cron authentication rejected',
      { entryPoint: LOG_ENTRY_POINT, reason: authFailure },
      requestId
    );
    return authFailureResponse(authFailure);
  }

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Request body too large' },
      { status: 413 }
    );
  }
  let input: unknown = {};
  const rawBody = await request.text();
  if (rawBody.trim()) {
    try {
      input = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
  }

  const parsed = manualOptionsSchema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const notify = parsed.data.notify;
  const rawKey = getIdempotencyKey(request);
  const key = rawKey ? `manual:${rawKey}` : null;

  try {
    logger.info('Manual refresh evaluation started', { entryPoint: LOG_ENTRY_POINT }, requestId);
    if (key) {
      const response = await executeKeyed(
        requestId,
        key,
        { trigger: 'manual', notify },
        notify,
        'Manual evaluation completed'
      );
      logger.info('Manual refresh evaluation completed', { entryPoint: LOG_ENTRY_POINT, status: response.status }, requestId);
      return response;
    }

    const outcome = await evaluateAndNotify(notify, 'Manual evaluation completed', requestId);
    const response = NextResponse.json(outcome.body, { status: outcome.status });
    logger.info('Manual refresh evaluation completed', { entryPoint: LOG_ENTRY_POINT, status: response.status }, requestId);
    return response;
  } catch (error) {
    logger.error('Manual refresh evaluation failed', { entryPoint: LOG_ENTRY_POINT, errorName: error instanceof Error ? error.name : typeof error }, requestId);
    return NextResponse.json(
      { success: false, error: 'Internal server error', message: 'Evaluation failed' },
      { status: 500 }
    );
  }
}
