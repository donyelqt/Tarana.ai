import { AppError, AppErrorCodes } from '@/lib/errors/AppError';

/**
 * Shared upstream timeout primitives (§3.2 invariant 4, §4 ¶2.2).
 *
 * Before this module, every call site hand-rolled its own timeout: a
 * `Promise.race` with a generic Error in `agent.ts`, bare
 * `AbortController`s in `tomtomRouting`/`imageService`/`tomtomTraffic`, and
 * nothing at all in `fetchWeatherData`. The failure mode that motivated the
 * shared helper is a hung upstream burning a request until Vercel's 60s
 * kill, surfacing as a 500. Every helper here fails fast with a typed
 * 503 instead.
 */

/** Typed timeout: 503, retryable, safe for clients. The log message keeps
 *  the word "timeout" so `handleApiError`'s classifier agrees even if this
 *  ever crosses a boundary as a plain Error. */
export class UpstreamTimeoutError extends AppError {
  public readonly upstream: string;
  public readonly timeoutMs: number;

  constructor(upstream: string, timeoutMs: number) {
    super(
      AppErrorCodes.UPSTREAM,
      'Upstream service unavailable',
      503,
      true,
      `${upstream} timed out after ${timeoutMs}ms`
    );
    this.name = 'UpstreamTimeoutError';
    this.upstream = upstream;
    this.timeoutMs = timeoutMs;
  }
}

/** Race an arbitrary promise (e.g. an SDK call like Gemini
 *  `generateContent`, which takes no AbortSignal) against a budget.
 *  Non-timeout rejections pass through untouched. */
export function withTimeout<T>(
  upstream: string,
  task: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamTimeoutError(upstream, timeoutMs)), timeoutMs);
  });

  return Promise.race([task, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/** fetch with an AbortController budget. An aborted (timed-out) request
 *  rejects with UpstreamTimeoutError; any other failure rethrows as-is. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  upstream = url
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new UpstreamTimeoutError(upstream, timeoutMs);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
