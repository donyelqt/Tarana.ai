/**
 * Mobile token bridge.
 *
 * Issues and validates short-lived NextAuth-encrypted JWTs that let an
 * Expo/React Native app authenticate as the same user as the web app,
 * without a second source of truth for identity.
 *
 * The token is a standard NextAuth JWT (same `encode`/`decode` path as the
 * session cookie), so it can be injected into the `cookie` request header by
 * middleware and consumed unchanged by existing `getServerSession(authOptions)`
 * routes. No broad route rewrites are required.
 */

import { encode, decode } from 'next-auth/jwt';

export const MOBILE_TOKEN_MAX_AGE_SECONDS = 15 * 60; // 15 minutes

export interface MobileTokenPayload {
  sub: string;
  id: string;
  email: string;
  tosAccepted: boolean;
  mobile: true;
}

export function isMobileTokenPayload(value: unknown): value is MobileTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    payload.tosAccepted === true &&
    payload.mobile === true
  );
}

export async function encodeMobileToken(payload: MobileTokenPayload): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  // Intentionally no `salt`: the injected synthetic cookie is read back by
  // `getToken`/`getServerSession`, and `getToken` does not accept a custom
  // salt — it always decrypts with the default empty salt. A non-default salt
  // here would make the token undecryptable downstream and every mobile
  // request would silently 401.
  return encode({
    token: { ...payload },
    secret,
    maxAge: MOBILE_TOKEN_MAX_AGE_SECONDS,
  });
}

export async function decodeMobileToken(token: string): Promise<MobileTokenPayload | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
  const payload = await decode({ token, secret });
  return isMobileTokenPayload(payload) ? payload : null;
}

/**
 * Returns the session cookie name the *consumer* of the synthetic cookie
 * will look for — `getServerSession(authOptions)`, not `getToken`.
 *
 * Must mirror `next-auth`'s `detectOrigin` logic exactly:
 *   VERCEL or AUTH_TRUST_HOST → https://<forwarded host> → secure prefix
 *   otherwise NEXTAUTH_URL, with the same https:// test.
 * `getToken`'s own check (NEXTAUTH_URL / VERCEL only) is the wrong reference
 * point — a missing NEXTAUTH_URL under AUTH_TRUST_HOST would make the
 * middleware inject a non-secure cookie that getServerSession never reads.
 */
export function getSessionCookieName(): string {
  const forwardedProtocol = (
    process.env.NEXTAUTH_URL?.startsWith('https://') ||
    process.env.VERCEL ||
    process.env.AUTH_TRUST_HOST
  );
  return forwardedProtocol
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';
}