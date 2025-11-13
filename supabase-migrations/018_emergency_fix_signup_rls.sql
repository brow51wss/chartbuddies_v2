-- EMERGENCY FIX: Make signup work by allowing authenticated users to create hospitals
-- This is a more permissive approach that ensures signup always works

-- ============================================
-- 1. DROP ALL EXISTING HOSPITAL INSERT POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can create hospitals" ON hospitals;
DROP POLICY IF EXISTS "Superadmins can create hospitals" ON hospitals;

-- ============================================
-- 2. CREATE SIMPLE, PERMISSIVE POLICY
-- ============================================
-- Allow ANY authenticated user to create a hospital
-- We'll validate in the application code and function
CREATE POLICY "Authenticated users can create hospitals" ON hospitals
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 3. ENSURE FUNCTION EXISTS AND WORKS
-- ============================================
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
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Check if user already has a hospital_id (prevent duplicates)
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = v_user_id
    AND hospital_id IS NOT NULL
    AND role != 'superadmin'
  ) THEN
    RAISE EXCEPTION 'User already has a hospital assigned';
  END IF;
  
  -- Create hospital (bypasses RLS due to SECURITY DEFINER)
  INSERT INTO hospitals (name, facility_type, invite_code)
  VALUES (p_name, p_facility_type, p_invite_code)
  RETURNING id INTO v_hospital_id;
  
  RETURN v_hospital_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_hospital_safe TO authenticated;
GRANT EXECUTE ON FUNCTION create_hospital_safe TO anon;

-- ============================================
-- 4. VERIFY
-- ============================================
SELECT 'Emergency fix applied' as status;
SELECT policyname, cmd, with_check 
FROM pg_policies 
WHERE tablename = 'hospitals' 
AND cmd = 'INSERT';

