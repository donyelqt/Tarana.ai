const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): InstanceType<
    typeof globalThis.Response
  >;
  json(body: unknown, init?: { status?: number }): unknown;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

import { GET } from '../route';

const okFetch = (status = 200) =>
  jest.fn().mockResolvedValue({ status, json: async () => ({}) });

describe('GET /api/health contract', () => {
  const env = process.env;
  let fetchSpy: jest.SpyInstance;
  beforeEach(() => {
    process.env = {
      ...env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://contract-test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'contract-anon-key',
      GOOGLE_GEMINI_API_KEY: 'contract-gemini-key',
      TOMTOM_API_KEY: 'contract-tomtom-key',
    };
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(okFetch());
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    process.env = env;
  });

  it('answers 200 with the status/checks/timestamp envelope when all checks pass', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: unknown;
      checks?: Record<string, unknown>;
      timestamp?: unknown;
    };
    expect(body.status).toBe('ok');
    expect(body.checks).toMatchObject({
      supabase: 'ok',
      geminiKey: 'ok',
      tomtom: 'ok',
    });
    expect(body.timestamp).toEqual(expect.stringMatching(/^\d{4}-/));
  });

  it('stays 200 with a degraded status when a dependency check fails', async () => {
    fetchSpy.mockImplementation(okFetch(500));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: unknown;
      checks?: Record<string, unknown>;
    };
    expect(body.status).toBe('degraded');
    expect(body.checks).toMatchObject({
      supabase: 'fail',
      geminiKey: 'ok',
      tomtom: 'fail',
    });
  });

  it('bounds every check value to the ok/fail contract', async () => {
    const res = await GET();
    const body = (await res.json()) as { checks?: Record<string, unknown> };
    expect(Object.keys(body.checks ?? {}).sort()).toEqual(['geminiKey', 'supabase', 'tomtom']);
    for (const value of Object.values(body.checks ?? {})) {
      expect(value).toEqual(expect.stringMatching(/^(ok|fail)$/));
    }
  });

  it('marks missing keys as fail without calling the network', async () => {
    delete process.env.GOOGLE_GEMINI_API_KEY;
    delete process.env.TOMTOM_API_KEY;
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { checks?: Record<string, unknown> };
    expect(body.checks).toMatchObject({ geminiKey: 'fail', tomtom: 'fail' });
  });
});
