import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';
import { getRequestId } from '@/middleware/requestId';
import { AppError, AppErrorCodes, type AppErrorCode } from '@/lib/errors/AppError';

export function handleApiError(error: unknown, request: NextRequest): NextResponse {
  const requestId = getRequestId(request);
  const appError = toAppError(error);

  logger.error(appError.safeMessage, { code: appError.code, retryable: appError.retryable }, requestId);

  const response = NextResponse.json(
    { error: appError.safeMessage },
    { status: appError.status }
  );
  response.headers.set('x-request-id', requestId);
  return response;
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof Error) {
    const message = error.message;
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