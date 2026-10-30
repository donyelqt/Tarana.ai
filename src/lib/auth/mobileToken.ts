
import { encode, decode } from 'next-auth/jwt';

export const MOBILE_TOKEN_MAX_AGE_SECONDS = 15 * 60; 

export interface MobileTokenPayload {
  sub: string;
  id: string;
  email: string;
  tosAccepted: boolean;
  mobile: true;
  pwdChangedAt: string | null;
}

export function isMobileTokenPayload(value: unknown): value is MobileTokenPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === 'string' &&
    typeof payload.id === 'string' &&
    typeof payload.email === 'string' &&
    payload.tosAccepted === true &&
    payload.mobile === true &&
    (payload.pwdChangedAt === null || typeof payload.pwdChangedAt === 'string')
  );
}

export async function encodeMobileToken(payload: MobileTokenPayload): Promise<string> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is not configured');
  }
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