import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth';
import { corsMiddleware } from '@/middleware/cors';
import { applySecurityHeaders } from '@/lib/security/securityHeaders';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/security/rateLimiter';

// Global rate limiter for API endpoints
const apiRateLimit = createRateLimitMiddleware(rateLimitConfigs.api);
const heavyApiRateLimit = createRateLimitMiddleware(rateLimitConfigs.heavy);

export async function middleware(request: NextRequest) {
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

  // Handle CORS for API routes
  if (pathname.startsWith('/api/')) {
    const corsResponse = corsMiddleware(request);
    if (corsResponse.status !== 200) {
      return applySecurityHeaders(corsResponse);
    }
  }

  // Handle authentication for protected routes
  const authResponse = await authMiddleware(request);
  if (authResponse.status !== 200) {
    return applySecurityHeaders(authResponse);
  }

  // Apply security headers to all responses
  const response = NextResponse.next();
  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
