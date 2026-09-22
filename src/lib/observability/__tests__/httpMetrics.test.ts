/**
 * Unit tests for the zero-dep RED core (`httpMetrics.ts`).
 *
 * Contract under test:
 * - `toStatusClass` maps 2xx/4xx/5xx (boundary: 399→2xx, 400→4xx, 499→4xx, 500→5xx).
 * - `observeHttp` accumulates count + errorCount + cumulative buckets per
 *   (method, route, status_class) series; series are isolated by label set.
 * - `timedHttp` records duration and class from the response status, and
 *   records 5xx + rethrows on throw.
 * - `renderPrometheusExposition` emits counter + histogram lines with only
 *   the bounded label set (method, route, status_class, le).
 */
import {
  DURATION_BUCKETS,
  observeHttp,
  renderPrometheusExposition,
  resetHttpMetrics,
  snapshotHttpMetrics,
  timedHttp,
  toStatusClass,
} from '../httpMetrics';

beforeEach(() => {
  resetHttpMetrics();
});

describe('toStatusClass', () => {
  it('maps status codes to classes at the boundaries', () => {
    expect(toStatusClass(200)).toBe('2xx');
    expect(toStatusClass(399)).toBe('2xx');
    expect(toStatusClass(400)).toBe('4xx');
    expect(toStatusClass(499)).toBe('4xx');
    expect(toStatusClass(500)).toBe('5xx');
    expect(toStatusClass(503)).toBe('5xx');
  });
});

describe('observeHttp', () => {
  it('counts requests and 5xx errors per label set', () => {
    observeHttp({ route: '/api/tiers/all', method: 'GET', statusClass: '2xx', durationSeconds: 0.06 });
    observeHttp({ route: '/api/tiers/all', method: 'GET', statusClass: '2xx', durationSeconds: 0.3 });
    observeHttp({ route: '/api/tiers/all', method: 'GET', statusClass: '5xx', durationSeconds: 0.02 });

    const snaps = snapshotHttpMetrics();
    const ok = snaps.find((s) => s.statusClass === '2xx');
    const err = snaps.find((s) => s.statusClass === '5xx');
    expect(ok?.count).toBe(2);
    expect(ok?.errorCount).toBe(0);
    expect(err?.count).toBe(1);
    expect(err?.errorCount).toBe(1);
  });

  it('fills cumulative buckets (p50/p95 computable, never averages)', () => {
    observeHttp({ route: '/api/x', method: 'GET', statusClass: '2xx', durationSeconds: 0.06 });
    observeHttp({ route: '/api/x', method: 'GET', statusClass: '2xx', durationSeconds: 3 });

    const snap = snapshotHttpMetrics().find((s) => s.route === '/api/x');
    const at = (le: number): number => {
      const i = DURATION_BUCKETS.indexOf(le);
      return snap?.bucketCounts[i] ?? -1;
    };
    expect(at(0.05)).toBe(0);
    expect(at(0.1)).toBe(1);
    expect(at(2.5)).toBe(1);
    expect(at(5)).toBe(2);
    expect(snap?.bucketSum).toBeCloseTo(3.06, 9);
  });

  it('isolates series by route, method, and status class', () => {
    observeHttp({ route: '/api/a', method: 'GET', statusClass: '2xx', durationSeconds: 0.01 });
    observeHttp({ route: '/api/a', method: 'POST', statusClass: '2xx', durationSeconds: 0.01 });
    observeHttp({ route: '/api/b', method: 'GET', statusClass: '2xx', durationSeconds: 0.01 });

    expect(snapshotHttpMetrics()).toHaveLength(3);
  });
});

describe('timedHttp', () => {
  it('records the response status class and returns the response', async () => {
    const res = await timedHttp('/api/tiers/all', 'GET', async () => ({ status: 200, body: 'ok' }));
    expect(res.body).toBe('ok');
    const snap = snapshotHttpMetrics().find((s) => s.route === '/api/tiers/all');
    expect(snap?.count).toBe(1);
    expect(snap?.statusClass).toBe('2xx');
  });

  it('records 5xx and rethrows when the handler throws', async () => {
    await expect(
      timedHttp('/api/boom', 'POST', async (): Promise<{ status: number }> => {
        throw new Error('SENTINEL_TIMED_RETHROW_xyz789');
      })
    ).rejects.toThrow('SENTINEL_TIMED_RETHROW_xyz789');
    const snap = snapshotHttpMetrics().find((s) => s.route === '/api/boom');
    expect(snap?.count).toBe(1);
    expect(snap?.statusClass).toBe('5xx');
    expect(snap?.errorCount).toBe(1);
  });
});

describe('renderPrometheusExposition', () => {
  it('emits counter and histogram lines with the bounded label set only', () => {
    observeHttp({ route: '/api/tiers/all', method: 'GET', statusClass: '2xx', durationSeconds: 0.06 });

    const text = renderPrometheusExposition();
    expect(text).toContain('http_requests_total{method="GET",route="/api/tiers/all",status_class="2xx"} 1');
    expect(text).toContain('http_request_errors_total{method="GET",route="/api/tiers/all",status_class="2xx"} 0');
    expect(text).toContain('http_request_duration_seconds_bucket{method="GET",route="/api/tiers/all",status_class="2xx",le="0.1"} 1');
    expect(text).toContain('http_request_duration_seconds_bucket{method="GET",route="/api/tiers/all",status_class="2xx",le="+Inf"} 1');
    expect(text).toContain('http_request_duration_seconds_count{method="GET",route="/api/tiers/all",status_class="2xx"} 1');
    expect(text).not.toContain('user');
    expect(text).not.toContain('request_id');
  });
});
