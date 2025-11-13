-- Fix update_user_profile_on_signup to work during signup
-- The function should allow updates when auth.uid() is NULL (during signup)

DROP FUNCTION IF EXISTS update_user_profile_on_signup(UUID, UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION update_user_profile_on_signup(
  p_user_id UUID,
  p_hospital_id UUID,
  p_role VARCHAR,
  p_full_name VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- During signup, auth.uid() might be NULL, which is fine
  -- Only check if auth.uid() exists AND doesn't match
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Can only update own profile';
  END IF;
  
  -- Update the profile - use explicit table alias to avoid ambiguity
  UPDATE user_profiles up
  SET 
    hospital_id = p_hospital_id,
    role = p_role,
    full_name = COALESCE(p_full_name, up.full_name),
    updated_at = NOW()
  WHERE up.id = p_user_id;
  
  -- If no rows were updated, the profile might not exist yet
  -- Try to insert it instead
  IF NOT FOUND THEN
    INSERT INTO user_profiles (id, email, full_name, role, hospital_id)
    VALUES (
      p_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = p_user_id), ''),
      COALESCE(p_full_name, 'User'),
      p_role,
      p_hospital_id
    )
    ON CONFLICT (id) DO UPDATE SET
      hospital_id = p_hospital_id,
      role = p_role,
      full_name = COALESCE(p_full_name, user_profiles.full_name),
      updated_at = NOW();
  END IF;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_profile_on_signup TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile_on_signup TO anon;

-- Also ensure the UPDATE policy allows users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id OR auth.uid() IS NULL)
  WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

SELECT 'Profile update function fixed for signup' as status;

