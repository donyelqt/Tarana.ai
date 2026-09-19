import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { AppError, AppErrorCodes, type AppErrorCode } from '@/lib/errors/AppError';

/**
 * Single error-to-response mapper for every API route.
 *
 * Usage in a route catch block:
 *   } catch (error) {
 *     return handleApiError(error, request);
 *   }
 *
 * Behaviour:
 * - Logs the error through the structured logger with the request's
 *   correlation ID. Never logs raw stack traces to the client.
 * - Returns `{ error: string }` with the AppError status. The wire shape
 *   stays a string so existing clients (savedItineraries.ts:91-92,
 *   supabaseMeals.ts:26) keep working.
 * - The typed metadata (code, retryable, logMessage) is consumed here for
 *   logging and status selection; it is not serialized into the response.
 */
export function handleApiError(error: unknown, request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
  const appError = toAppError(error);

  logger.error(appError.logMessage, { code: appError.code, retryable: appError.retryable }, requestId);

  const response = NextResponse.json(
    { error: appError.safeMessage },
    { status: appError.status }
  );
  // NextResponse.json does not inherit request headers — set the correlation
  // id explicitly so the client and downstream tooling can trace the request.
  response.headers.set('x-request-id', requestId);
  return response;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    const message = error.message;
    // Classify common upstream/infra shapes so callers get a typed status
    // instead of a blanket 500.
    if (/rate limit|too many requests/i.test(message)) {
      return new AppError(AppErrorCodes.RATE_LIMIT, 'Rate limit exceeded', 429, true, message);
    }
    if (/timeout|timed out/i.test(message)) {
      return new AppError(AppErrorCodes.UPSTREAM, 'Upstream service unavailable', 503, true, message);
    }
    if (/not authorized|unauthori[sz]ed|not authenticated/i.test(message)) {
      return new AppError(AppErrorCodes.AUTH, 'Authentication required', 401, false, message);
    }
    if (/not found/i.test(message)) {
      return new AppError(AppErrorCodes.NOT_FOUND, 'Not found', 404, false, message);
    }
    return new AppError(AppErrorCodes.UNKNOWN, 'Internal server error', 500, false, message);
  }

  return new AppError(AppErrorCodes.UNKNOWN, 'Internal server error', 500, false, String(error));
}

export type { AppErrorCode };