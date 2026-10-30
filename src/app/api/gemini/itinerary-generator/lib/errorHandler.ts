
import { withRetry as sharedWithRetry } from '../../../../../lib/upstream/withRetry';
import { logger } from "../../../../../lib/observability/logger";

export enum ErrorType {
  VALIDATION = 'VALIDATION',
  API_KEY = 'API_KEY', 
  GENERATION = 'GENERATION',
  PARSING = 'PARSING',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN'
}

export interface ErrorDetails {
  type: ErrorType;
  message: string;
  originalError?: any;
  requestId?: string;
  timestamp: number;
  retryable: boolean;
}

export class ItineraryError extends Error {
  public readonly type: ErrorType;
  public readonly retryable: boolean;
  public readonly requestId?: string;
  public readonly timestamp: number;

  constructor(type: ErrorType, message: string, retryable: boolean = false, requestId?: string) {
    super(message);
    this.name = 'ItineraryError';
    this.type = type;
    this.retryable = retryable;
    this.requestId = requestId;
    this.timestamp = Date.now();
  }
}

export class ErrorHandler {
  private static errorStats = new Map<ErrorType, number>();

  static handleError(error: any, requestId?: string): ErrorDetails {
    const timestamp = Date.now();
    let errorType: ErrorType;
    let message: string;
    let retryable = false;

    if (error.message?.includes('API key') || error.status === 401) {
      errorType = ErrorType.API_KEY;
      message = 'Invalid or missing API key';
      retryable = false;
    } else if (error.message?.includes('JSON') || error.message?.includes('parse')) {
      errorType = ErrorType.PARSING;
      message = 'Failed to parse AI response';
      retryable = true;
    } else if (error.status === 429 || error.message?.includes('rate limit')) {
      errorType = ErrorType.RATE_LIMIT;
      message = 'Rate limit exceeded';
      retryable = true;
    } else if (error.status === 503 || error.message?.includes('timeout')) {
      errorType = ErrorType.TIMEOUT;
      message = 'Service temporarily unavailable';
      retryable = true;
    } else if (error.message?.includes('validation') || error.message?.includes('schema')) {
      errorType = ErrorType.VALIDATION;
      message = 'Invalid data structure';
      retryable = true;
    } else if (error.message?.includes('generate') || error.message?.includes('content')) {
      errorType = ErrorType.GENERATION;
      message = 'Failed to generate content';
      retryable = true;
    } else {
      errorType = ErrorType.UNKNOWN;
      message = error.message || 'Unknown error occurred';
      retryable = true;
    }

    this.errorStats.set(errorType, (this.errorStats.get(errorType) || 0) + 1);

    logger.error(`[ErrorHandler] ${errorType}:`, { entryPoint: 'errorHandler', message,
      requestId,
      timestamp,
      retryable,
      originalError: error.message });

    return {
      type: errorType,
      message,
      originalError: error,
      requestId,
      timestamp,
      retryable
    };
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastClassified: ItineraryError | null = null;

    try {
      return await sharedWithRetry(
        async () => {
          try {
            return await operation();
          } catch (error) {
            const errorDetails = ErrorHandler.handleError(error);
            lastClassified = new ItineraryError(
              errorDetails.type,
              errorDetails.message,
              errorDetails.retryable
            );
            throw lastClassified;
          }
        },
        {
          maxAttempts: maxRetries,
          baseDelayMs: baseDelay,
          factor: 2,
          jitter: 'none', 
          upstream: 'gemini-itinerary',
          shouldRetry: (error) => {
            return error instanceof ItineraryError ? error.retryable : true;
          },
        }
      );
    } catch {
      if (lastClassified) throw lastClassified;
      throw new ItineraryError(ErrorType.UNKNOWN, 'Unknown error occurred', true);
    }
  }

  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorStats);
  }

  static resetStats(): void {
    this.errorStats.clear();
  }

  static createErrorResponse(error: ErrorDetails) {
    return {
      success: false,
      error: {
        type: error.type,
        message: error.message,
        requestId: error.requestId,
        timestamp: error.timestamp,
        retryable: error.retryable
      },
      data: null
    };
  }
}
