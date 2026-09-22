import { NextResponse } from 'next/server';
import { renderPrometheusExposition, snapshotHttpMetrics } from '@/lib/observability/httpMetrics';

/**
 * GET /api/metrics
 *
 * Prometheus text exposition for the zero-dep RED core
 * (`src/lib/observability/httpMetrics.ts`). Same serverless caveat as
 * `refundMetrics`: per-instance counts, scraped from whatever this
 * instance has observed since cold start. No auth: exposition format
 * carries only bounded labels (method, route, status_class, le) —
 * no user ids, no request ids, no error text. Never log the body.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const series = snapshotHttpMetrics().length;
  const body = renderPrometheusExposition();
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      'X-Metrics-Series': String(series),
    },
  });
}
