import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { renderPrometheusExposition, snapshotHttpMetrics } from '@/lib/observability/httpMetrics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.METRICS_ADMIN_TOKEN || process.env.REINDEX_SECRET || '';
  const provided = req.headers.get('x-admin-token') ?? '';
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const series = snapshotHttpMetrics().length;
  const body = renderPrometheusExposition();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'X-Metrics-Series': String(series),
      'Cache-Control': 'no-store',
    },
  });
}
