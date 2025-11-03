-- Fix RLS policies for user_profiles to ensure users can see their own profile
-- Run this in Supabase SQL Editor

-- Drop ALL existing SELECT policies to start fresh
DROP POLICY IF EXISTS "Users see profiles in their hospital" ON user_profiles;
DROP POLICY IF EXISTS "Users can always see own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can see hospital profiles" ON user_profiles;

-- CRITICAL: Users MUST be able to see their own profile (simple check, no dependencies)
CREATE POLICY "Users can see own profile" ON user_profiles
  FOR SELECT
  USING (id = auth.uid());

-- Ensure users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Test: Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
ORDER BY policyname;

