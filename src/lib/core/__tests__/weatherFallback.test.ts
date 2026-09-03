/**
 * The fallback object is the dashboard's only signal for WHY live weather is
 * missing — the badge renders fallbackReason verbatim. These pin that
 * contract: every failure mode must produce a specific, non-empty reason.
 */
import { fetchWeatherFromAPI, summariseProxyFailure } from '../utils';

describe('summariseProxyFailure', () => {
  it('extracts upstream detail from the route error shape', () => {
    expect(
      summariseProxyFailure(
        502,
        '{"error":"Weather upstream error","upstreamStatus":400,"upstreamMessage":"wrong latitude"}'
      )
    ).toBe('proxy 502 (upstream 400): wrong latitude');
  });

  it('falls back to the route error when no upstream detail exists', () => {
    expect(
      summariseProxyFailure(500, '{"error":"Weather service not configured"}')
    ).toBe('proxy 500: Weather service not configured');
  });

  it('handles non-JSON bodies without throwing', () => {
    expect(summariseProxyFailure(429, 'Too Many Requests')).toBe(
      'proxy 429: Too Many Requests'
    );
    expect(summariseProxyFailure(500, '')).toBe('proxy 500');
  });
});

describe('fetchWeatherFromAPI fallback reason', () => {
  it('tags the fallback with the proxy + upstream cause', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 502,
      text: async () =>
        '{"error":"Weather upstream error","upstreamStatus":400,"upstreamMessage":"wrong latitude"}',
    })) as unknown as typeof fetch;

    const data = await fetchWeatherFromAPI();
    expect(data?.isFallback).toBe(true);
    expect(data?.fallbackReason).toBe('proxy 502 (upstream 400): wrong latitude');
  });

  it('tags network-level failures as network', async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;

    const data = await fetchWeatherFromAPI();
    expect(data?.isFallback).toBe(true);
    expect(data?.fallbackReason).toBe('network');
  });
});
