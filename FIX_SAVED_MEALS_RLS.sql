-- Fix RLS policies for saved_meals table
-- Run this in your Supabase SQL Editor

-- Step 1: Drop existing policies
drop policy if exists "Users can view their own saved meals" on public.saved_meals;
drop policy if exists "Users can create their own saved meals" on public.saved_meals;
drop policy if exists "Users can update their own saved meals" on public.saved_meals;
drop policy if exists "Users can delete their own saved meals" on public.saved_meals;

-- Step 2: Ensure RLS is enabled
alter table public.saved_meals enable row level security;

-- Step 3: Create correct policies with proper authentication check
create policy "Users can view their own saved meals" 
on public.saved_meals 
for select 
to authenticated
using (auth.uid() = user_id);

create policy "Users can create their own saved meals" 
on public.saved_meals 
for insert 
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own saved meals" 
on public.saved_meals 
for update 
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own saved meals" 
on public.saved_meals 
for delete 
to authenticated
using (auth.uid() = user_id);

-- Step 4: Verify policies are correctly applied
select 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual, 
  with_check
from pg_policies
where tablename = 'saved_meals';

-- Step 5: Check current user authentication (run this when logged in)
-- select auth.uid() as current_user_id;

-- Step 6: Test query (uncomment to test after running above)
-- select * from public.saved_meals;
