/**
 * Comprehensive Error Handler for Food Recommendations
 * Enterprise-grade error handling with typed errors and retry logic
 */

export enum FoodErrorType {
  VALIDATION = 'VALIDATION',
  API_KEY = 'API_KEY', 
  GENERATION = 'GENERATION',
  PARSING = 'PARSING',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  NETWORK = 'NETWORK'
}

export interface FoodError {
  type: FoodErrorType;
  message: string;
  details?: any;
  requestId: string;
  timestamp: number;
  retryable: boolean;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<FoodErrorType, number>;
  lastError?: FoodError;
}

export class FoodRecommendationErrorHandler {
  private static errorStats: ErrorStats = {
    totalErrors: 0,
    errorsByType: {
      [FoodErrorType.VALIDATION]: 0,
      [FoodErrorType.API_KEY]: 0,
      [FoodErrorType.GENERATION]: 0,
      [FoodErrorType.PARSING]: 0,
      [FoodErrorType.TIMEOUT]: 0,
      [FoodErrorType.RATE_LIMIT]: 0,
      [FoodErrorType.NETWORK]: 0
    }
  };

  /**
   * Handle errors with automatic retry logic
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: FoodError | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const foodError = this.createError(error, context);
        lastError = foodError;
        
        this.logError(foodError);
        
        // Don't retry non-retryable errors
        if (!foodError.retryable || attempt === maxRetries) {
          break;
        }
        
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        console.log(`🔄 Retrying ${context} in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }

  /**
   * Create structured error from any error type
   */
  static createError(error: any, context: string): FoodError {
    const requestId = this.generateRequestId();
    let errorType: FoodErrorType;
    let message: string;
    let retryable = false;

    // Classify error type
    if (error?.message?.includes('API key')) {
      errorType = FoodErrorType.API_KEY;
      message = 'Invalid or missing Google Gemini API key';
      retryable = false;
    } else if (error?.message?.includes('JSON') || error?.name === 'SyntaxError') {
      errorType = FoodErrorType.PARSING;
      message = `JSON parsing failed: ${error.message}`;
      retryable = true;
    } else if (error?.message?.includes('timeout') || error?.code === 'ETIMEDOUT') {
      errorType = FoodErrorType.TIMEOUT;
      message = 'Request timeout - API took too long to respond';
      retryable = true;
    } else if (error?.message?.includes('rate limit') || error?.status === 429) {
      errorType = FoodErrorType.RATE_LIMIT;
      message = 'Rate limit exceeded - too many requests';
      retryable = true;
    } else if (error?.code === 'ENOTFOUND' || error?.code === 'ECONNREFUSED') {
      errorType = FoodErrorType.NETWORK;
      message = 'Network connectivity issue';
      retryable = true;
    } else if (error?.message?.includes('validation') || error?.message?.includes('required')) {
      errorType = FoodErrorType.VALIDATION;
      message = `Validation error: ${error.message}`;
      retryable = false;
    } else {
      errorType = FoodErrorType.GENERATION;
      message = error?.message || 'Unknown error during food recommendation generation';
      retryable = true;
    }

    const foodError: FoodError = {
      type: errorType,
      message,
      details: {
        originalError: error?.message,
        stack: error?.stack,
        context,
        timestamp: new Date().toISOString()
      },
      requestId,
      timestamp: Date.now(),
      retryable
    };

    // Update statistics
    this.updateStats(foodError);

    return foodError;
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: FoodError): void {
    const logLevel = this.getLogLevel(error.type);
    const logMessage = `🚨 [${error.type}] ${error.message} (ID: ${error.requestId})`;
    
    switch (logLevel) {
      case 'error':
        console.error(logMessage, error.details);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
    }
  }

  /**
   * Create user-friendly error response
   */
  static createErrorResponse(error: FoodError) {
    const userMessage = this.getUserFriendlyMessage(error.type);
    
    return {
      error: userMessage,
      type: error.type,
      requestId: error.requestId,
      retryable: error.retryable,
      timestamp: error.timestamp
    };
  }

  /**
   * Get error statistics
   */
  static getStats(): ErrorStats {
    return { ...this.errorStats };
  }

  /**
   * Reset error statistics
   */
  static resetStats(): void {
    this.errorStats = {
      totalErrors: 0,
      errorsByType: {
        [FoodErrorType.VALIDATION]: 0,
        [FoodErrorType.API_KEY]: 0,
        [FoodErrorType.GENERATION]: 0,
        [FoodErrorType.PARSING]: 0,
        [FoodErrorType.TIMEOUT]: 0,
        [FoodErrorType.RATE_LIMIT]: 0,
        [FoodErrorType.NETWORK]: 0
      }
    };
  }

  // Private helper methods

  private static updateStats(error: FoodError): void {
    this.errorStats.totalErrors++;
    this.errorStats.errorsByType[error.type]++;
    this.errorStats.lastError = error;
  }

  private static getLogLevel(errorType: FoodErrorType): 'error' | 'warn' | 'info' {
    switch (errorType) {
      case FoodErrorType.API_KEY:
      case FoodErrorType.VALIDATION:
        return 'error';
      case FoodErrorType.PARSING:
      case FoodErrorType.GENERATION:
        return 'warn';
      case FoodErrorType.TIMEOUT:
      case FoodErrorType.RATE_LIMIT:
      case FoodErrorType.NETWORK:
        return 'info';
      default:
        return 'error';
    }
  }

  private static getUserFriendlyMessage(errorType: FoodErrorType): string {
    switch (errorType) {
      case FoodErrorType.API_KEY:
        return 'Service configuration error. Please contact support.';
      case FoodErrorType.VALIDATION:
        return 'Invalid request. Please check your input and try again.';
      case FoodErrorType.PARSING:
        return 'Error processing AI response. Retrying with fallback method.';
      case FoodErrorType.GENERATION:
        return 'Error generating recommendations. Please try again.';
      case FoodErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case FoodErrorType.RATE_LIMIT:
        return 'Too many requests. Please wait a moment and try again.';
      case FoodErrorType.NETWORK:
        return 'Network connectivity issue. Please check your connection.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private static generateRequestId(): string {
    return `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(context: string, maxRetries: number = 2) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return FoodRecommendationErrorHandler.handleWithRetry(
        () => method.apply(this, args),
        `${context}.${propertyName}`,
        maxRetries
      );
    };
  };
}
