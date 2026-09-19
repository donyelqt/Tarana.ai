/**
 * Repo-wide typed error.
 *
 * Carries the fields a route handler needs to log safely and respond safely:
 * - `code`     — stable machine-readable identifier (e.g. "DB_CONNECTION")
 * - `status`   — HTTP status to return
 * - `safeMessage` — client-safe message, never a stack trace or raw error
 * - `retryable` — whether the caller should retry
 * - `logMessage` — what to write to the structured logger
 *
 * The response body stays `{ error: string }`. The typed metadata lives on
 * the thrown object and is consumed by handleApiError for logging — it is
 * never serialized into the response. This keeps the wire shape stable for
 * every existing client (savedItineraries.ts:91-92 and supabaseMeals.ts:26
 * both read `body.error` as a string).
 */

export const AppErrorCodes = {
  VALIDATION: 'VALIDATION',
  AUTH: 'AUTH',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT: 'RATE_LIMIT',
  UPSTREAM: 'UPSTREAM',
  DB: 'DB',
  UNKNOWN: 'UNKNOWN',
} as const;

export type AppErrorCode = (typeof AppErrorCodes)[keyof typeof AppErrorCodes];

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly status: number;
  public readonly safeMessage: string;
  public readonly retryable: boolean;
  public readonly logMessage: string;

  constructor(
    code: AppErrorCode,
    safeMessage: string,
    status: number = 500,
    retryable: boolean = false,
    logMessage?: string
  ) {
    super(safeMessage);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
    this.retryable = retryable;
    this.logMessage = logMessage ?? safeMessage;
  }

  static validation(message: string): AppError {
    return new AppError(AppErrorCodes.VALIDATION, message, 400, false);
  }

  static unauthorized(message: string = 'Authentication required'): AppError {
    return new AppError(AppErrorCodes.AUTH, message, 401, false);
  }

  static notFound(message: string = 'Not found'): AppError {
    return new AppError(AppErrorCodes.NOT_FOUND, message, 404, false);
  }

  static rateLimit(message: string = 'Rate limit exceeded'): AppError {
    return new AppError(AppErrorCodes.RATE_LIMIT, message, 429, true);
  }

  static upstream(message: string = 'Upstream service unavailable', retryable = true): AppError {
    return new AppError(AppErrorCodes.UPSTREAM, message, 503, retryable);
  }

  static fromUnknown(error: unknown, fallbackCode: AppErrorCode = AppErrorCodes.UNKNOWN): AppError {
    if (error instanceof AppError) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new AppError(fallbackCode, 'Internal server error', 500, false, message);
  }
}