import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from './auth';
import { requestIdMiddleware } from './requestId';
import { corsMiddleware, corsConfig } from './cors';
import { composeMiddleware } from './compose';
import { MiddlewareHandler } from './types';
import { logger } from '@/lib/observability/logger';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';

const apiRateLimit = createRateLimitMiddleware(rateLimitConfigs.api);
const heavyApiRateLimit = createRateLimitMiddleware(rateLimitConfigs.heavy);

const securityMiddleware = async (request: NextRequest): Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    let rateLimitResult;
    
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

const middlewareHandler: MiddlewareHandler = composeMiddleware({
  middlewares: [
    { 
      handler: requestIdMiddleware, 
      name: 'requestId', 
      enabled: true,
      priority: 110 
    },
    { 
      handler: securityMiddleware, 
      name: 'security', 
      enabled: true,
      priority: 90 
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
      enabled: true, 
      priority: 10
    },
  ],
  errorHandler: (error) => {
    logger.error('[Middleware Error]', { error });
    return applySecurityHeaders(new NextResponse('Internal Server Error', { status: 500 }));
  },
});

export async function middleware(request: NextRequest): Promise<NextResponse> {
  return middlewareHandler(request);
}

export const handler = middlewareHandler;

export default middleware; 