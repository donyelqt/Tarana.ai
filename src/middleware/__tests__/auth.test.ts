import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { authMiddleware } from '../auth';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
}));

// jest.setup.js stubs global Response/Headers with classes that mangle
// NextResponse headers (location is unreadable), so this suite swaps in a
// faithful NextResponse shim. It mirrors the real contract used by the
// middleware (redirect → 307 + location; next → 200, no location), keeping
// the assertions on branching/URLs — the logic under test here.
jest.mock('next/server', () => {
  class MockHeaders {
    private store = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      if (init) {
        for (const [k, v] of Object.entries(init)) this.store.set(k.toLowerCase(), v);
      }
    }
    get(k: string): string | null {
      return this.store.get(k.toLowerCase()) ?? null;
    }
    set(k: string, v: string): void {
      this.store.set(k.toLowerCase(), v);
    }
  }
  class MockNextResponse {
    status: number;
    headers: MockHeaders;
    constructor(_body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.status = init?.status ?? 200;
      this.headers = new MockHeaders(init?.headers);
    }
    static redirect(url: string | URL, status = 307): MockNextResponse {
      const href = url instanceof URL ? url.toString() : url;
      return new MockNextResponse(null, { status, headers: { location: href } });
    }
    static next(): MockNextResponse {
      return new MockNextResponse(null, { status: 200 });
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class MockNextRequest {} };
});

const mockedGetToken = getToken as unknown as jest.Mock;

function makeRequest(path: string): NextRequest {
  // Hand-rolled request: authMiddleware only touches `nextUrl`/`url`, and
  // getToken is mocked, so a real NextRequest (broken under jest.setup.js's
  // Request stub) is unnecessary.
  const url = new URL(path, 'http://localhost');
  return { nextUrl: url, url: url.toString() } as unknown as NextRequest;
}

function callbackOf(location: string | null): string | null {
  if (!location) return null;
  return new URL(location).searchParams.get('callbackUrl');
}

describe('authMiddleware ToS consent gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
  });

  test('redirects unaccepted users on protected routes to /auth/consent', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: false });

    const res = await authMiddleware(makeRequest('/dashboard'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/consent');
    expect(callbackOf(res.headers.get('location'))).toBe('/dashboard');
  });

  test('preserves path and query in the consent callbackUrl', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: false });

    const res = await authMiddleware(makeRequest('/dashboard?tab=trips'));

    expect(res.status).toBe(307);
    expect(callbackOf(res.headers.get('location'))).toBe('/dashboard?tab=trips');
  });

  test('gates unaccepted users on non-protected, non-allowlisted paths too', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: false });

    const res = await authMiddleware(makeRequest('/some-page'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/consent');
  });

  test('treats a missing tosAccepted claim as not accepted (fail closed)', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1' });

    const res = await authMiddleware(makeRequest('/dashboard'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/consent');
  });

  test('lets accepted users through to protected routes', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: true });

    const res = await authMiddleware(makeRequest('/dashboard'));

    expect(res.headers.get('location')).toBeNull();
  });

  test.each([
    '/auth/consent',
    '/auth/consent?callbackUrl=%2Fdashboard',
    '/api/auth/session',
    '/api/auth/signout',
    '/terms',
    '/privacy',
    '/',
  ])('does not gate unaccepted users on allowlisted path %s', async (path) => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: false });

    const res = await authMiddleware(makeRequest(path));

    expect(res.headers.get('location')).toBeNull();
  });

  test('keeps existing behavior: anonymous users on protected routes go to signin', async () => {
    mockedGetToken.mockResolvedValue(null);

    const res = await authMiddleware(makeRequest('/dashboard'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });

  test('keeps existing behavior: anonymous users on public paths pass', async () => {
    mockedGetToken.mockResolvedValue(null);

    const res = await authMiddleware(makeRequest('/'));

    expect(res.headers.get('location')).toBeNull();
  });
});
