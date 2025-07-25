import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Protected routes that require authentication
export const PROTECTED_ROUTES = [
  '/dashboard',
  '/itinerary-generator',
  '/saved-trips',
  '/profile',
  '/saved-meals',
  '/tarana-eats',
];

/**
 * Authentication middleware - validates user session for protected routes
 * and redirects unauthenticated users to the login page
 */
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the current route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some((route: string) => pathname.startsWith(route));
  
  // Skip auth check for non-protected routes
  if (!isProtectedRoute) {
    return NextResponse.next();
  }
  
  // Get the session token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  
  // Redirect to signin if no token is found
  if (!token) {
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
} 