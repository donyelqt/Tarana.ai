-- Migration: saved_meal_notes — user-editable title and notes on saved meals.
-- Date: 2026-10-30
--
-- WHY:
--   Saved meals are read-only snapshots of a generated recommendation: the
--   cafe_name, price, hours, and full menu all come from the restaurant
--   catalog, not from user input. Users cannot personalize or annotate a
--   saved meal today — there is no edit UI, no PATCH endpoint, and no
--   storage for user-authored fields.
--
--   This migration adds a companion table that stores a per-user title
--   (nickname) and freeform notes for each saved meal, so the edit feature
--   can write user data without touching the hardened saved_meals table
--   (RLS remediation 2026-09-19).
--
-- DESIGN NOTES:
--   - One row per (user_id, meal_id): the same meal saved by two users has
--     independent notes. A meal that belongs to neither has no row.
--   - title is nullable: null falls back to the cafe_name display.
--   - notes is nullable: null means "no notes written yet".
--   - updated_at is bumped by the PATCH endpoint via supabaseAdmin.upsert;
--     no trigger is needed because all writes go through the server route.
--   - RLS is enabled with user-scoped policies, mirroring saved_meals. Even
--     though the app reaches this table only through the service-role admin
--     client, denying anon access is the correct default posture.
--
-- DEPLOY ORDER:
--   Apply this migration; the table is empty until the API route is live.
--   Backward-compatible — existing reads/writes to saved_meals are unchanged.

CREATE TABLE IF NOT EXISTS public.saved_meal_notes (
    id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          uuid          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    meal_id          uuid          NOT NULL REFERENCES public.saved_meals(id) ON DELETE CASCADE,
    title            text,
    notes            text,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_meal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own meal notes"
    ON public.saved_meal_notes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own meal notes"
    ON public.saved_meal_notes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meal notes"
    ON public.saved_meal_notes FOR UPDATE
    USING (auth.uid() = user_id);

-- One notes row per (user, meal) — upsert semantics in the route rely on this.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meal_notes_user_meal
    ON public.saved_meal_notes (user_id, meal_id);

-- Lookup by meal_id (for the detail page) and by user_id (for list fetches).
CREATE INDEX IF NOT EXISTS idx_saved_meal_notes_meal
    ON public.saved_meal_notes (meal_id);
CREATE INDEX IF NOT EXISTS idx_saved_meal_notes_user
    ON public.saved_meal_notes (user_id);
