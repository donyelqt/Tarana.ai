/**
 * POST /api/auth/mobile-token
 *
 * Exchanges a valid web next-auth session for a short-lived mobile JWT.
 * The mobile app stores this JWT in `expo-secure-store` and sends it as
 * `Authorization: Bearer <token>` on every subsequent API call.
 *
 * Requires: a signed-in session with accepted Terms of Service.
 * Rate limited to prevent token brute-forcing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/rateLimiter';
import {
  encodeMobileToken,
  MobileTokenPayload,
  MOBILE_TOKEN_MAX_AGE_SECONDS,
} from '@/lib/auth/mobileToken';

export async function POST(request: NextRequest) {
  // Endpoint-specific rate limiting (separate from the global API limiter).
  // The key is scoped to this endpoint so the mobile-token bucket never
  // shares state with the global `api` bucket, which has a different window.
  const rateLimitResult = rateLimiter.checkRateLimit(
    request,
    rateLimitConfigs.mobileToken,
    'mobile-token'
  );
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      {
        error: 'Too many token requests. Please slow down.',
        retryAfter: rateLimitResult.retryAfter,
      },
      { status: 429 }
    );
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Auth is not configured' },
      { status: 500 }
    );
  }

  // Validate the web session. getToken reads the session cookie (or, if a
  // bearer token is already present, the Authorization header). We explicitly
  // reject bearer credentials here: this endpoint is a web-session-only
  // exchange, not a mobile-token refresh.
  const existingAuthorization = request.headers.get('authorization');
  if (existingAuthorization?.toLowerCase().startsWith('bearer ')) {
    return NextResponse.json(
      { error: 'Mobile token exchange requires a web session cookie' },
      { status: 401 }
    );
  }

  const token = await getToken({ req: request, secret });

  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // This endpoint exchanges a *web* session for a mobile token. A mobile token
  // presented as a cookie would otherwise be silently re-exchanged for a fresh
  // one, creating an unintended refresh chain and letting a leaked token
  // renew itself.
  if ((token as { mobile?: boolean }).mobile === true) {
    return NextResponse.json(
      { error: 'Mobile tokens cannot be exchanged for mobile tokens' },
      { status: 401 }
    );
  }

  // Fail closed: a missing tosAccepted claim means the user has not accepted.
  if (token.tosAccepted !== true) {
    return NextResponse.json(
      { error: 'Please accept the Terms of Service to continue' },
      { status: 403 }
    );
  }

  const userId = token.id as string | undefined;
  const email = token.email as string | undefined;
  if (!userId || !email) {
    return NextResponse.json(
      { error: 'Session is missing identity claims' },
      { status: 401 }
    );
  }

  const payload: MobileTokenPayload = {
    sub: (token.sub as string) ?? userId,
    id: userId,
    email,
    tosAccepted: true,
    mobile: true,
  };

  let mobileToken: string;
  try {
    mobileToken = await encodeMobileToken(payload);
  } catch (error) {
    console.error('Failed to encode mobile token', error);
    return NextResponse.json(
      { error: 'Failed to issue mobile token' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    token: mobileToken,
    tokenType: 'Bearer',
    expiresIn: MOBILE_TOKEN_MAX_AGE_SECONDS,
    userId,
  });
}