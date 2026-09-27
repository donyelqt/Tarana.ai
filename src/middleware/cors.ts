import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
export const corsConfig = {
  enabled: true,
  allowedOrigins: [
    'https://tarana.ai',
    'https://www.tarana.ai',
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean),
  allowedMethods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, X-Requested-With, X-Request-Id, Idempotency-Key, x-admin-token',
  allowCredentials: true,
  maxAge: 86400, // 24 hours in seconds
};

/**
 * CORS (Cross-Origin Resource Sharing) middleware
 * Adds appropriate headers to control which origins can access the API
 */
export function corsMiddleware(request: NextRequest) {
  // Skip if CORS is disabled in config
  if (!corsConfig.enabled) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const allowed = origin != null && (corsConfig.allowedOrigins as string[]).includes(origin);

  // Preflight: answer directly so cross-origin non-simple requests (auth
  // headers, JSON POSTs) do not fall through to a 405/404.
  if (request.method === 'OPTIONS') {
    const preflight = new NextResponse(null, { status: 204 });
    if (allowed) {
      preflight.headers.set('Access-Control-Allow-Origin', origin as string);
      preflight.headers.set('Access-Control-Allow-Methods', corsConfig.allowedMethods);
      preflight.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders);
      if (corsConfig.allowCredentials) preflight.headers.set('Access-Control-Allow-Credentials', 'true');
      preflight.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
    }
    preflight.headers.set('Vary', 'Origin');
    return preflight;
  }

  // Get the response from the next middleware
  const response = NextResponse.next();

  // Check if the origin is allowed
  if (allowed) {
    response.headers.set('Access-Control-Allow-Origin', origin as string);
    response.headers.set('Access-Control-Allow-Methods', corsConfig.allowedMethods);
    response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders);

    if (corsConfig.allowCredentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  }
  response.headers.set('Vary', 'Origin');

  return response;
}