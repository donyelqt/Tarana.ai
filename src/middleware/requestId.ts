/**
 * Request ID middleware.
 *
 * Generates a UUID per request, echoes it back as the `x-request-id`
 * response header, and stashes it on the request so every downstream
 * middleware and the route handler can read it.
 *
 * Why a header and not module state: Next.js middleware and the route handler
 * that serves the request are separate serverless invocations. Nothing shared
 * between them survives, so the only reliable handoff is a request header.
 * Handlers read the id from `request.headers.get('x-request-id')` and pass it
 * explicitly to the logger.
 *
 * The id is generated here rather than accepted blindly from the client: a
 * client-supplied id is a trivial DoS vector (attacker controls log volume and
 * correlation). We accept a client value only when it is a well-formed UUID,
 * otherwise we generate one — keeps distributed tracing honest without
 * opening the door to arbitrary strings.
 */

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
  // Stamp the request itself so downstream handlers see the id without any
  // shared state — middleware and route handlers are separate invocations.
  request.headers.set('x-request-id', requestId);
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  logger.info('request', { method: request.method, path: request.nextUrl.pathname }, requestId);
  return response;
}