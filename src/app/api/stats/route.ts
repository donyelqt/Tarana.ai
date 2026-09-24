import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/services/statsService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';

/**
 * GET /api/stats
 * Public aggregate counters for the dashboard Tarana Stats widget.
 * No session required — all values are global aggregates, no per-user data.
 * Cafes come from the static restaurant dataset; the rest are exact-count
 * head queries (no rows transferred).
 */
export async function GET(request: NextRequest) {
  try {
    const stats = await getStats();
    return NextResponse.json({ success: true, stats });
  } catch {
    logger.error('Stats request failed', { entryPoint: '/api/stats' }, getRequestId(request));
    return NextResponse.json(
      { error: 'Failed to get stats' },
      { status: 500 }
    );
  }
}
