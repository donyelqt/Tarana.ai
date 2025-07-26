import { NextRequest, NextResponse } from 'next/server';

// CORS configuration
export const corsConfig = {
  enabled: true,
  allowedOrigins: [
    'https://tarana.ai',
    'https://www.tarana.ai',
    process.env.NEXT_PUBLIC_SITE_URL,
  ].filter(Boolean),
  allowedMethods: 'GET, POST, PUT, DELETE, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
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

  // Get the response from the next middleware
  const response = NextResponse.next();

  // Get the origin from the request
  const origin = request.headers.get('origin');
  
  // Check if the origin is allowed
  if (origin && corsConfig.allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', corsConfig.allowedMethods);
    response.headers.set('Access-Control-Allow-Headers', corsConfig.allowedHeaders);
    
    if (corsConfig.allowCredentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    response.headers.set('Access-Control-Max-Age', corsConfig.maxAge.toString());
  }
  
  return response;
} 