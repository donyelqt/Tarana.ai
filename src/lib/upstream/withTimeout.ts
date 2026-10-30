import { AppError, AppErrorCodes } from '@/lib/errors/AppError';


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
