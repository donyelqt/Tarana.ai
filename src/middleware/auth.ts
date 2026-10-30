import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  decodeMobileToken,
  MobileTokenPayload,
  getSessionCookieName,
} from '@/lib/auth/mobileToken';

export const PROTECTED_ROUTES = [
  '/dashboard',
  '/itinerary-generator',
  '/saved-trips',
  '/profile',
  '/saved-meals',
  '/tarana-eats',
];

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

function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  const bearerToken = extractBearerToken(request);
  const sessionCookieName = getSessionCookieName();
  const cookieHeader = request.headers.get('cookie') ?? '';
  const hasSessionCookie = cookieHeader.includes(`${sessionCookieName}=`);

  if (bearerToken && !isApiRoute) {
    return reject(request, pathname, 'Bearer tokens are not valid on UI routes');
  }

  if (bearerToken && hasSessionCookie) {
    return reject(request, pathname, 'Ambiguous credentials: session cookie and bearer token');
  }

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

  const hasCredential = mobilePayload || (await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET }));
  const tosAccepted = mobilePayload
    ? mobilePayload.tosAccepted === true
    : (hasCredential as { tosAccepted?: boolean } | null)?.tosAccepted === true;

  if (hasCredential && !tosAccepted && !isConsentAllowlisted(pathname)) {
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

  const isProtectedRoute = PROTECTED_ROUTES.some((route: string) => pathname.startsWith(route));

  if (!isProtectedRoute) {
    if (mobilePayload && isApiRoute) {
      return injectMobileCookie(request, bearerToken!);
    }
    return NextResponse.next();
  }

  if (!hasCredential) {
    const url = new URL('/auth/signin', request.url);
    url.searchParams.set('callbackUrl', encodeURI(pathname));
    return NextResponse.redirect(url);
  }

  return mobilePayload ? injectMobileCookie(request, bearerToken!) : NextResponse.next();
}

function reject(request: NextRequest, pathname: string, _reason: string): NextResponse {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const redirect = new URL('/auth/signin', request.url);
  redirect.searchParams.set('callbackUrl', encodeURI(pathname));
  return NextResponse.redirect(redirect);
}

function injectMobileCookie(request: NextRequest, bearerToken: string): NextResponse {
  const cookieName = getSessionCookieName();
  const headers = new Headers(request.headers);
  headers.set('cookie', `${cookieName}=${bearerToken}`);
  return NextResponse.next({ request: { headers } });
} 