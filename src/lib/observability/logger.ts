/**
 * Zero-dep structured logger.
 *
 * Emits JSON lines to stdout/stderr. Mirrors the zero-dep convention already
 * used by refundMetrics.ts: no external dependency, no cold-start state, works
 * in the Next.js Node runtime (middleware + route handlers) without any
 * install or lockfile churn.
 *
 * Every line carries `requestId` when one is supplied, so a single request can
 * be traced across middleware -> route -> service once callers pass the id
 * through. The id lives on the request (the `x-request-id` header), NOT in
 * module state: module-scoped context is racy under concurrent serverless
 * invocations, and Next.js middleware and route handlers are separate
 * invocations anyway, so nothing shared between them could be relied upon.
 *
 * Uses process.stdout/stderr.write directly rather than console.log so that
 * the repo-wide "no console.log outside tests" check (§5.1) still holds.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  requestId?: string;
  entryPoint?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';
const threshold = LOG_LEVELS[configuredLevel] ?? LOG_LEVELS.info;

function emit(entry: LogEntry): void {
  const line = JSON.stringify({ ...entry, timestamp: new Date().toISOString() });
  // stderr for warn+ so it does not interfere with stdout-based tooling.
  process[(entry.level === 'error' || entry.level === 'warn') ? 'stderr' : 'stdout'].write(
    `${line}\n`
  );
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.debug < threshold) return;
    emit({ level: 'debug', message, requestId, ...meta });
  },

  info(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.info < threshold) return;
    emit({ level: 'info', message, requestId, ...meta });
  },

  warn(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.warn < threshold) return;
    emit({ level: 'warn', message, requestId, ...meta });
  },

  error(message: string, meta?: Record<string, unknown>, requestId?: string): void {
    if (LOG_LEVELS.error < threshold) return;
    emit({ level: 'error', message, requestId, ...meta });
  },
};