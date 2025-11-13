-- Comprehensive fix for signup RLS issues
-- This creates a function that bypasses RLS for hospital creation during signup

-- ============================================
-- 1. CREATE FUNCTION TO SAFELY CREATE HOSPITALS
-- ============================================
-- This function bypasses RLS and can be called during signup
CREATE OR REPLACE FUNCTION create_hospital_safe(
  p_name VARCHAR(255),
  p_facility_type VARCHAR(100),
  p_invite_code VARCHAR(20)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hospital_id UUID;
  v_user_id UUID;
  v_has_hospital BOOLEAN;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already has a hospital_id
  SELECT hospital_id IS NOT NULL INTO v_has_hospital
  FROM user_profiles
  WHERE id = v_user_id;
  
  -- Only allow if user doesn't have a hospital_id
  IF v_has_hospital THEN
    -- Check if user is superadmin
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = v_user_id
      AND role = 'superadmin'
    ) THEN
      RAISE EXCEPTION 'User already has a hospital assigned';
    END IF;
  END IF;
  
  -- Create hospital (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO hospitals (name, facility_type, invite_code)
  VALUES (p_name, p_facility_type, p_invite_code)
  RETURNING id INTO v_hospital_id;
  
  RETURN v_hospital_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_hospital_safe TO authenticated;

-- ============================================
-- 2. FIX HOSPITAL INSERT POLICY (FALLBACK)
-- ============================================
DROP POLICY IF EXISTS "Users can create hospitals" ON hospitals;

-- More permissive policy that allows authenticated users during signup
CREATE POLICY "Users can create hospitals" ON hospitals
  FOR INSERT
  WITH CHECK (
    -- Must be authenticated
    auth.uid() IS NOT NULL 
    AND
    (
      -- Allow if user profile doesn't exist OR has NULL hospital_id
      -- This handles new signups where profile might not be visible yet
      NOT EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.hospital_id IS NOT NULL
      )
      OR
      -- Allow superadmins
      EXISTS (
        SELECT 1 FROM user_profiles
        WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'superadmin'
      )
    )
  );

-- ============================================
-- 3. VERIFY
-- ============================================
SELECT 'Function created successfully' as status;
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'hospitals' 
AND policyname = 'Users can create hospitals';

