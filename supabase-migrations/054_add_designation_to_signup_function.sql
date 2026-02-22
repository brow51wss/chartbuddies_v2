-- Add designation parameter to update_user_profile_on_signup so it's set during signup
-- (avoids relying on a follow-up client update that can fail due to RLS/session)

DROP FUNCTION IF EXISTS update_user_profile_on_signup(UUID, UUID, VARCHAR, VARCHAR);

CREATE OR REPLACE FUNCTION update_user_profile_on_signup(
  p_user_id UUID,
  p_hospital_id UUID,
  p_role VARCHAR,
  p_full_name VARCHAR,
  p_designation VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Can only update own profile';
  END IF;

  UPDATE user_profiles up
  SET
    hospital_id = p_hospital_id,
    role = p_role,
    full_name = COALESCE(p_full_name, up.full_name),
    designation = COALESCE(NULLIF(trim(p_designation), ''), up.designation),
    updated_at = NOW()
  WHERE up.id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_profiles (id, email, full_name, role, hospital_id, designation)
    VALUES (
      p_user_id,
      COALESCE((SELECT email FROM auth.users WHERE id = p_user_id), ''),
      COALESCE(p_full_name, 'User'),
      p_role,
      p_hospital_id,
      NULLIF(trim(p_designation), '')
    )
    ON CONFLICT (id) DO UPDATE SET
      hospital_id = p_hospital_id,
      role = p_role,
      full_name = COALESCE(p_full_name, user_profiles.full_name),
      designation = COALESCE(NULLIF(trim(p_designation), ''), user_profiles.designation),
      updated_at = NOW();
  END IF;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user_profile_on_signup TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_profile_on_signup TO anon;
