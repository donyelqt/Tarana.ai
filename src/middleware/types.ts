import { NextRequest, NextResponse } from 'next/server';

/**
 * Base middleware handler function type
 */
export type MiddlewareHandler = (
  request: NextRequest
) => NextResponse | Promise<NextResponse>;

/**
 * Interface for middleware function with metadata
 */
export interface MiddlewareFunction {
  handler: MiddlewareHandler;
  name: string;
  enabled: boolean;
  priority?: number; // Higher number = higher priority
}

/**
 * Error handler function type
 */
export type ErrorHandler = (
  error: Error, 
  request: NextRequest
) => NextResponse | Promise<NextResponse>;

/**
 * Configuration for a middleware chain
 */
export interface MiddlewareChainConfig {
  middlewares: MiddlewareFunction[];
  errorHandler?: ErrorHandler;
} 