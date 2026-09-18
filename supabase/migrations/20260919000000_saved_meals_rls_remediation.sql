-- Migration: saved_meals RLS remediation.
-- Date: 2026-09-19
--
-- WHY:
--   Live probes on prod (vryamakpawtzmvgnifie) 2026-09-19: the anon key can
--   SELECT all 43 saved_meals rows across users, PATCH any user's row
--   (verified write + restore), DELETE (204). The permissive policies
--   (USING(true)/WITH CHECK(true), names 'Enable read/insert/update/delete
--   for users') came from a hand-applied FIX_SAVED_MEALS_RLS_FINAL.sql whose
--   repo copy was deleted in PR #482 without remediation. The intended
--   auth.uid() = user_id policies (xxxxxx_create_saved_meals.sql) were never
--   applied.
--
--   This migration restores the intended strict policies.
--
-- DEPLOY ORDER (critical):
--   1. Deploy the web code migration FIRST: saved_meals reads/writes moved
--      off the anon-key client onto session-authed server routes
--      (/api/saved-meals, /api/saved-meals/[id]) using the service-role
--      admin client (RLS-bypassing, same pattern as savedItineraries).
--      WITHOUT this, strict RLS breaks real users: supabaseMeals.ts used
--      the anon key, and auth.uid() is NULL for every caller (the app mints
--      no Supabase JWT — NextAuth custom users table, zero supabase.auth
--      createUser calls; see src/lib/auth/auth.ts:123-161).
--   2. Mobile (tarana-mobile): set Supabase project setting
--      SUPABASE_JWT_SECRET = NEXTAUTH_SECRET. The mobile client sends the
--      NextAuth JWT as Bearer; Supabase validates it when the JWT secret
--      matches, so auth.uid() resolves to sub = public.users.id
--      (mobileTokenExchange.ts:131-137), which equals saved_meals.user_id.
--      Without this, importWebMeals breaks under strict RLS.
--   3. Apply THIS migration via the Supabase SQL editor, then run
--      scripts/prove-saved-meals-rls.mjs (anon -> 0 rows/403 on all ops;
--      service-role -> 2xx).
--
--   If step 1/2 are not live when this runs, real users lose saved meals
--   (regression window). The hole is ALREADY open today, so delaying the
--   SQL only extends exposure — ship code + SQL in the same release window.
--
-- NOTE: service-role callers (GET/POST /api/saved-meals, /api/stats)
-- bypass RLS entirely and are unaffected.

ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;

-- Drop BOTH policy sets: the permissive hand-applied ones and the intended
-- (possibly partially applied) strict ones — then recreate cleanly.
DROP POLICY IF EXISTS "Enable read access for users"   ON public.saved_meals;
DROP POLICY IF EXISTS "Enable insert for users"        ON public.saved_meals;
DROP POLICY IF EXISTS "Enable update for users"        ON public.saved_meals;
DROP POLICY IF EXISTS "Enable delete for users"        ON public.saved_meals;
DROP POLICY IF EXISTS "Users can view their own saved meals"  ON public.saved_meals;
DROP POLICY IF EXISTS "Users can create their own saved meals" ON public.saved_meals;
DROP POLICY IF EXISTS "Users can update their own saved meals" ON public.saved_meals;
DROP POLICY IF EXISTS "Users can delete their own saved meals" ON public.saved_meals;

CREATE POLICY "Users can view their own saved meals"
  ON public.saved_meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own saved meals"
  ON public.saved_meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own saved meals"
  ON public.saved_meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own saved meals"
  ON public.saved_meals FOR DELETE USING (auth.uid() = user_id);