const MockedResponse = globalThis.Response as unknown as {
  new (body?: unknown, init?: { status?: number; headers?: Record<string, string> }): any;
  json(body: unknown, init?: { status?: number }): any;
};
if (typeof MockedResponse.json !== 'function') {
  MockedResponse.json = (body: unknown, init?: { status?: number }) =>
    new MockedResponse(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
}

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getToken } from 'next-auth/jwt';
import { rateLimiter } from '@/lib/security/rateLimiter';
import { encodeMobileToken } from '@/lib/auth/mobileToken';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
  encode: jest.fn(),
  decode: jest.fn(),
}));

jest.mock('@/lib/security/rateLimiter', () => ({
  rateLimiter: {
    checkRateLimit: jest.fn(),
  },
  rateLimitConfigs: { mobileToken: {} },
}));

jest.mock('@/lib/auth/mobileToken', () => ({
  encodeMobileToken: jest.fn(),
  decodeMobileToken: jest.fn(),
  isMobileTokenPayload: jest.fn(),
  MOBILE_TOKEN_MAX_AGE_SECONDS: 900,
}));

const mockedGetToken = getToken as unknown as jest.Mock;
const mockedRateLimit = rateLimiter.checkRateLimit as unknown as jest.Mock;
const mockedEncode = encodeMobileToken as unknown as jest.Mock;

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/auth/mobile-token', 'http://localhost');
  return { nextUrl: url, url: url.toString(), headers: new Headers(headers) } as unknown as NextRequest;
}

describe('POST /api/auth/mobile-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
    mockedRateLimit.mockReturnValue({ allowed: true, remaining: 4, retryAfter: 60 });
  });

  it('returns 429 when rate limited', async () => {
    mockedRateLimit.mockReturnValue({ allowed: false, remaining: 0, retryAfter: 120 });
    const res = await POST(makeRequest());
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Too many token requests');
    expect(body.retryAfter).toBe(120);
  });

  it('rejects bearer credentials — exchange requires a web session cookie', async () => {
    const res = await POST(makeRequest({ authorization: 'Bearer existing' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('web session cookie');
    expect(mockedGetToken).not.toHaveBeenCalled();
  });

  it('returns 401 when no session cookie is present', async () => {
    mockedGetToken.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockedGetToken).toHaveBeenCalledWith({ req: expect.anything(), secret: 'test-secret' });
  });

  it('returns 403 when the session has not accepted ToS', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', id: 'user-1', email: 'u@example.com', tosAccepted: false });
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Terms of Service');
    expect(mockedEncode).not.toHaveBeenCalled();
  });

  it('returns 401 when identity claims are missing', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', tosAccepted: true });
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockedEncode).not.toHaveBeenCalled();
  });

  it('issues a mobile token for an accepted web session', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', id: 'user-1', email: 'u@example.com', tosAccepted: true });
    mockedEncode.mockResolvedValue('encoded-mobile-jwt');

    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBe('encoded-mobile-jwt');
    expect(body.tokenType).toBe('Bearer');
    expect(body.userId).toBe('user-1');
    expect(mockedEncode).toHaveBeenCalledWith({
      sub: 'user-1',
      id: 'user-1',
      email: 'u@example.com',
      tosAccepted: true,
      mobile: true,
    });
  });

  it('returns 500 when encoding fails', async () => {
    mockedGetToken.mockResolvedValue({ sub: 'user-1', id: 'user-1', email: 'u@example.com', tosAccepted: true });
    mockedEncode.mockRejectedValue(new Error('boom'));
    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
  });
});