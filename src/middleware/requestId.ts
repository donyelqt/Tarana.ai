
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { logger } from '@/lib/observability/logger';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getRequestId(request: NextRequest): string {
  const incoming = request.headers.get('x-request-id');
  if (incoming && UUID_RE.test(incoming)) {
    return incoming;
  }
  return randomUUID();
}

export function requestIdMiddleware(request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
  const headers = new Headers(request.headers);
  headers.set('x-request-id', requestId);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('x-request-id', requestId);
  logger.info('request', { method: request.method, path: request.nextUrl.pathname }, requestId);
  return response;
}