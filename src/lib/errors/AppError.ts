
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