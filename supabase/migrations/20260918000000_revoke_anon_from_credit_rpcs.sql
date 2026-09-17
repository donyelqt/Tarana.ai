-- Migration: lock down credit/embeddings RPC surface from anon.
-- Date: 2026-09-18
--
-- Why (live-probed 2026-09-18 on project vryamakpawtzmvgnifie):
--   POST /rest/v1/rpc/refund_credits and /rpc/consume_credits EXECUTE under
--   the anon key (HTTP 200/400 — function runs, NOT 404/403). The surface is
--   inert today only because user_profiles RLS (auth.uid() = id) makes the
--   functions' SELECT find no rows for an anon caller. That fail-closed
--   posture depends entirely on RLS policies staying perfect — a single
--   future policy exposing one profile row to anon (public-profile feature,
--   debug policy, misconfiguration) would let any anon caller pass arbitrary
--   p_user_id UUIDs and INSERT credit_transactions rows / move
--   credits_used_today on rows visible to it. Neither function validates
--   that the caller IS p_user_id, and neither migration ever revoked anon.
--   REVOKE EXECUTE is cheap, permanent, and removes the whole surface class
--   regardless of future RLS changes. Extends plan Task 6 (which covered
--   only match_activity_embeddings).
--
-- Callers verified 2026-09-18 (zero-downtime gate):
--   - All src/ callers go through supabaseAdmin (service role):
--     consume_credits → CreditService.ts:186, credits/diagnostics,
--     credits/test-consumption; refund_credits → CreditService.ts:275;
--     match_activity_embeddings → intelligentSearch.ts:526, vectorSearch.ts:86.
--   - tarana-mobile source: zero RPC references.
--   - anon-key callers: none. Anon probe after this migration MUST return
--     403 (PostgREST permission denied) — that is the acceptance signal.
--
-- Note on default grants: Postgres grants EXECUTE on functions to PUBLIC by
-- default. The embeddings function additionally had an explicit anon grant
-- (20240730000000:40). REVOKing from anon alone would leave the PUBLIC
-- grant path open (PostgREST's anon role is a member of the anon ROLE, but
-- PUBLIC covers every role incl. anon), so revoke from PUBLIC and re-grant
-- to service_role + authenticated where a non-service caller is legitimate.
-- No src/ or mobile caller uses authenticated keys for these RPCs, but
-- keeping authenticated execute preserves future client-side balance reads
-- without re-opening the anon surface.

-- 1) Credit RPCs: no legitimate anon caller. Kill PUBLIC entirely.
REVOKE EXECUTE ON FUNCTION public.refund_credits(UUID, INTEGER, VARCHAR(50), TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.consume_credits(UUID, INTEGER, VARCHAR(50), TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_available_credits(UUID) FROM PUBLIC, anon;

-- 2) Embeddings RPC: revoke the explicit anon grant + default PUBLIC,
--    keep authenticated (server callers use service role; client-side
--    vector reads stay available to signed-in users if ever wired).
REVOKE EXECUTE ON FUNCTION public.match_activity_embeddings(vector, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_activity_embeddings(vector, INTEGER) TO authenticated;
