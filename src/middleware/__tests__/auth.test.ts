import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { authMiddleware } from '../auth';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
  encode: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('next/server', () => {
  class MockHeaders {
    public store = new Map<string, string>();
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
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, { status: init?.status ?? 200 });
    }
    static next(_init?: { request?: { headers?: Headers } }): MockNextResponse {
      const headers = _init?.request?.headers
        ? new MockHeaders(Object.fromEntries((_init.request.headers.entries() as Iterable<[string, string]>)))
        : new MockHeaders();
      return new MockNextResponse(null, { status: 200, headers: Object.fromEntries(headers.store) });
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class MockNextRequest {} };
});

const mockedGetToken = getToken as unknown as jest.Mock;

function makeRequest(path: string): NextRequest {
  const url = new URL(path, 'http://localhost');
  return { nextUrl: url, url: url.toString(), headers: new Headers() } as unknown as NextRequest;
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

  test('rejects ambiguous requests that carry both a cookie and a bearer token', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: true });

    const res = await authMiddleware(
      makeRequestWithHeaders('/dashboard', { cookie: 'next-auth.session-token=abc', authorization: 'Bearer mobile' })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });

  test('redirects to signin when the bearer token is invalid', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue(null);

    const res = await authMiddleware(
      makeRequestWithHeaders('/dashboard', { authorization: 'Bearer garbage' })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });

  test('returns JSON 403 for an unaccepted ToS on API routes', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: false });

    const res = await authMiddleware(makeRequest('/api/trips'));

    expect(res.status).toBe(403);
    expect(res.headers.get('location')).toBeNull();
  });

  test('rejects a mobile bearer token carrying an unaccepted ToS as invalid', async () => {
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: false,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', { authorization: 'Bearer abc123.jwt.token' })
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('location')).toBeNull();
  });

  test('rejects a mobile bearer token on UI routes — bearer tokens are API-only', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/dashboard', { authorization: 'Bearer abc123.jwt.token' })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });

  test('accepts a mobile bearer token on API routes and injects the raw JWT', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', { authorization: 'Bearer abc123.jwt.token' })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('cookie')).toBe('next-auth.session-token=abc123.jwt.token');
  });

  test('returns JSON 401 for an invalid bearer token on API routes', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue(null);

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', { authorization: 'Bearer garbage' })
    );

    expect(res.status).toBe(401);
    expect(res.headers.get('location')).toBeNull();
  });

  test('returns JSON 401 for an ambiguous cookie+bearer request on API routes', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: true });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', {
        cookie: 'next-auth.session-token=abc',
        authorization: 'Bearer abc123.jwt.token',
      })
    );

    expect(res.status).toBe(401);
  });

  test('ignores an unrelated cookie when deciding ambiguity', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', {
        cookie: 'csrf=token; tracking=1',
        authorization: 'Bearer abc123.jwt.token',
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cookie')).toBe('next-auth.session-token=abc123.jwt.token');
  });

  test('uses the __Secure- cookie prefix when the deployment is HTTPS', async () => {
    process.env.NEXTAUTH_URL = 'https://tarana.ai';
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', { authorization: 'Bearer abc123.jwt.token' })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cookie')).toBe('__Secure-next-auth.session-token=abc123.jwt.token');
  });

  test('uses the __Secure- cookie prefix under AUTH_TRUST_HOST even without NEXTAUTH_URL', async () => {
    delete process.env.NEXTAUTH_URL;
    process.env.AUTH_TRUST_HOST = 'true';
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue({
      sub: 'user-1',
      id: 'user-1',
      email: 'user@example.com',
      tosAccepted: true,
      mobile: true,

      pwdChangedAt: null,
    });

    const res = await authMiddleware(
      makeRequestWithHeaders('/api/trips', { authorization: 'Bearer abc123.jwt.token' })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cookie')).toBe('__Secure-next-auth.session-token=abc123.jwt.token');
  });

  test('redirects to signin when the mobile token has expired', async () => {
    mockedGetToken.mockResolvedValue(null);
    const { decode } = require('next-auth/jwt') as { decode: jest.Mock };
    decode.mockResolvedValue(null);

    const res = await authMiddleware(
      makeRequestWithHeaders('/dashboard', { authorization: 'Bearer expired' })
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/auth/signin');
  });
});

function makeRequestWithHeaders(path: string, headers: Record<string, string>): NextRequest {
  const url = new URL(path, 'http://localhost');
  return { nextUrl: url, url: url.toString(), headers: new Headers(headers) } as unknown as NextRequest;
}
