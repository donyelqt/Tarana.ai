import { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/rateLimiter';
import { encodeMobileToken } from '../mobileToken';
import { runMobileTokenExchange } from '../mobileTokenExchange';

jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn(),
  encode: jest.fn(),
  decode: jest.fn(),
}));

// Faithful NextResponse shim mirroring the contract used by the exchange
// (redirect → 302 + location; json → status + body), so assertions stay on
// behavior rather than on a Next.js internal that is mangled by jest.setup.
jest.mock('next/server', () => {
  class MockHeaders {
    public store = new Map<string, string>();
    constructor(init?: Record<string, string>) {
      if (init) for (const [k, v] of Object.entries(init)) this.store.set(k.toLowerCase(), v);
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
    body: unknown;
    constructor(body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new MockHeaders(init?.headers);
    }
    static redirect(url: string | URL, status = 302): MockNextResponse {
      const href = url instanceof URL ? url.toString() : url;
      return new MockNextResponse(null, { status, headers: { location: href } });
    }
    static json(body: unknown, init?: { status?: number }): MockNextResponse {
      return new MockNextResponse(body, { status: init?.status ?? 200 });
    }
  }
  return { NextResponse: MockNextResponse, NextRequest: class MockNextRequest {} };
});

jest.mock('@/lib/security/rateLimiter', () => ({
  rateLimiter: { checkRateLimit: jest.fn() },
  rateLimitConfigs: { mobileToken: { windowMs: 900000, maxRequests: 5, blockDurationMs: 3600000 } },
}));

jest.mock('@/lib/auth/mobileToken', () => ({
  encodeMobileToken: jest.fn(),
  MOBILE_TOKEN_MAX_AGE_SECONDS: 900,
}));

const mockedGetToken = getToken as unknown as jest.Mock;
const mockedEncode = encodeMobileToken as unknown as jest.Mock;
const mockedCheck = rateLimiter.checkRateLimit as unknown as jest.Mock;

const SESSION = { id: 'user-1', sub: 'user-1', email: 'u@example.com', tosAccepted: true, mobile: false };

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return { headers: new Map(Object.entries(headers)) } as unknown as NextRequest;
}

describe('runMobileTokenExchange', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_SECRET = 'test-secret';
    mockedCheck.mockReturnValue({ allowed: true, remaining: 4, resetTime: 0 });
    mockedEncode.mockResolvedValue('issued-jwt');
  });

  it('issues a token in JSON form when no redirectUrl is given', async () => {
    mockedGetToken.mockResolvedValue(SESSION);
    const req = makeRequest();

    const result = await runMobileTokenExchange({ req });

    if (!('value' in result)) throw new Error('expected value, got response');
    expect(result.value).toEqual({
      success: true,
      token: 'issued-jwt',
      tokenType: 'Bearer',
      expiresIn: 900,
      userId: 'user-1',
    });
    expect(mockedCheck).toHaveBeenCalledWith(req, expect.anything(), 'mobile-token');
  });

  it('redirects to the mobile scheme with the token in the query string', async () => {
    mockedGetToken.mockResolvedValue(SESSION);

    const result = await runMobileTokenExchange({
      req: makeRequest(),
      redirectUrl: 'tarana-mobile://auth/exchange',
    });

    if (!('response' in result)) throw new Error('expected response, got value');
    expect(result.response.status).toBe(302);
    const location = result.response.headers.get('location');
    expect(location).toContain('tarana-mobile://auth/exchange');
    expect(location).toContain('token=issued-jwt');
    expect(location).toContain('userId=user-1');
  });

  it('rejects a bearer header — exchange is web-session-only', async () => {
    const req = makeRequest({ authorization: 'Bearer mobile-jwt' });

    const result = await runMobileTokenExchange({ req });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(401);
    expect(mockedGetToken).not.toHaveBeenCalled();
  });

  it('rejects when there is no session', async () => {
    mockedGetToken.mockResolvedValue(null);

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(401);
    expect(mockedEncode).not.toHaveBeenCalled();
  });

  it('rejects a mobile token being re-exchanged', async () => {
    mockedGetToken.mockResolvedValue({ ...SESSION, mobile: true });

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(401);
    expect(mockedEncode).not.toHaveBeenCalled();
  });

  it('rejects when tosAccepted is false', async () => {
    mockedGetToken.mockResolvedValue({ ...SESSION, tosAccepted: false });

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(403);
  });

  it('rejects when identity claims are missing', async () => {
    mockedGetToken.mockResolvedValue({ tosAccepted: true, mobile: false });

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    mockedCheck.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetTime: 0,
      retryAfter: 60,
    });

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(429);
    expect(mockedGetToken).not.toHaveBeenCalled();
  });

  it('returns 500 when NEXTAUTH_SECRET is missing', async () => {
    delete process.env.NEXTAUTH_SECRET;
    mockedGetToken.mockResolvedValue(SESSION);

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(500);
  });

  it('returns 500 when token encoding fails', async () => {
    mockedGetToken.mockResolvedValue(SESSION);
    mockedEncode.mockRejectedValue(new Error('boom'));

    const result = await runMobileTokenExchange({ req: makeRequest() });
    if (!('response' in result)) throw new Error('expected response');
    expect(result.response.status).toBe(500);
  });
});