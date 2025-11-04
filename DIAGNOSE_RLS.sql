-- DIAGNOSTIC SCRIPT FOR SAVED_MEALS RLS
-- Run each section separately in Supabase SQL Editor

-- ============================================
-- SECTION 1: Check if table exists and RLS is enabled
-- ============================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'saved_meals';

-- ============================================
-- SECTION 2: Check current policies
-- ============================================
SELECT 
  policyname,
  cmd as operation,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'saved_meals';

-- ============================================
-- SECTION 3: Check your current user ID
-- ============================================
SELECT auth.uid() as my_user_id;

-- ============================================
-- SECTION 4: Check if there's any data in the table
-- (This bypasses RLS - only works if you're postgres/admin)
-- ============================================
SELECT 
  id,
  user_id,
  cafe_name,
  meal_type,
  created_at
FROM public.saved_meals
LIMIT 5;

-- ============================================
-- SECTION 5: Try to select with RLS (as authenticated user)
-- ============================================
SELECT * FROM public.saved_meals;

-- ============================================
-- SECTION 6: Insert a test record
-- ============================================
INSERT INTO public.saved_meals (
  user_id,
  cafe_name,
  meal_type,
  price,
  good_for,
  location
) VALUES (
  auth.uid(),
  'Test Cafe',
  'Lunch',
  12.50,
  'Solo',
  'Test Location'
) RETURNING *;
