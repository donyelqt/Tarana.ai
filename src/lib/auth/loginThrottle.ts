
export interface LoginAttemptEntry {
  attempts: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

export const LOGIN_RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, 
  maxAttempts: 5, 
  blockDurationMs: 30 * 60 * 1000, 
} as const;

const loginAttempts = new Map<string, LoginAttemptEntry>();

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
