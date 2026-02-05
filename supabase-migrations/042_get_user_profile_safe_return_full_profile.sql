-- Return full profile from get_user_profile_safe so staff_initials, staff_signature, designation, etc. are available
-- when the app uses the RPC fallback (e.g. after login). Previously only id, email, full_name, role, hospital_id, created_at, updated_at were returned.
DROP FUNCTION IF EXISTS get_user_profile_safe(UUID);

CREATE OR REPLACE FUNCTION get_user_profile_safe(p_user_id UUID)
RETURNS SETOF user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT up.*
  FROM user_profiles up
  WHERE up.id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_profile_safe(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_profile_safe(UUID) TO anon;
