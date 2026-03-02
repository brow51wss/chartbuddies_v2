-- After login: if the user has a pending invite for their email (invited_email = their email, used_by IS NULL),
-- apply it so they join the facility without having to sign up again.

CREATE OR REPLACE FUNCTION apply_pending_invite_for_current_user()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_code text;
  v_result record;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT fi.code INTO v_code
  FROM facility_invites fi
  WHERE LOWER(TRIM(fi.invited_email)) = LOWER(TRIM(v_email))
    AND fi.used_by IS NULL
  ORDER BY fi.invited_at DESC NULLS LAST
  LIMIT 1;

  IF v_code IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_result FROM apply_facility_invite(v_code, auth.uid()) AS t;

  IF v_result.hospital_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE user_profiles
  SET
    hospital_id = v_result.hospital_id,
    role = 'nurse',
    designation = v_result.designation,
    designation_locked = true,
    updated_at = NOW()
  WHERE id = auth.uid();

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_pending_invite_for_current_user() TO authenticated;
