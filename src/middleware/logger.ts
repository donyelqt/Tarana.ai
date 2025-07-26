import { NextRequest, NextResponse } from 'next/server';

// Logger configuration
export const loggerConfig = {
  enabled: false, // Set to true to enable request logging in production
  logLevel: 'info', // 'debug' | 'info' | 'warn' | 'error'
};

/**
 * Logger middleware - logs request information
 * Can be enabled/disabled via loggerConfig
 */
export function loggerMiddleware(request: NextRequest) {
  // Skip if disabled in config
  if (!loggerConfig.enabled) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const timestamp = new Date().toISOString();
  const method = request.method;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for') || 'unknown';
  
  // Log request details
  console.log(`[${timestamp}] ${method} ${pathname} - ${ip} - ${userAgent}`);
  
  return NextResponse.next();
} 