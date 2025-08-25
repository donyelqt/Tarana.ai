import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './auth';
import { loggerMiddleware, loggerConfig } from './logger';
import { corsMiddleware, corsConfig } from './cors';
import { composeMiddleware } from './compose';
import { MiddlewareHandler } from './types';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';

// Global rate limiters for API endpoints
const apiRateLimit = createRateLimitMiddleware(rateLimitConfigs.api);
const heavyApiRateLimit = createRateLimitMiddleware(rateLimitConfigs.heavy);

// Security middleware handler
const securityMiddleware = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  // Apply rate limiting to API routes
  if (pathname.startsWith('/api/')) {
    let rateLimitResult;
    
    // Apply stricter rate limiting to heavy operations
    if (pathname.includes('/gemini/') || pathname.includes('/reindex')) {
      rateLimitResult = heavyApiRateLimit(request);
    } else {
      rateLimitResult = apiRateLimit(request);
    }

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Rate limit exceeded. Please slow down your requests.',
          retryAfter: rateLimitResult.retryAfter 
        },
        { status: 429 }
      );
      response.headers.set('Retry-After', rateLimitResult.retryAfter?.toString() || '60');
      return applySecurityHeaders(response);
    }
  }

  return NextResponse.next();
};

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
      handler: securityMiddleware, 
      name: 'security', 
      enabled: true,
      priority: 90 // High priority for security
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
  ],
  errorHandler: (error, request) => {
    console.error('[Middleware Error]', error);
    // Return appropriate error response with security headers
    return applySecurityHeaders(new NextResponse('Internal Server Error', { status: 500 }));
  },
});

/**
 * Main middleware function for Next.js
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  return middlewareHandler(request);
}

/**
 * Export the middleware handler for use in the main middleware.ts file
 */
export const handler = middlewareHandler;

/**
 * Default export for Next.js middleware
 */
export default middleware; 