import { NextResponse } from 'next/server';

export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  
  'X-Content-Type-Options': 'nosniff',
  
  'X-XSS-Protection': '1; mode=block',
  
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=()',
  
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://maps.googleapis.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openweathermap.org https://generativelanguage.googleapis.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};

export function applySecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}

export function createSecureResponse(body?: any, init?: ResponseInit): NextResponse {
  const response = body ? NextResponse.json(body, init) : NextResponse.next();
  return applySecurityHeaders(response);
}
