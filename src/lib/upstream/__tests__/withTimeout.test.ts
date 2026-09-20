import { AppError, AppErrorCodes } from '@/lib/errors/AppError';
import {
  fetchWithTimeout,
  UpstreamTimeoutError,
  withTimeout,
} from '../withTimeout';

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('UpstreamTimeoutError', () => {
  it('is a retryable 503 UPSTREAM AppError', () => {
    const error = new UpstreamTimeoutError('gemini', 20000);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(UpstreamTimeoutError);
    expect(error.code).toBe(AppErrorCodes.UPSTREAM);
    expect(error.status).toBe(503);
    expect(error.retryable).toBe(true);
    expect(error.safeMessage).toBe('Upstream service unavailable');
    expect(error.logMessage).toContain('gemini');
    expect(error.logMessage).toContain('20000');
  });
});

describe('withTimeout', () => {
  it('resolves the task value when fast', async () => {
    await expect(withTimeout('fast', Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('rejects with UpstreamTimeoutError when the task hangs', async () => {
    const hanging = new Promise<string>(() => {});
    const failure = withTimeout('gemini', hanging, 30).then(
      () => { throw new Error('should have timed out'); },
      (error: unknown) => error
    );

    const error = await failure;
    expect(error).toBeInstanceOf(UpstreamTimeoutError);
    const timeout = error as UpstreamTimeoutError;
    expect(timeout.status).toBe(503);
    expect(timeout.retryable).toBe(true);
    expect(timeout.upstream).toBe('gemini');
    expect(timeout.timeoutMs).toBe(30);
  });

  it('passes non-timeout rejections through untouched', async () => {
    const cause = new Error('upstream says no');
    await expect(withTimeout('x', Promise.reject(cause), 1000)).rejects.toBe(cause);
  });
});

describe('fetchWithTimeout', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('returns the response when fast', async () => {
    const response = new Response('{}', { status: 200 });
    globalThis.fetch = jest.fn().mockResolvedValue(response) as unknown as typeof fetch;

    await expect(fetchWithTimeout('https://x.test', {}, 1000)).resolves.toBe(response);
  });

  it('rejects with UpstreamTimeoutError when the fetch hangs', async () => {
    globalThis.fetch = jest.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    ) as unknown as typeof fetch;

    const failure = fetchWithTimeout('https://slow.test', {}, 30, 'tomtom').then(
      () => { throw new Error('should have timed out'); },
      (error: unknown) => error
    );

    const error = await failure;
    expect(error).toBeInstanceOf(UpstreamTimeoutError);
    expect((error as UpstreamTimeoutError).status).toBe(503);
  });

  it('passes non-abort fetch failures through untouched', async () => {
    const cause = new TypeError('network down');
    globalThis.fetch = jest.fn().mockRejectedValue(cause) as unknown as typeof fetch;

    await expect(fetchWithTimeout('https://x.test', {}, 1000)).rejects.toBe(cause);
  });

  it('hanging fetch does not hold the test past the budget', async () => {
    globalThis.fetch = jest.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    ) as unknown as typeof fetch;

    const start = Date.now();
    await expect(fetchWithTimeout('https://slow.test', {}, 30)).rejects.toBeInstanceOf(
      UpstreamTimeoutError
    );
    expect(Date.now() - start).toBeLessThan(5000);
    await tick(0);
  });
});
