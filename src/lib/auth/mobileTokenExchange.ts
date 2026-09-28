/**
 * Shared exchange logic for the mobile token bridge.
 *
 * Two entry points need the same core behavior:
 *  - POST /api/auth/mobile-token — API callers (web SPA, iOS where cookies
 *    are shared by WebBrowser.openAuthSessionAsync).
 *  - GET /api/auth/mobile-token/exchange-redirect — UI redirect target for
 *    Android, where Chrome Custom Tabs does NOT share cookies with the app's
 *    fetch, so the exchange must run server-side against the real session
 *    cookie and hand the token back in the redirect URL.
 *
 * Keeping the logic here means the two routes cannot drift.
 */
import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, rateLimitConfigs } from '@/lib/security/rateLimiter';
import {
  encodeMobileToken,
  MobileTokenPayload,
  MOBILE_TOKEN_MAX_AGE_SECONDS,
} from '@/lib/auth/mobileToken';
import {
  PASSWORD_CHANGED_CLAIM,
  isSessionTokenCurrent,
  readPasswordChangedAt,
} from '@/lib/auth/sessionValidity';
import { logger } from '@/lib/observability/logger';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';
import { getRequestId } from '@/middleware/requestId';

export type ExchangeRequest = {
  req: NextRequest;
  /** If set, the caller wants the token returned in a redirect URL instead of
   *  a JSON body (mobile web-browser flow). */
  redirectUrl?: string | null;
};

export type ExchangeSuccess = {
  success: true;
  token: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userId: string;
};

export type ExchangeError = {
  error: string;
  status: 401 | 403 | 429 | 500;
};

/**
 * Run the exchange. Returns either a success payload or an error response
 * the caller can send directly.
 */
export async function runMobileTokenExchange({
  req,
  redirectUrl,
}: ExchangeRequest): Promise<{ response: NextResponse } | { value: ExchangeSuccess }> {
  const rateLimitResult = rateLimiter.checkRateLimit(
    req,
    rateLimitConfigs.mobileToken,
    'mobile-token'
  );
  if (!rateLimitResult.allowed) {
    return {
      response: NextResponse.json(
        {
          error: 'Too many token requests. Please slow down.',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429 }
      ),
    };
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return {
      response: NextResponse.json(
        { error: 'Auth is not configured' },
        { status: 500 }
      ),
    };
  }

  // This endpoint is a web-session-only exchange, not a mobile-token refresh.
  const existingAuthorization = req.headers.get('authorization');
  if (existingAuthorization?.toLowerCase().startsWith('bearer ')) {
    return {
      response: NextResponse.json(
        { error: 'Mobile token exchange requires a web session cookie' },
        { status: 401 }
      ),
    };
  }

  const token = await getToken({ req, secret });

  if (!token) {
    return {
      response: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // A mobile token presented as a cookie would otherwise be silently
  // re-exchanged, creating an unintended refresh chain.
  if ((token as { mobile?: boolean }).mobile === true) {
    return {
      response: NextResponse.json(
        { error: 'Mobile tokens cannot be exchanged for mobile tokens' },
        { status: 401 }
      ),
    };
  }

  if (token.tosAccepted !== true) {
    return {
      response: NextResponse.json(
        { error: 'Please accept the Terms of Service to continue' },
        { status: 403 }
      ),
    };
  }

  const userId = token.id as string | undefined;
  const email = token.email as string | undefined;
  if (!userId || !email) {
    return {
      response: NextResponse.json(
        { error: 'Session is missing identity claims' },
        { status: 401 }
      ),
    };
  }

  // `getToken` only verifies signature and expiry, so it will happily hand
  // back a session the `jwt` callback would have discarded. Re-run the same
  // credential-change check here, or a reset would still mint a fresh 15-minute
  // bearer token from the very session it just invalidated.
  const currentChangedAt = await readPasswordChangedAt(userId);
  if (
    !isSessionTokenCurrent(
      {
        id: userId,
        pwdChangedAt:
          ((token as unknown as Record<string, unknown>)[PASSWORD_CHANGED_CLAIM] as
            | string
            | null
            | undefined) ?? null,
      },
      currentChangedAt
    )
  ) {
    logger.warn('Mobile token exchange rejected: session predates the password change', {
      entryPoint: 'auth/mobile-token',
    });
    return {
      response: NextResponse.json(
        { error: 'Session is no longer valid. Please sign in again.' },
        { status: 401 }
      ),
    };
  }
  // `undefined` means the lookup failed; the token is still minted, but it
  // must carry "never changed" rather than the unreadable value, so a later
  // successful read does not reject a token that was issued in good faith.
  const lastPasswordChangeAt = currentChangedAt ?? null;

  const payload: MobileTokenPayload = {
    sub: (token.sub as string) ?? userId,
    id: userId,
    email,
    tosAccepted: true,
    mobile: true,
    // Carry the web session's credential stamp so the mobile token inherits
    // the invalidation the web session is subject to; a token minted from a
    // pre-reset session would otherwise stay valid for its full 15 minutes.
    pwdChangedAt: lastPasswordChangeAt,
  };

  let mobileToken: string;
  try {
    mobileToken = await encodeMobileToken(payload);
  } catch (error) {
    logger.error('Failed to encode mobile token', { entryPoint: 'auth/mobile-token', ...getSafeErrorMetadata(error) }, getRequestId(req));
    return {
      response: NextResponse.json(
        { error: 'Failed to issue mobile token' },
        { status: 500 }
      ),
    };
  }

  const value: ExchangeSuccess = {
    success: true,
    token: mobileToken,
    tokenType: 'Bearer',
    expiresIn: MOBILE_TOKEN_MAX_AGE_SECONDS,
    userId,
  };

  // Mobile web-browser flow: hand the token back in the redirect URL. The
  // mobile app parses it from the final URL — correct on both iOS and
  // Android, where cookie sharing is unreliable.
  if (redirectUrl) {
    const target = new URL(redirectUrl);
    target.searchParams.set('token', mobileToken);
    target.searchParams.set('userId', userId);
    return { response: NextResponse.redirect(target, 302) };
  }

  return { value };
}