/**
 * Route test for GET /api/metrics.
 *
 * Pins the exposition contract: content type, HELP/TYPE headers,
 * series count header, and that an observed series renders with only
 * the bounded label set. Uses the real core (no mocks) with the
 * `resetHttpMetrics` test seam for isolation.
 *
 * NOTE: jest.setup.js replaces global Response with a minimal mock whose
 * `headers` is a Map (no `.get`). Read via `.headers.get()` on the real
 * NextResponse when available, else fall back to Map access.
 */
function header(res: { headers: unknown }, name: string): string | null {
  const headers = res.headers as { get?: (k: string) => string | null } & Map<string, string>;
  if (typeof headers.get === 'function') {
    const direct = headers.get(name);
    if (direct != null) return direct;
    if (headers instanceof Map) return headers.get(name.toLowerCase()) ?? null;
    return direct;
  }
  return null;
}

import { GET } from '../route';
import { observeHttp, resetHttpMetrics } from '@/lib/observability/httpMetrics';

describe('GET /api/metrics', () => {
  beforeEach(() => {
    resetHttpMetrics();
  });

  it('exposes Prometheus text with the observed series', async () => {
    observeHttp({ route: '/api/tiers/all', method: 'GET', statusClass: '2xx', durationSeconds: 0.06 });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(header(res, 'Content-Type')).toContain('text/plain');
    expect(header(res, 'X-Metrics-Series')).toBe('1');
    const text = await res.text();
    expect(text).toContain('# HELP http_requests_total');
    expect(text).toContain('# TYPE http_request_duration_seconds histogram');
    expect(text).toContain('http_requests_total{method="GET",route="/api/tiers/all",status_class="2xx"} 1');
  });

  it('renders headers-only exposition with zero series', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(header(res, 'X-Metrics-Series')).toBe('0');
    const text = await res.text();
    expect(text).toContain('# HELP http_requests_total');
    expect(text).not.toContain('http_requests_total{');
  });
});
