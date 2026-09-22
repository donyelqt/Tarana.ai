-- Migration: general idempotency-key store for write endpoints.
-- Date: 2026-09-23
--
-- WHY:
--   Phase 2.3. Only the credit-refund path was idempotent (migration
--   20260914000000_refund_credits_rpc.sql, ON CONFLICT (user_id, idempotency_key)
--   DO NOTHING). Every other write endpoint — save itinerary, create meal,
--   consume test credit, init profile, update profile, create referral — had
--   no replay protection, so a double-click, a retry, or a concurrent
--   duplicate submission could double-write.
--
--   This migration generalizes the refund pattern: a caller-supplied
--   Idempotency-Key header, a lookup table, and a cached-response replay.
--   Unlike the refund RPC (which dedupes the *write*), this dedupes the
--   *response*: a replayed key returns the original body and status, so the
--   caller sees an identical result and no second side effect.
--
-- DESIGN NOTES:
--   - Scope is (user_id, route, key): the same key string on two routes, or
--     two users, never suppresses each other. A route-scoped unique index
--     enforces it.
--   - Key is caller-supplied, per plan §2.3 ("part of the request contract,
--     not a header the client invents") — but we ACCEPT a client-supplied
--     header rather than minting server-side, because the caller owns the
--     retry identity (a double-click is the caller's retry). The server's
--     job is to make replays safe, not to name them.
--   - response_body is JSONB so any route shape fits; status is stored
--     separately so a replay returns the original status, not a blanket 200.
--   - TTL via `expires_at`: rows older than the TTL are eligible for
--     cleanup. Kept generous (30d) so a client retry window is always
--     covered; the cleanup job runs on every insert.
--   - No RLS change: written by the service-role admin client (same as every
--     other server route), so RLS is irrelevant. The table holds no
--     secrets — only a caller-minted key and a cached response.
--
-- DEPLOY ORDER:
--   Apply this migration, then the app code. Reads are backward-compatible
--   (the table is empty until the first write with a key); routes that do
--   not send a key are completely unaffected.

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          uuid          NOT NULL,
    route            text          NOT NULL,
    idempotency_key  text          NOT NULL,
    status           integer       NOT NULL,
    response_body    jsonb         NOT NULL,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    expires_at       timestamptz   NOT NULL DEFAULT (now() + interval '30 days')
);

-- RLS: this table holds cached API responses (itineraries, profile
-- fields, credit state) keyed by caller idempotency keys. The app reaches
-- it only through supabaseAdmin (service role), which bypasses RLS entirely
-- — so enabling it changes zero runtime behavior and only closes the hole
-- for anon/authenticated-key access. No policies are written: the default
-- posture under RLS is deny-all, which is the intended posture for a
-- server-only table. A scoped policy would be added only if a client path
-- ever needs direct access.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Composite scope: same key on two routes, or two users, is independent.
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_user_route_key
    ON public.idempotency_keys (user_id, route, idempotency_key);

-- Lookup hot path: (user_id, route, key) is the exact PK shape.
CREATE INDEX IF NOT EXISTS idx_idempotency_lookup
    ON public.idempotency_keys (user_id, route, idempotency_key);

-- TTL cleanup: drop expired rows. Plain (non-concurrent) index scan; the
-- table is write-few, read-rare, so this is fine. Runs on every insert
-- (see the helper) rather than on a scheduler, matching the existing
-- convention where the app owns its cleanup (rateLimiter.cleanup()).
CREATE OR REPLACE FUNCTION public.cleanup_expired_idempotency_keys()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
    v_deleted integer;
BEGIN
    DELETE FROM public.idempotency_keys
    WHERE expires_at < now();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;