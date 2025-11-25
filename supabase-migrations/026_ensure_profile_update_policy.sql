-- Ensure users can update their profile fields (full_name, staff_initials, staff_signature, designation)
-- This migration ensures the UPDATE policy exists and allows updating all profile fields

-- ============================================
-- 1. ENSURE UPDATE POLICY EXISTS
-- ============================================
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create/update policy to allow users to update their own profile
-- This allows updating: full_name, staff_initials, staff_signature, designation
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. VERIFY POLICY EXISTS
-- ============================================
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_profiles'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- ============================================
-- 3. VERIFY COLUMNS EXIST
-- ============================================
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('full_name', 'staff_initials', 'staff_signature', 'designation')
ORDER BY column_name;

