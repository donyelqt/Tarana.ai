-- Migration: password-change timestamp for session invalidation.
-- Date: 2026-09-28
--
-- WHY:
--   Sessions are stateless 30-day JWTs (`src/lib/auth/auth.ts` session.maxAge).
--   A password reset changed the credential but left every issued token valid
--   until its own expiry, so an attacker holding a session kept access for up
--   to 30 days after the victim did the one thing that is supposed to lock
--   them out. OWASP treats session invalidation on credential change as
--   required.
--
--   Fix: record WHEN the credential last changed. The credential instant is
--   pinned onto the session at sign-in (`jwt` callback) and re-compared on
--   every `getServerSession` in the `session` callback; a mismatch makes that
--   callback return no session, so the holder is signed out everywhere at
--   once. The token that performed the reset carries the new stamp and
--   survives.
--
--   Why not compare the JWT's `iat`: next-auth re-stamps `iat` on every
--   re-encode, so it records the last cookie write, not the sign-in (verified
--   against next-auth 4.24.15). Comparing two stored values avoids both that
--   and any clock/granularity dependence.
--
--   NULL means "never changed since this column existed" and compares equal to
--   a session stamped with null, so this ships without signing out existing
--   users.
--
-- DEPLOY ORDER (hard): apply BEFORE deploying the code. The read path falls
-- back to "valid" when the column is missing, but the WRITE path does not:
-- `resetPassword`'s UPDATE names this column, so code-before-migration makes
-- every password reset return 500 instead of resetting anything.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.password_changed_at IS
  'Credential-change timestamp; sessions stamped with an older value are rejected. NULL = never changed since introduction.';
