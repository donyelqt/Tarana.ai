-- ============================================================================
-- Baseline: public.users and public.itineraries
--
-- WHY THIS FILE EXISTS
--   Both tables are referenced throughout supabase/migrations/ but created by
--   none of its files. They were built by hand in the Supabase SQL Editor, so
--   the chain has never been able to replay from an empty database:
--
--     [1] 20240101000000_create_rls_policies.sql
--     psql:...:3: ERROR: relation "itineraries" does not exist
--
--   This file captures their live shape so the chain can start from zero. It
--   must sort BEFORE 20240101000000_create_rls_policies.sql, which is why its
--   version is 20231231000000 rather than a 2024+ timestamp.
--
-- SOURCE OF TRUTH
--   Read from the live catalogue via the Management API read-only endpoint
--   (POST /v1/projects/{ref}/database/query/read-only), not reconstructed from
--   application code. Columns, constraints, indexes, grants and policies below
--   are what production actually has.
--
-- WHAT IS DELIBERATELY NOT HERE
--   The four itineraries RLS policies. They exist live with
--   `TO authenticated`, but they are NOT in this baseline on purpose:
--   20240101000000_create_rls_policies.sql creates policies with the same four
--   names and has no `DROP POLICY IF EXISTS` ahead of them, so creating them
--   here would make that migration fail with "policy already exists" and the
--   chain still would not replay. That migration owns those policies, and it
--   now carries the same `TO authenticated` scoping live has.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- public.users
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                  uuid primary key default gen_random_uuid(),
  full_name           text,
  email               text not null,
  password            text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz default now(),
  email_verified      boolean default false,
  hashed_password     text not null,
  image               text,
  reset_token         text,
  reset_token_expiry  timestamptz,
  location            varchar(200),
  bio                 text,
  tos_accepted_at     timestamptz,
  password_changed_at timestamptz
);

-- Live has BOTH unique constraints, not one. users_email_key is the table
-- constraint; users_email_unique is a separate index. Reproduced verbatim so a
-- replay does not silently converge on a weaker shape than production.
alter table public.users drop constraint if exists users_email_key;
alter table public.users add constraint users_email_key unique (email);
create unique index if not exists users_email_unique on public.users (email);
create index if not exists idx_users_email on public.users (email);
create index if not exists idx_users_reset_token
  on public.users (reset_token) where reset_token is not null;

alter table public.users enable row level security;


-- ---------------------------------------------------------------------------
-- public.itineraries
-- ---------------------------------------------------------------------------
create table if not exists public.itineraries (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.users(id) on delete cascade,
  title                text,
  date                 text,
  budget               text,
  image                text,
  tags                 text[],
  form_data            jsonb,
  itinerary_data       jsonb,
  weather_data         jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz default now(),
  refresh_metadata     jsonb,
  traffic_snapshot     jsonb,
  activity_coordinates jsonb
);

create index if not exists idx_itineraries_user_id
  on public.itineraries (user_id);
create index if not exists idx_itineraries_refresh_metadata
  on public.itineraries using gin (refresh_metadata);
create index if not exists idx_itineraries_traffic_snapshot
  on public.itineraries using gin (traffic_snapshot);
create index if not exists idx_itineraries_activity_coordinates
  on public.itineraries using gin (activity_coordinates);
create index if not exists idx_itineraries_refresh_status
  on public.itineraries (((refresh_metadata ->> 'status'::text)));
create index if not exists idx_itineraries_last_evaluated
  on public.itineraries (((refresh_metadata ->> 'lastEvaluatedAt'::text)));
create index if not exists idx_itineraries_auto_refresh
  on public.itineraries (((refresh_metadata ->> 'autoRefreshEnabled'::text)));

alter table public.itineraries enable row level security;

-- NOTE: the four itineraries RLS policies are intentionally absent. See the
-- header. They are created by 20240101000000_create_rls_policies.sql.


-- ---------------------------------------------------------------------------
-- public.users RLS policies
--
-- These six exist live and appear in NO migration — verified: grep for each
-- name across supabase/migrations/ returns nothing. They are part of the same
-- hand-built state as the tables themselves, so the baseline owns them.
--
-- FINDING, reported separately and NOT silently "fixed" here:
--   20260924000000_rls_deny_all_places_embeddings_users.sql states in its own
--   header that users "gets no policy either" and is intended to be
--   service-role only. Its body only runs ENABLE ROW LEVEL SECURITY; it never
--   drops these. So live users carries six policies that contradict a later
--   migration's documented intent.
--   They are inert today (the app mints no Supabase JWT, so auth.uid() is null
--   and these predicates match nothing), but they are reproduced here so a
--   replay converges on production rather than on an idealised version of it.
-- ---------------------------------------------------------------------------
drop policy if exists "Select own user" on public.users;
create policy "Select own user" on public.users
  for select to public using (id = auth.uid());

drop policy if exists "select_own_users" on public.users;
create policy "select_own_users" on public.users
  for select to public using (id = auth.uid());

drop policy if exists "Select own user record" on public.users;
create policy "Select own user record" on public.users
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "Insert user record" on public.users;
create policy "Insert user record" on public.users
  for insert to authenticated with check (true);

drop policy if exists "Update own user record" on public.users;
create policy "Update own user record" on public.users
  for update to authenticated using ((select auth.uid()) = id) with check (true);

drop policy if exists "Delete own user record" on public.users;
create policy "Delete own user record" on public.users
  for delete to authenticated using ((select auth.uid()) = id);


-- ---------------------------------------------------------------------------
-- Grants
--
-- Live: anon, authenticated and service_role hold ALL privileges on both
-- tables (relacl: arwdDxtm). That is Supabase's default posture for the public
-- schema. Stated explicitly so the replay result does not depend on whether a
-- given image ships the same default privileges.
-- ---------------------------------------------------------------------------
grant all on public.users to anon, authenticated, service_role;
grant all on public.itineraries to anon, authenticated, service_role;


-- ============================================================================
-- DIVERGENCE CLOSED 2026-09-29
--
-- This file previously ended with a KNOWN DIVERGENCE note recording that a
-- replay produced the four itineraries policies as `{public}` while live had
-- them at `{authenticated}`, because 20240101000000_create_rls_policies.sql
-- omitted the TO clause.
--
-- That migration now carries `to authenticated` on all four, and the replay
-- gate asserts the result:
--
--   select count(*) from pg_policies
--   where schemaname='public' and tablename='itineraries'
--     and roles = '{authenticated}'        -- must be 4
--
-- so the two cannot drift apart again without CI failing. See the
-- "Assert the replay produced the expected schema" step in ci.yml.
--
-- Direction, stated because it was misread three times: the MIGRATION was
-- edited to match a database that was already correct. The baseline was not
-- changed and production was never touched.
--
-- STILL OPEN, and genuinely so: 20260924000000 would look like it drops the
-- six users policies above and does not -- it only enables RLS. Reconciling
-- those two files needs a decision about whether `users` should carry any
-- policies at all, given the app mints no Supabase JWT and they filter every
-- row either way. Documentation-only; no action implied.
-- ============================================================================
