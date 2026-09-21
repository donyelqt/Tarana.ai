/**
 * Shared upstream retry helper with exponential backoff + jitter (§3.2 invariant
 * 4, §4 ¶2.1).
 *
 * Zero-dep: composes with the existing `withTimeout` helper rather than pulling
 * in `async-retry` or `@retryable`, matching the repo's zero-dep convention in
 * `logger.ts` and `withTimeout.ts`.
 *
 * Retry policy:
 * - AppError with retryable=false (401 AUTH, 404 NOT_FOUND) fails immediately.
 * - AppError with retryable=true (UPSTREAM, RATE_LIMIT) is retried.
 * - Raw Error (network, abort, etc.) is retried — these are transient.
 * - Non-Error throws (strings, null, undefined) are retried on the first
 *   attempt only, since they give no signal about retryability and we cannot
 *   risk an infinite loop on a deterministic non-retryable throw.
 *
 * Each attempt optionally gets a timeout budget by composing with withTimeout:
 * passing `timeoutMs` + `upstream` wraps each attempt in
 * `withTimeout(upstream, fn(), timeoutMs)`.
 *
 * Jitter uses "full jitter" (AWS pattern): `random * cap`. This prevents the
 * thundering-herd problem where every retryer fires at the same instant after
 * a shared dependency recovers.
 */

import { withTimeout } from './withTimeout';
import { AppError, AppErrorCodes } from '@/lib/errors/AppError';

export interface RetryOptions {
  /** Total attempts including the first. Default: 3. */
  maxAttempts?: number;
  /** Base delay before the first retry. Default: 1000ms. */
  baseDelayMs?: number;
  /** Backoff multiplier. Default: 2 (1s, 2s, 4s, ...). */
  factor?: number;
  /** Maximum delay between attempts. Default: 30000ms. */
  maxDelayMs?: number;
  /** Jitter strategy: 'full' (default) = random in [0, cap); 'none' = fixed. */
  jitter?: 'full' | 'none';
  /** Per-attempt timeout in ms. If set, wraps each attempt with withTimeout. */
  timeoutMs?: number;
  /** Label passed to withTimeout when timeoutMs is set. */
  upstream?: string;
  /** Override the retryability check. Receives the error from the failed attempt. */
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULTS: Required<Omit<RetryOptions, 'shouldRetry' | 'timeoutMs' | 'upstream'>> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  factor: 2,
  maxDelayMs: 30000,
  jitter: 'full',
};

function delayFor(attempt: number, opts: Required<Omit<RetryOptions, 'shouldRetry' | 'timeoutMs' | 'upstream'>>): number {
  // attempt is 1-based for the first *retry* (i.e., attempt 2 of maxAttempts)
  const raw = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
  const capped = Math.min(raw, opts.maxDelayMs);
  if (opts.jitter === 'none') return capped;
  // Full jitter: random in [0, capped)
  return Math.random() * capped;
}

/**
 * Default retryability classifier.
 * - AppError.retryable === false → don't retry (client errors: 401, 404)
 * - AppError.retryable === true  → retry (upstream, rate limit)
 * - Error (raw) → retry (transient network)
 * - Non-Error on attempt > 1 → don't retry (no signal, can't risk deterministic loop)
 */
function defaultShouldRetry(error: unknown, attempt: number): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  if (error instanceof Error) {
    return true;
  }
  // Non-Error throw: retry only on the first attempt
  return attempt === 1;
}

/**
 * Run `fn` up to `maxAttempts` times with exponential backoff.
 *
 * `fn` is a factory (not a promise) so each retry gets a fresh invocation —
 * a promise can only be awaited once; passing a value would make retries
 * replay the same rejected promise.
 *
 * @throws The last error if all attempts fail.
 * @returns The value from the first successful attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULTS, ...options };
  const shouldRetry = opts.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    attempt++;
    try {
      if (opts.timeoutMs) {
        return await withTimeout(
          opts.upstream ?? 'unknown',
          fn(),
          opts.timeoutMs
        );
      }
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxAttempts) break;

      if (shouldRetry(error, attempt)) {
        const waitMs = delayFor(attempt, opts);
        await sleep(waitMs);
      } else {
        break;
      }
    }
  }

  // AppError throws as-is so downstream handlers see the typed error.
  // Raw errors get classified into AppError via fromUnknown for consistency.
  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw AppError.fromUnknown(lastError, AppErrorCodes.UPSTREAM);
}

/**
 * Sleep — uses the executor pattern because `Promise.withResolvers()` is not
 * available in Node 20 (the CI runtime). Matches `withTimeout.ts` convention.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
