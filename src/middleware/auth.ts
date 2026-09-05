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

// Paths reachable without ToS acceptance. Kept tight on purpose:
// the consent page itself, NextAuth's handshake/session endpoints,
// the legal documents, and the public landing page. Everything else
// (app pages and /api/*) requires acceptance once signed in.
export const CONSENT_ALLOWLIST = [
  '/auth/consent',
  '/api/auth',
  '/terms',
  '/privacy',
];

export function isConsentAllowlisted(pathname: string): boolean {
  if (pathname === '/') return true;
  return CONSENT_ALLOWLIST.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Authentication middleware - validates user session for protected routes
 * and redirects unauthenticated users to the login page.
 * Also gates signed-in users who have not accepted the ToS to /auth/consent
 * (post-login gate: the OAuth handshake itself is never blocked).
 */
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session token (single read, reused below)
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // ToS consent gate: fail closed (missing claim counts as not accepted,
  // covering sessions issued before the claim existed).
  if (token && (token as unknown as { tosAccepted?: boolean }).tosAccepted !== true && !isConsentAllowlisted(pathname)) {
    const url = new URL('/auth/consent', request.url);
    url.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Check if the current route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some((route: string) => pathname.startsWith(route));

  // Skip auth check for non-protected routes
  if (!isProtectedRoute) {
    return NextResponse.next();
  }

  // Redirect to signin if no token is found
  if (!token) {
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
} 