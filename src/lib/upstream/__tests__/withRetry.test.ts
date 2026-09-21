import { AppError, AppErrorCodes } from '@/lib/errors/AppError';
import { UpstreamTimeoutError } from '../withTimeout';
import { withRetry } from '../withRetry';

describe('withRetry - success cases', () => {
  it('returns the value on first attempt when no retry needed', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success on transient failures', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockRejectedValueOnce(new Error('still down'))
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 5, jitter: 'none' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries with exponential backoff (jitter none)', async () => {
    // Verify backoff timing with jitter:'none' — delays are deterministic.
    // Uses 50ms/100ms to avoid CI runner scheduler flakiness at sub-ms scale.
    const timestamps: number[] = [];
    const fn = jest
      .fn()
      .mockImplementation(async () => {
        timestamps.push(performance.now());
        if (timestamps.length < 3) throw new Error('fail');
        return 'ok';
      });

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 50,
      factor: 2,
      maxDelayMs: 200,
      jitter: 'none',
    });

    expect(fn).toHaveBeenCalledTimes(3);
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];
    // gap1 should be ~50ms (baseDelayMs * 2^0), gap2 should be ~100ms (baseDelayMs * 2^1)
    expect(gap1).toBeGreaterThanOrEqual(40);
    expect(gap2).toBeGreaterThanOrEqual(80);
  });

  it('jitter=full keeps delay under maxDelayMs', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    // With full jitter, delay ∈ [0, baseDelayMs). We use a large baseDelayMs
    // with a small maxDelayMs cap, and a generous timeout to prove the
    // jittered delay is bounded.
    const start = performance.now();
    await withRetry(fn, { maxAttempts: 2, baseDelayMs: 500, factor: 2, maxDelayMs: 20, jitter: 'full' });
    const elapsed = performance.now() - start;

    expect(fn).toHaveBeenCalledTimes(2);
    // Should complete fast because the actual delay is jittered to ~0-20ms
    expect(elapsed).toBeLessThan(100);
  });
});

describe('withRetry - non-retryable errors', () => {
  it('fails immediately on retryable=false AppError (AUTH 401)', async () => {
    const authError = new AppError(AppErrorCodes.AUTH, 'Authentication required', 401, false);
    const fn = jest.fn().mockRejectedValue(authError);

    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 })).rejects.toBe(authError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('fails immediately on retryable=false AppError (NOT_FOUND 404)', async () => {
    const notFoundError = new AppError(AppErrorCodes.NOT_FOUND, 'Not found', 404, false);
    const fn = jest.fn().mockRejectedValue(notFoundError);

    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5 })).rejects.toBe(notFoundError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retryable=true AppError (UPSTREAM 503)', async () => {
    const upstreamError = new AppError(AppErrorCodes.UPSTREAM, 'Service unavailable', 503, true);
    const fn = jest.fn()
      .mockRejectedValueOnce(upstreamError)
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5, jitter: 'none' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries retryable=true AppError (RATE_LIMIT 429)', async () => {
    const rateLimitError = new AppError(AppErrorCodes.RATE_LIMIT, 'Rate limit exceeded', 429, true);
    const fn = jest.fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 5, jitter: 'none' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withRetry - exhaustion', () => {
  it('gives up after maxAttempts and wraps raw Error in AppError', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, jitter: 'none' }).catch((e) => e);
    // Raw errors are wrapped in AppError for consistent downstream handling
    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).code).toBe(AppErrorCodes.UPSTREAM);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error throw in AppError on exhaustion', async () => {
    const fn = jest.fn().mockRejectedValue('string error');
    const result = await withRetry(fn, { maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 5 }).catch((e) => e);
    expect(result).toBeInstanceOf(AppError);
    expect((result as AppError).code).toBe(AppErrorCodes.UPSTREAM);
  });

  it('retries non-Error throw on first attempt but not second', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce('string error')
      .mockRejectedValueOnce('string error again');

    const result = await withRetry(fn, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 5, jitter: 'none' }).catch((e) => e);
    expect(result).toBeInstanceOf(AppError);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withRetry - timeout integration', () => {
  it('composes with withTimeout: succeeds within timeout', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, {
      maxAttempts: 1,
      baseDelayMs: 1,
      maxDelayMs: 5,
      timeoutMs: 1000,
      upstream: 'gemini',
    });
    expect(result).toBe('ok');
  });

  it('retries when the timeout fires (recovers after one timeout)', async () => {
    const fn = jest
      .fn()
      .mockImplementationOnce(() => new Promise<string>(() => {})) // hangs → times out
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 5,
      timeoutMs: 50,
      upstream: 'gemini',
      jitter: 'none',
    });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws UpstreamTimeoutError after exhausting timeout retries', async () => {
    const fn = jest.fn().mockImplementation(() => new Promise<string>(() => {}));

    const result = await withRetry(fn, {
      maxAttempts: 2,
      baseDelayMs: 1,
      maxDelayMs: 5,
      timeoutMs: 50,
      upstream: 'gemini',
      jitter: 'none',
    }).catch((e) => e);

    expect(result).toBeInstanceOf(UpstreamTimeoutError);
    expect((result as UpstreamTimeoutError).status).toBe(503);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('withRetry - custom shouldRetry', () => {
  it('custom shouldRetry controls retry decisions', async () => {
    const error = new Error('specific error');
    const fn = jest.fn().mockRejectedValue(error);
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 5, shouldRetry })
    ).rejects.toMatchObject({ code: AppErrorCodes.UPSTREAM });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error, 1);
  });
});
