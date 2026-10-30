import { NextRequest, NextResponse } from 'next/server';
import { getStats } from '@/lib/services/statsService';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';


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
