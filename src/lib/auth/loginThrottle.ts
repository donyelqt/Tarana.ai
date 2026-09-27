/**
 * Login attempt throttle for the credentials provider.
 *
 * Extracted from `auth.ts` so the identity derivation and the lockout window
 * can be tested directly: the state is process-local and needs a reset seam,
 * otherwise assertions depend on test order (the same flakiness class the Eats
 * response cache had).
 *
 * Identity is `${email}:${ip}`. The IP MUST come from a host the client cannot
 * set: the old derivation read the FIRST `x-forwarded-for` entry, which is
 * caller-supplied, so rotating that header produced a fresh bucket every
 * attempt and the lockout never fired. Prefer the platform-set `x-real-ip`,
 * fall back to the LAST hop in `x-forwarded-for` (the one appended nearest the
 * origin), and never trust the leading entries.
 *
 * Known residual: a caller rotating genuine IPs (botnet) still gets a fresh
 * bucket per address. Closing that needs an email-scoped or global counter,
 * which trades into account-lockout denial of service — a product decision,
 * not taken here. The generic `/api/` middleware bucket still caps per-IP
 * volume for `/api/auth/*` as a second layer.
 */

export interface LoginAttemptEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export const LOGIN_RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes window
  maxAttempts: 5, // 5 attempts per window
  blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes
} as const;

const loginAttempts = new Map<string, LoginAttemptEntry>();

/** Test seam: clear the process-local attempt store between cases. */
export function __resetLoginAttemptsForTests(): void {
  loginAttempts.clear();
}

function extractHeader(headers: any, name: string): string | undefined {
  if (!headers) return undefined;

  if (typeof headers.get === 'function') {
    return headers.get(name) ?? headers.get(name.toLowerCase());
  }

  const lowerName = name.toLowerCase();
  const value = headers[name] ?? headers[lowerName];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

/**
 * Resolve the client address the throttle keys on.
 *
 * `x-real-ip` is set by the platform and cannot be forged by the browser.
 * `x-forwarded-for` is append-by-proxy, so its LAST entry is the closest we can
 * get to the peer that actually connected; earlier entries are whatever the
 * caller sent.
 */
export function resolveClientIp(req?: any): string {
  const realIp = extractHeader(req?.headers, 'x-real-ip')?.trim();
  if (realIp) return realIp;

  const forwarded = extractHeader(req?.headers, 'x-forwarded-for');
  const hops = (forwarded ?? '').split(',').map((h) => h.trim()).filter(Boolean);
  if (hops.length > 0) return hops[hops.length - 1];

  return req?.ip || 'unknown_ip';
}

export function getClientIdentifier(email?: string | null, req?: any): string {
  const normalizedEmail = email?.toLowerCase() || 'unknown_email';
  return `${normalizedEmail}:${resolveClientIp(req)}`;
}

function cleanupLoginEntry(identifier: string, entry: LoginAttemptEntry, now: number) {
  if (entry.firstAttemptAt + LOGIN_RATE_LIMIT_CONFIG.windowMs < now) {
    loginAttempts.delete(identifier);
  }
}

export function getLoginBlockStatus(
  identifier: string,
  now: number = Date.now()
): { blocked: boolean; retryAfter?: number } {
  const entry = loginAttempts.get(identifier);
  if (!entry) {
    return { blocked: false };
  }

  // Reset window if enough time passed
  cleanupLoginEntry(identifier, entry, now);
  const updatedEntry = loginAttempts.get(identifier);
  if (!updatedEntry) {
    return { blocked: false };
  }

  if (updatedEntry.blockedUntil && updatedEntry.blockedUntil > now) {
    return {
      blocked: true,
      retryAfter: Math.ceil((updatedEntry.blockedUntil - now) / 1000),
    };
  }

  return { blocked: false };
}

export function registerFailedLogin(
  identifier: string,
  now: number = Date.now()
): { blocked: boolean; retryAfter?: number } {
  const entry = loginAttempts.get(identifier);

  if (!entry || entry.firstAttemptAt + LOGIN_RATE_LIMIT_CONFIG.windowMs < now) {
    loginAttempts.set(identifier, {
      attempts: 1,
      firstAttemptAt: now,
    });
  } else {
    entry.attempts += 1;

    if (entry.attempts >= LOGIN_RATE_LIMIT_CONFIG.maxAttempts) {
      entry.blockedUntil = now + LOGIN_RATE_LIMIT_CONFIG.blockDurationMs;
    }

    loginAttempts.set(identifier, entry);
  }

  return getLoginBlockStatus(identifier, now);
}

export function resetLoginAttempts(identifier: string) {
  if (loginAttempts.has(identifier)) {
    loginAttempts.delete(identifier);
  }
}
