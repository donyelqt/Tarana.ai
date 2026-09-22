/**
 * Zero-dep RED metrics for HTTP routes.
 *
 * Mirrors the zero-dep convention in `logger.ts` / `refundMetrics.ts`:
 * no `prom-client`, no lockfile churn, no cold-start state beyond a
 * module-level accumulator (same serverless caveat as refundMetrics —
 * per-instance counts, meaningful within an invocation burst; the
 * exposition endpoint scrapes whatever this instance has seen).
 *
 * On-call questions this answers (per the observability skill):
 * 1. What fraction of requests fail? → `http_requests_total` by
 *    `status_class` (SLO numerator/denominator in `docs/slo.md`).
 * 2. Is an endpoint slower than usual? → `http_request_duration_seconds`
 *    bucket counts (p50/p95/p99 computable from buckets, never averages).
 *
 * Cardinality rule: labels come from small fixed sets only —
 * `route` is a static template string chosen by the caller (never a raw
 * URL, user id, or error message), `method` is the HTTP verb,
 * `status_class` is `2xx`/`4xx`/`5xx`. Anything unbounded belongs in
 * logs/traces, never here.
 */

export type StatusClass = '2xx' | '4xx' | '5xx';

export interface HttpObservation {
  /** Static route template, e.g. `/api/credits/balance` or `/api/saved-itineraries/[id]`. */
  route: string;
  method: string;
  statusClass: StatusClass;
  /** Seconds, wall-clock. */
  durationSeconds: number;
}

/** Fixed histogram buckets (seconds) — shared by every route. */
export const DURATION_BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

export function toStatusClass(status: number): StatusClass {
  if (status >= 500) return '5xx';
  if (status >= 400) return '4xx';
  return '2xx';
}

interface SeriesKey {
  route: string;
  method: string;
  statusClass: StatusClass;
}

interface Series {
  count: number;
  errorCount: number;
  /** Cumulative bucket counts: bucketCounts[i] = observations with d <= DURATION_BUCKETS[i]. */
  bucketCounts: number[];
  bucketSum: number;
}

function keyOf(k: SeriesKey): string {
  return `${k.method}\u0000${k.route}\u0000${k.statusClass}`;
}

const series = new Map<string, { key: SeriesKey; data: Series }>();

function emptySeries(): Series {
  return { count: 0, errorCount: 0, bucketCounts: DURATION_BUCKETS.map(() => 0), bucketSum: 0 };
}

export function observeHttp(obs: HttpObservation): void {
  const key: SeriesKey = { route: obs.route, method: obs.method, statusClass: obs.statusClass };
  const id = keyOf(key);
  let entry = series.get(id);
  if (!entry) {
    entry = { key, data: emptySeries() };
    series.set(id, entry);
  }
  entry.data.count += 1;
  if (obs.statusClass === '5xx') entry.data.errorCount += 1;
  entry.data.bucketSum += obs.durationSeconds;
  for (let i = 0; i < DURATION_BUCKETS.length; i++) {
    if (obs.durationSeconds <= DURATION_BUCKETS[i]) entry.data.bucketCounts[i] += 1;
  }
}

/**
 * Time one handler invocation and record the observation.
 * Returns the handler's response unchanged so call sites stay one line.
 * Default status read narrows with `in` (no inline cast): a response
 * without a numeric `status` field counts as 200.
 */
function defaultStatusOf(res: unknown): number {
  if (res && typeof res === 'object' && 'status' in res && typeof res.status === 'number') {
    return res.status;
  }
  return 200;
}

export async function timedHttp<T>(route: string, method: string, fn: () => Promise<T & { status?: number }>): Promise<T>;
export async function timedHttp<T>(route: string, method: string, fn: () => Promise<T>, statusOf: (res: T) => number): Promise<T>;
export async function timedHttp<T>(
  route: string,
  method: string,
  fn: () => Promise<T>,
  statusOf?: (res: T) => number
): Promise<T> {
  const start = Date.now();
  try {
    const res = await fn();
    const status = statusOf ? statusOf(res) : defaultStatusOf(res);
    observeHttp({ route, method, statusClass: toStatusClass(status), durationSeconds: (Date.now() - start) / 1000 });
    return res;
  } catch (error) {
    observeHttp({ route, method, statusClass: '5xx', durationSeconds: (Date.now() - start) / 1000 });
    throw error;
  }
}

/** Test seam: clear all accumulated series. */
export function resetHttpMetrics(): void {
  series.clear();
}

export interface SeriesSnapshot {
  route: string;
  method: string;
  statusClass: StatusClass;
  count: number;
  errorCount: number;
  bucketCounts: number[];
  bucketSum: number;
}

/** Snapshot for exposition and tests (defensive copies). */
export function snapshotHttpMetrics(): SeriesSnapshot[] {
  return [...series.values()].map(({ key, data }) => ({
    route: key.route,
    method: key.method,
    statusClass: key.statusClass,
    count: data.count,
    errorCount: data.errorCount,
    bucketCounts: [...data.bucketCounts],
    bucketSum: data.bucketSum,
  }));
}

/** Escape label values for Prometheus exposition format. */
function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Render Prometheus text exposition (subset: counter + histogram).
 * Route/method/status_class are the only labels — all bounded by the caller.
 */
export function renderPrometheusExposition(): string {
  const lines: string[] = [
    '# HELP http_requests_total Total HTTP requests.',
    '# TYPE http_requests_total counter',
    '# HELP http_request_errors_total Total HTTP requests with 5xx status.',
    '# TYPE http_request_errors_total counter',
    '# HELP http_request_duration_seconds HTTP request duration in seconds.',
    '# TYPE http_request_duration_seconds histogram',
  ];
  const snaps = snapshotHttpMetrics().sort(
    (a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method) || a.statusClass.localeCompare(b.statusClass)
  );
  for (const s of snaps) {
    const labels = `method="${esc(s.method)}",route="${esc(s.route)}",status_class="${s.statusClass}"`;
    lines.push(`http_requests_total{${labels}} ${s.count}`);
    lines.push(`http_request_errors_total{${labels}} ${s.errorCount}`);
    let cumulative = 0;
    for (let i = 0; i < DURATION_BUCKETS.length; i++) {
      cumulative = s.bucketCounts[i];
      lines.push(`http_request_duration_seconds_bucket{${labels},le="${DURATION_BUCKETS[i]}"} ${cumulative}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labels},le="+Inf"} ${s.count}`);
    lines.push(`http_request_duration_seconds_sum{${labels}} ${s.bucketSum}`);
    lines.push(`http_request_duration_seconds_count{${labels}} ${s.count}`);
  }
  return lines.length > 6 ? `${lines.join('\n')}\n` : `${lines.join('\n')}\n`;
}
