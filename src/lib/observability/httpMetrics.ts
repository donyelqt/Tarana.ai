
export type StatusClass = '2xx' | '4xx' | '5xx';

export interface HttpObservation {
  route: string;
  method: string;
  statusClass: StatusClass;
  durationSeconds: number;
}

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

function esc(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

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
