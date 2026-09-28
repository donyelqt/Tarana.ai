-- RLS policies for public.itineraries.
--
-- THIS IS A MIGRATION. It is applied by tooling to a database that is BEHIND
-- it -- never pasted into the Supabase SQL Editor. Production is not behind it:
-- production is what it was written to describe.
--
-- Direction of the 2026-09-29 change. This file was EDITED TO MATCH a database
-- that was already correct; no database change accompanied it:
--
--   before this commit   the file said   `on itineraries for insert`
--   after  this commit   the file says   `on itineraries for insert to authenticated`
--   production, throughout               roles = {authenticated} on all four
--
-- Nothing needs applying. If someone reads this as a fix to run, the arrow is
-- backwards.
--
-- Why the clause is load-bearing: without `TO` a policy defaults to PUBLIC --
-- every role that exists now and every role added later -- where production
-- scopes all four to `authenticated`. The two evaluate identically today only
-- because `auth.uid()` is always null (the app mints no Supabase JWT), so both
-- predicates filter every row. The clause matters for fidelity, not for an
-- active vulnerability.
--
-- The gap was invisible until migration-replay began asserting role scoping.
-- See the "Assert the replay produced the expected schema" step in ci.yml.

create policy "Users can create their own itineraries"
on itineraries for insert to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own itineraries"
on itineraries for update to authenticated
using (auth.uid() = user_id);

-- Enable RLS on itineraries table
ALTER TABLE itineraries ENABLE ROW LEVEL SECURITY;

-- Allow users to select their own itineraries
create policy "Users can view their own itineraries"
on itineraries for select to authenticated
using (auth.uid() = user_id);

-- Allow users to delete their own itineraries
create policy "Users can delete their own itineraries"
on itineraries for delete to authenticated
using (auth.uid() = user_id);
