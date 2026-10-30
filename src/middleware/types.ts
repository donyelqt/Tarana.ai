import { NextRequest, NextResponse } from 'next/server';

export type MiddlewareHandler = (
  request: NextRequest
) => NextResponse | Promise<NextResponse>;

export interface MiddlewareFunction {
  handler: MiddlewareHandler;
  name: string;
  enabled: boolean;
  priority?: number; 
}

export type ErrorHandler = (
  error: Error, 
  request: NextRequest
) => NextResponse | Promise<NextResponse>;

export interface MiddlewareChainConfig {
  middlewares: MiddlewareFunction[];
  errorHandler?: ErrorHandler;
} 