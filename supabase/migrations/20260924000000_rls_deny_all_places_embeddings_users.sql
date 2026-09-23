-- Migration: RLS deny-all on the 3 tables missing it (places, itinerary_embeddings, users).
-- Date: 2026-09-24
--
-- WHY:
--   The 3.4 RLS audit (specs/tarana-engineering-architecture-plan-audit.md §9
--   Phase 3) found 3 tables with no RLS in repo migrations:
--
--   - public.places (20260901000000_create_places.sql): server-only write via
--     supabaseAdmin upsert (activitySearch.ts:309); no anon/authenticated
--     access anywhere in src/.
--   - public.itinerary_embeddings (20240730000000_add_itinerary_embeddings_pgvector.sql):
--     server-only reads (itineraryUtils.ts:530,557) + RPC
--     match_activity_embeddings (intelligentSearch.ts:416 / vectorSearch.ts:86);
--     all callers use supabaseAdmin.
--   - public.users (no RLS policy file): service-role only (auth.ts,
--     passwordService, profileService, statsService, userService) + reset-token
--     index. The app mints no Supabase JWT for web users (NextAuth custom
--     users table, zero supabase.auth createUser calls — auth.ts:123-161).
--
--   Intended posture: deny-all by default (the default under RLS with no
--   policies), mirroring idempotency_keys (20260923010000). All current
--   access is service-role, which bypasses RLS entirely — enabling RLS
--   changes zero runtime behavior and only closes the hole for
--   anon/authenticated-key access through the Data API.
--
--   Idempotent: ENABLE ROW LEVEL SECURITY is a no-op when RLS is already on.
--
--   No policies are written on places/itinerary_embeddings: both are pure
--   cache/derived tables with no per-user rows. users gets no policy either:
--   no caller resolves auth.uid() today (web session is NextAuth, not
--   Supabase). A future authenticated access model should add explicit
--   ownership policies per the Supabase RLS rules (TO authenticated +
--   auth.uid() predicate), not permissive USING(true).
--
-- DEPLOY ORDER:
--   Apply directly. Safe on any environment: if a table does not exist yet
--   (fresh env applying migrations in order), the DO block skips it and the
--   earlier migration file's RLS is the source of truth. No code or runtime
--   behavior changes — supabaseAdmin (service role) bypasses RLS.

DO $$
BEGIN
  IF to_regclass('public.places') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.places ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.itinerary_embeddings') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.itinerary_embeddings ENABLE ROW LEVEL SECURITY';
  END IF;
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.users ENABLE ROW LEVEL SECURITY';
  END IF;
END
$$;
