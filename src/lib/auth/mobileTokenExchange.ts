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
  const lastPasswordChangeAt = currentChangedAt ?? null;

  const payload: MobileTokenPayload = {
    sub: (token.sub as string) ?? userId,
    id: userId,
    email,
    tosAccepted: true,
    mobile: true,
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

  if (redirectUrl) {
    const target = new URL(redirectUrl);
    target.searchParams.set('token', mobileToken);
    target.searchParams.set('userId', userId);
    return { response: NextResponse.redirect(target, 302) };
  }

  return { value };
}