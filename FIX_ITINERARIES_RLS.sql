-- KEEP RLS ON FOR ITINERARIES
-- RLS is enabled but won't affect your app since you're using supabaseAdmin
-- This provides an extra layer of security for direct database access

-- Ensure RLS is enabled
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Users can view their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can create their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can update their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Users can delete their own itineraries" ON public.itineraries;
DROP POLICY IF EXISTS "Enable all operations for authenticated users" ON public.itineraries;

-- Create policies (these won't affect your app since you use admin client)
-- But they provide protection if someone accesses the database directly
CREATE POLICY "Users can view their own itineraries" 
ON public.itineraries 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own itineraries" 
ON public.itineraries 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own itineraries" 
ON public.itineraries 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own itineraries" 
ON public.itineraries 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Verify RLS is enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'itineraries';

-- Check policies
SELECT 
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE tablename = 'itineraries';
