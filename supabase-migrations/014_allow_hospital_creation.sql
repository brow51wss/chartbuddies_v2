-- Allow users without hospital_id to create hospitals
-- This enables the auto-fix feature in patient registration

-- Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Users can create hospitals" ON hospitals;

-- Allow authenticated users to insert hospitals if they don't have a hospital_id
-- This is needed for the auto-fix feature when users sign up
CREATE POLICY "Users can create hospitals" ON hospitals
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    (
      -- Allow if user doesn't have a hospital_id yet (for new signups)
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.hospital_id IS NULL
      )
      OR
      -- Allow superadmins to create hospitals
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'superadmin'
      )
    )
  );

-- Also allow users to see hospitals they just created (for the auto-fix flow)
-- This is a temporary policy to help with the creation flow
DROP POLICY IF EXISTS "Users can see hospitals they created" ON hospitals;
CREATE POLICY "Users can see hospitals they created" ON hospitals
  FOR SELECT
  USING (
    -- Allow if user doesn't have a hospital_id (they might have just created one)
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id IS NULL
    )
    OR
    -- Existing policies (superadmin or own hospital)
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
    OR
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = hospitals.id
    )
  );

-- Verify policies
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
WHERE tablename = 'hospitals'
ORDER BY policyname;

