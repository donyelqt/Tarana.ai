/**
 * Regression suite for the middleware request-header forwarding contract.
 *
 * The bug: Next applies ONLY the final middleware response's
 * `x-middleware-override-headers` list and deletes every request header not
 * named in it (verified in next/dist/server/lib/router-utils/resolve-routes.js
 * and next/dist/server/web/spec-extension/response.js). A later middleware
 * returning a bare `NextResponse.next()` therefore discarded the request id
 * that `requestIdMiddleware` had forwarded, so the middleware's id and the
 * route handler's `getRequestId` diverged.
 *
 * This shim models that wire contract faithfully: `next({request:{headers}})`
 * serialises the headers into override + per-key entries, and `next()` with no
 * init emits no override list. `applyFinalResponse` then reproduces Next's
 * replace-all semantics so the assertions test the real failure mode.
 */
import { NextRequest } from 'next/server';

class ShimHeaders {
  public store = new Map<string, string>();
  constructor(init?: Headers | Record<string, string>) {
    if (init instanceof Headers) {
      for (const [k, v] of init.entries()) this.store.set(k.toLowerCase(), v as string);
    } else if (init) {
      for (const [k, v] of Object.entries(init)) this.store.set(k.toLowerCase(), v);
    }
  }
  get(k: string): string | null {
    return this.store.get(k.toLowerCase()) ?? null;
  }
  set(k: string, v: string): void {
    this.store.set(k.toLowerCase(), v);
  }
  delete(k: string): void {
    this.store.delete(k.toLowerCase());
  }
  has(k: string): boolean {
    return this.store.has(k.toLowerCase());
  }
  *[Symbol.iterator](): IterableIterator<[string, string]> {
    yield* [...this.store.entries()];
  }
  entries(): IterableIterator<[string, string]> {
    return this.store.entries();
  }
}

jest.mock('next/server', () => {
  class MockResponse {
    status: number;
    headers: ShimHeaders;
    constructor(_body?: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.status = init?.status ?? 200;
      this.headers = new ShimHeaders(init?.headers);
    }
    static next(init?: { request?: { headers?: unknown } }): MockResponse {
      const res = new MockResponse(null, { status: 200 });
      res.headers.set('x-middleware-next', '1');
      const incoming = init?.request?.headers;
      if (incoming) {
        const keys: string[] = [];
        const src = incoming as { entries: () => Iterable<[string, string]> };
        for (const [key, value] of src.entries()) {
          res.headers.set(`x-middleware-request-${key}`, value);
          keys.push(key);
        }
        res.headers.set('x-middleware-override-headers', keys.join(','));
      }
      return res;
    }
    static json(body: unknown, init?: { status?: number }): MockResponse {
      return new MockResponse(body, { status: init?.status ?? 200 });
    }
    static redirect(url: string | URL, status = 307): MockResponse {
      return new MockResponse(null, { status, headers: { location: String(url) } });
    }
  }
  return { NextResponse: MockResponse, NextRequest: class {} };
});

jest.mock('@/lib/observability/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { NextResponse } from 'next/server';
import { composeMiddleware } from '../compose';
import { requestIdMiddleware } from '../requestId';

type AnyResponse = InstanceType<typeof NextResponse> & { headers: ShimHeaders };

/** Reproduce Next's replace-all application of the final override list. */
function applyFinalResponse(
  response: AnyResponse,
  originalRequestHeaders: Record<string, string>
): Record<string, string> {
  const keys = response.headers.get('x-middleware-override-headers');
  if (!keys) return { ...originalRequestHeaders };
  const overridden = new Set(keys.split(',').map((k) => k.trim()).filter(Boolean));
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(originalRequestHeaders)) {
    if (overridden.has(key)) out[key] = value;
  }
  for (const key of overridden) {
    out[key] = response.headers.get(`x-middleware-request-${key}`) ?? '';
  }
  return out;
}

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  const url = new URL('/api/x', 'http://localhost');
  return {
    nextUrl: url,
    url: url.toString(),
    method: 'GET',
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe('middleware request-header forwarding', () => {
  test('a trailing bare next() no longer drops the forwarded request id', async () => {
    // Priority order: requestId (110) forwards the id, then a plain
    // middleware (50) returns a bare next() — the shape that used to wipe it.
    const handler = composeMiddleware({
      middlewares: [
        { handler: requestIdMiddleware, name: 'requestId', enabled: true, priority: 110 },
        {
          handler: () => NextResponse.next(),
          name: 'passthrough',
          enabled: true,
          priority: 50,
        },
      ],
      errorHandler: undefined,
    });

    const requestHeaders = { cookie: 'next-auth.session-token=abc' };
    const response = (await handler(makeRequest(requestHeaders))) as AnyResponse;
    const downstream = applyFinalResponse(response, requestHeaders);

    // The route handler must see the same id the middleware logged.
    expect(downstream['x-request-id']).toEqual(expect.any(String));
    expect(downstream['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    // The response echoes the same id for client-side correlation.
    expect(response.headers.get('x-request-id')).toBe(downstream['x-request-id']);
  });

  test('a middleware that forwards its own header does not lose the request id', async () => {
    const handler = composeMiddleware({
      middlewares: [
        { handler: requestIdMiddleware, name: 'requestId', enabled: true, priority: 110 },
        {
          // Mimics injectMobileCookie: replaces `cookie` and forwards headers.
          handler: (req: NextRequest) => {
            const headers = new Headers(req.headers);
            headers.set('cookie', 'next-auth.session-token=synthetic');
            return NextResponse.next({ request: { headers } });
          },
          name: 'syntheticCookie',
          enabled: true,
          priority: 10,
        },
      ],
      errorHandler: undefined,
    });

    const requestHeaders = { cookie: 'next-auth.session-token=abc' };
    const response = (await handler(makeRequest(requestHeaders))) as AnyResponse;
    const downstream = applyFinalResponse(response, requestHeaders);

    // Both survive: the union, not the last writer.
    expect(downstream['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
    expect(downstream.cookie).toBe('next-auth.session-token=synthetic');
  });

  test('a middleware that short-circuits still returns its own response untouched', async () => {
    const handler = composeMiddleware({
      middlewares: [
        { handler: requestIdMiddleware, name: 'requestId', enabled: true, priority: 110 },
        {
          handler: () => NextResponse.json({ error: 'nope' }, { status: 401 }),
          name: 'blocker',
          enabled: true,
          priority: 50,
        },
      ],
      errorHandler: undefined,
    });

    const response = (await handler(makeRequest())) as AnyResponse;
    expect(response.status).toBe(401);
    expect(response.headers.get('x-middleware-override-headers')).toBeNull();
  });

  test('a malformed or client-supplied uuid is replaced, not trusted', async () => {
    const handler = composeMiddleware({
      middlewares: [
        { handler: requestIdMiddleware, name: 'requestId', enabled: true, priority: 110 },
      ],
      errorHandler: undefined,
    });

    const requestHeaders = { 'x-request-id': 'not-a-uuid' };
    const response = (await handler(makeRequest(requestHeaders))) as AnyResponse;
    const downstream = applyFinalResponse(response, requestHeaders);

    expect(downstream['x-request-id']).not.toBe('not-a-uuid');
    expect(downstream['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
