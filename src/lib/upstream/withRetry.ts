
import { withTimeout } from './withTimeout';
import { AppError, AppErrorCodes } from '@/lib/errors/AppError';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
  jitter?: 'full' | 'none';
  timeoutMs?: number;
  upstream?: string;
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
  const raw = opts.baseDelayMs * Math.pow(opts.factor, attempt - 1);
  const capped = Math.min(raw, opts.maxDelayMs);
  if (opts.jitter === 'none') return capped;
  return Math.random() * capped;
}

function defaultShouldRetry(error: unknown, attempt: number): boolean {
  if (error instanceof AppError) {
    return error.retryable;
  }
  if (error instanceof Error) {
    return true;
  }
  return attempt === 1;
}

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

  if (lastError instanceof AppError) {
    throw lastError;
  }
  throw AppError.fromUnknown(lastError, AppErrorCodes.UPSTREAM);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
