-- RLS policies for public.itineraries.
--
-- Every policy carries `TO authenticated`. That clause is load-bearing, not
-- formatting: without it a policy defaults to PUBLIC, matching every role that
-- exists now and every role added later. Production scopes all four to
-- `authenticated` (read live: roles = {authenticated} on all four), so a
-- replay without the clause produced a strictly broader policy set than the
-- database it was meant to describe.
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
