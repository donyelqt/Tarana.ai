import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './auth';
import { loggerMiddleware, loggerConfig } from './logger';
import { corsMiddleware, corsConfig } from './cors';
import { composeMiddleware } from './compose';
import { MiddlewareHandler } from './types';

/**
 * Create the main middleware handler that runs all middleware in sequence
 */
const middlewareHandler: MiddlewareHandler = composeMiddleware({
  middlewares: [
    { 
      handler: loggerMiddleware, 
      name: 'logger', 
      enabled: loggerConfig.enabled,
      priority: 100 // Highest priority, runs first
    },
    { 
      handler: corsMiddleware, 
      name: 'cors', 
      enabled: corsConfig.enabled,
      priority: 50
    },
    { 
      handler: authMiddleware, 
      name: 'auth', 
      enabled: true, // Auth is always enabled
      priority: 10
    },
    // Add more middleware here as needed
  ],
  errorHandler: (error, request) => {
    console.error('[Middleware Error]', error);
    // Return appropriate error response
    return new NextResponse('Internal Server Error', { status: 500 });
  },
});

/**
 * Export the middleware handler for use in the main middleware.ts file
 */
export const handler = middlewareHandler; 