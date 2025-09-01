/**
 * Comprehensive error handler for itinerary generation
 * Provides structured error handling with retry logic and fallback mechanisms
 */

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

  /**
   * Handle and classify errors with appropriate response
   */
  static handleError(error: any, requestId?: string): ErrorDetails {
    const timestamp = Date.now();
    let errorType: ErrorType;
    let message: string;
    let retryable = false;

    // Classify error type
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

    // Update statistics
    this.errorStats.set(errorType, (this.errorStats.get(errorType) || 0) + 1);

    // Log error details
    console.error(`[ErrorHandler] ${errorType}:`, {
      message,
      requestId,
      timestamp,
      retryable,
      originalError: error.message
    });

    return {
      type: errorType,
      message,
      originalError: error,
      requestId,
      timestamp,
      retryable
    };
  }

  /**
   * Retry logic with exponential backoff
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const errorDetails = this.handleError(error);

        if (!errorDetails.retryable || attempt === maxRetries) {
          throw new ItineraryError(
            errorDetails.type,
            errorDetails.message,
            errorDetails.retryable
          );
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.warn(`[ErrorHandler] Retry ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorStats);
  }

  /**
   * Reset error statistics
   */
  static resetStats(): void {
    this.errorStats.clear();
  }

  /**
   * Create structured error response
   */
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
