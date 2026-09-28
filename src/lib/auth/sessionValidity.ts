/**
 * Session-validity check for stateless JWT sessions.
 *
 * Why: sessions are 30-day JWTs (`authOptions.session.maxAge`). A JWT stays
 * valid until it expires, so a password reset — the canonical "my account may
 * be compromised" action — left every previously issued token working for up
 * to 30 days. OWASP treats session invalidation on credential change as
 * required.
 *
 * Design (verified against next-auth 4.24.15, not assumed):
 *   - `encode()` calls `.setIssuedAt()` unconditionally, so `iat` is "when the
 *     cookie was last WRITTEN", not "when the user signed in". NextAuth
 *     re-encodes on session reads, so `iat` advances. Measured: an intervening
 *     re-encode moved `iat` from 1790544405 to 1790544406. Comparing `iat`
 *     against the change time would therefore silently never fire. Do not use
 *     `iat` here.
 *   - Arbitrary custom claims DO survive re-encode (measured: a custom claim
 *     round-tripped unchanged), so the credential-change instant is pinned onto
 *     the token at sign-in and compared on refresh.
 *
 * Result: the comparison is between two stored values, with no clock or
 * granularity dependence. A token minted before the reset carries the older
 * stamp and is rejected; the reset does not touch the token that performed it,
 * so that session stays usable.
 *
 * Enforcement point (verified end to end in
 * `scripts/prove-session-invalidation.ts`): the `session` callback, not the
 * `jwt` callback. Returning null from `jwt` denies only by accident — the
 * session route passes the ORIGINAL token to the `session` callback and
 * dereferences `session.user.id` from it, so the denial is a swallowed
 * TypeError, and the token is returned to the caller as a live session as soon
 * as that dereference is made null-safe. The `session` callback decides the
 * body explicitly, so the denial is intentional and cannot regress on an
 * unrelated edit to the identity mapping.
 *
 * Failure mode: fails OPEN on read errors or a missing row. The token already
 * passed signature and expiry verification before this runs, so an erring
 * lookup must not become a site-wide sign-out during a database blip.
 */

import { supabaseAdmin } from '@/lib/data/supabaseAdmin';
import { logger } from '@/lib/observability/logger';
import { getSafeErrorMetadata } from '@/lib/observability/safeErrorMetadata';

const LOG_ENTRY_POINT = 'auth';

/** Token claim holding the credential-change instant that was current when
 *  this session was established (ISO string, or null when never changed). */
export const PASSWORD_CHANGED_CLAIM = 'pwdChangedAt';

export interface SessionTokenState {
  id?: string;
  pwdChangedAt?: string | null;
}

/** Minimal shape needed to scope the check: only the app-written `id` is an
 *  account id. `sub` is next-auth's own subject claim, left on the type for
 *  observability only — a `sub` is never a users-row id, so it cannot scope
 *  this check. */
export interface TokenIdentity {
  id?: unknown;
  sub?: unknown;
}

/**
 * Resolve the account id a token belongs to.
 *
 * Identity comes ONLY from the app-written `id` claim (session cookie at
 * sign-in, exchanged mobile token). `sub` is next-auth's own subject claim
 * and is listed on the type for observability only — a `sub` is never a
 * users-row id, so it cannot scope this check (no id -> no read, no compare;
 * `isSessionTokenCurrent` below reaches its first `return true`). Do not
 * consult it: the only tokens without an `id` are ones the app can never have
 * issued, and those already fail closed via the missing `user.id`.
 */

export function resolveTokenUserId(token: TokenIdentity | null | undefined): string | undefined {
  const id = token?.id;
  if (typeof id === 'string' && id.length > 0) return id;
  return undefined;
}

/** Read the user's current credential-change instant. `undefined` means the
 *  value could not be read, which callers treat as "cannot evaluate". */
export async function readPasswordChangedAt(userId: string): Promise<string | null | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('password_changed_at')
      .eq('id', userId)
      .single();

    if (error) {
      logger.warn('Password-change lookup failed; session accepted', {
        entryPoint: LOG_ENTRY_POINT,
        ...getSafeErrorMetadata(error),
      });
      return undefined;
    }

    const value = (data as { password_changed_at?: string | null } | null)?.password_changed_at;
    return value ?? null;
  } catch (error) {
    logger.warn('Password-change lookup threw; session accepted', {
      entryPoint: LOG_ENTRY_POINT,
      ...getSafeErrorMetadata(error),
    });
    return undefined;
  }
}

/**
 * True when a token's credential stamp still matches the account's.
 *
 * Compares the claim carried by the token against the live value, so a token
 * issued before a reset (older or null stamp) is rejected while the token that
 * performed the reset (stamped with the new value) survives.
 */
export function isSessionTokenCurrent(
  token: SessionTokenState & TokenIdentity,
  currentChangedAt: string | null | undefined
): boolean {
  if (!resolveTokenUserId(token)) return true; // nothing to scope the check to
  if (currentChangedAt === undefined) return true; // unreadable -> accept
  const stamped = token.pwdChangedAt ?? null;
  return stamped === currentChangedAt;
}
