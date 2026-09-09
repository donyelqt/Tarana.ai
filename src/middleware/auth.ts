import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  decodeMobileToken,
  MobileTokenPayload,
  getSessionCookieName,
} from '@/lib/auth/mobileToken';

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
 * Extract a bearer mobile token from the request, if present.
 * Returns the raw token string or null.
 */
function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

/**
 * Authentication middleware - validates user session for protected routes
 * and redirects unauthenticated users to the login page.
 * Also gates signed-in users who have not accepted the ToS to /auth/consent
 * (post-login gate: the OAuth handshake itself is never blocked).
 *
 * Mobile bearer tokens are API-only credentials. When a valid mobile token is
 * the only credential on an API request, it is injected into the downstream
 * request as a synthetic session cookie so existing
 * `getServerSession(authOptions)` routes can consume it unchanged.
 */
export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  const bearerToken = extractBearerToken(request);
  const sessionCookieName = getSessionCookieName();
  const cookieHeader = request.headers.get('cookie') ?? '';
  const hasSessionCookie = cookieHeader.includes(`${sessionCookieName}=`);

  // Bearer tokens are API-only: a mobile token on a UI route is a credential
  // mismatch, not a session, so it must not be silently upgraded to page access.
  if (bearerToken && !isApiRoute) {
    return reject(request, pathname, 'Bearer tokens are not valid on UI routes');
  }

  // Reject ambiguous requests: a real session cookie and a mobile bearer token
  // present at the same time. Key on the session cookie *name*, not the raw
  // Cookie header — an unrelated cookie (CSRF, tracking) must not trigger this.
  if (bearerToken && hasSessionCookie) {
    return reject(request, pathname, 'Ambiguous credentials: session cookie and bearer token');
  }

  // Validate the mobile bearer token when present.
  let mobilePayload: MobileTokenPayload | null = null;
  if (bearerToken) {
    try {
      mobilePayload = await decodeMobileToken(bearerToken);
    } catch {
      mobilePayload = null;
    }
    if (!mobilePayload) {
      return reject(request, pathname, 'Invalid or expired mobile token');
    }
  }

  // ToS consent gate: fail closed (missing claim counts as not accepted,
  // covering sessions issued before the claim existed). Only applies when a
  // credential is present; anonymous users fall through to the auth check.
  const hasCredential = mobilePayload || (await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }));
  const tosAccepted = mobilePayload
    ? mobilePayload.tosAccepted === true
    : (hasCredential as { tosAccepted?: boolean } | null)?.tosAccepted === true;

  if (hasCredential && !tosAccepted && !isConsentAllowlisted(pathname)) {
    // API callers get a JSON 403 they can act on; UI callers keep the
    // existing redirect to the consent page. A 307 to an HTML page is not a
    // usable signal for a bearer-based mobile client.
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Please accept the Terms of Service to continue' },
        { status: 403 }
      );
    }
    const url = new URL('/auth/consent', request.url);
    url.searchParams.set('callbackUrl', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Check if the current route requires authentication
  const isProtectedRoute = PROTECTED_ROUTES.some((route: string) => pathname.startsWith(route));

  // Skip auth check for non-protected routes. API routes still need the
  // synthetic cookie injected so downstream handlers resolve the identity;
  // non-API, non-protected paths (e.g. the marketing site) pass through bare.
  if (!isProtectedRoute) {
    if (mobilePayload && isApiRoute) {
      return injectMobileCookie(request, bearerToken!);
    }
    return NextResponse.next();
  }

  // Redirect to signin if no token is found
  if (!hasCredential) {
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(url);
  }

  // Inject the raw encrypted JWT as a synthetic session cookie so existing
  // `getServerSession(authOptions)` route handlers can resolve the same
  // identity without any route changes. Downstream getToken/decode expects an
  // encrypted NextAuth token — a bare user id would silently 401.
  return mobilePayload ? injectMobileCookie(request, bearerToken!) : NextResponse.next();
}

/**
 * Rejection mode depends on the route type: API callers get a JSON 401 they
 * can act on (re-exchange the token); UI callers get the existing HTML
 * redirect so the browser lands on the signin page.
 */
function reject(request: NextRequest, pathname: string, _reason: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const redirect = new URL('/auth/signin', request.url);
  redirect.searchParams.set('callbackUrl', encodeURI(pathname));
  return NextResponse.redirect(redirect);
}

/**
 * Inject the validated mobile token as a synthetic session cookie so existing
 * `getServerSession(authOptions)` route handlers can resolve the same identity
 * without any route changes.
 *
 * Ambiguous requests (a real session cookie and a mobile bearer token present
 * at the same time) are rejected upstream, so when this runs the only
 * credential is the bearer token. The synthetic cookie carries the *raw
 * encrypted JWT*, not the decoded user id: downstream `getServerSession` →
 * `getToken` → `decode` expects an encrypted NextAuth token and will reject a
 * bare UUID. We set it directly rather than merging with an existing value,
 * which would create a duplicate-name header that browsers may resolve
 * unpredictably.
 */
function injectMobileCookie(request: NextRequest, bearerToken: string): NextResponse {
  const cookieName = getSessionCookieName();
  const headers = new Headers(request.headers);
  headers.set('cookie', `${cookieName}=${bearerToken}`);
  return NextResponse.next({ request: { headers } });
} 