/**
 * Regression tests for GET /api/weather.
 *
 * Guards the 2026-09-03 incident: OpenWeather returned 400, the route wrapped
 * it in an opaque 500, and the client logged two console errors per failure
 * with no actionable detail. Contract now:
 * - garbage coordinates → 400, never proxied upstream
 * - missing key → 500 (our config bug)
 * - upstream failure → 502 with upstreamStatus + upstreamMessage passthrough
 */
import { GET } from '../route';

// jest.setup.js replaces global Response with a minimal mock that lacks the
// static json() NextResponse.json() delegates to. Restore just that static,
// test-locally (do NOT touch the shared setup).
const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<typeof globalThis.Response> & {
    status: number;
    json(): Promise<unknown>;
  };
  json(body: unknown, init?: { status?: number; headers?: Record<string, string> }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

const realKey = process.env.OPENWEATHER_API_KEY;

function mockFetchOnce(handler: (url: string) => unknown) {
  global.fetch = jest.fn(async (url: unknown) => handler(String(url))) as unknown as typeof fetch;
}

function get(url: string) {
  return GET(new Request(url) as unknown as Parameters<typeof GET>[0]);
}

describe('GET /api/weather', () => {
  beforeEach(() => {
    process.env.OPENWEATHER_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (realKey === undefined) delete process.env.OPENWEATHER_API_KEY;
    else process.env.OPENWEATHER_API_KEY = realKey;
  });

  it('rejects NaN coordinates with 400 without calling upstream', async () => {
    const spy = jest.fn();
    mockFetchOnce(spy);
    const res = await get('http://localhost:3000/api/weather?lat=abc&lon=120.6');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'Invalid coordinates' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('rejects out-of-range coordinates with 400', async () => {
    const spy = jest.fn();
    mockFetchOnce(spy);
    const res = await get('http://localhost:3000/api/weather?lat=999&lon=120.6');
    expect(res.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns 500 when the API key is not configured', async () => {
    delete process.env.OPENWEATHER_API_KEY;
    const spy = jest.fn();
    mockFetchOnce(spy);
    const res = await get('http://localhost:3000/api/weather?lat=16.4&lon=120.6');
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: 'Weather service not configured' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('maps an upstream 400 to 502 with upstream detail (the incident)', async () => {
    mockFetchOnce(() => ({
      ok: false,
      status: 400,
      text: async () => '{"cod":"400","message":"wrong latitude"}',
    }));
    const res = await get('http://localhost:3000/api/weather?lat=16.4&lon=120.6');
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe('Weather upstream error');
    expect(String(body.upstreamStatus)).toContain('400');
    expect(String(body.upstreamMessage)).toContain('wrong latitude');
  });

  it('passes upstream weather data through on 200', async () => {
    const payload = { name: 'Baguio', main: { temp: 17 } };
    mockFetchOnce(() => ({
      ok: true,
      status: 200,
      json: async () => payload,
    }));
    const res = await get('http://localhost:3000/api/weather?lat=16.4&lon=120.6');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(payload);
  });
});
