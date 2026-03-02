-- Phase 4: Invite signup – lookup invite + facility name (for locked fields) and enforce email match when invite was sent to a specific email.

-- ============================================
-- 1. GET INVITE DETAILS FOR SIGNUP (anon-safe, returns facility name)
-- ============================================
CREATE OR REPLACE FUNCTION get_facility_invite_for_signup(p_code VARCHAR)
RETURNS TABLE(invited_email VARCHAR, designation VARCHAR, facility_name VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fi.invited_email,
    fi.designation,
    h.name AS facility_name
  FROM facility_invites fi
  JOIN hospitals h ON h.id = fi.hospital_id
  WHERE UPPER(TRIM(fi.code)) = UPPER(TRIM(p_code))
    AND fi.used_by IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_facility_invite_for_signup(VARCHAR) TO anon;
GRANT EXECUTE ON FUNCTION get_facility_invite_for_signup(VARCHAR) TO authenticated;

-- ============================================
-- 2. JOIN FACILITY VIA INVITE – require email match when invite has invited_email
-- ============================================
-- Drop the 3-arg version so we can create the 4-arg one (Postgres cannot replace with different signature)
DROP FUNCTION IF EXISTS join_facility_via_invite(VARCHAR, UUID, VARCHAR);

CREATE OR REPLACE FUNCTION join_facility_via_invite(
  p_code VARCHAR,
  p_user_id UUID,
  p_full_name VARCHAR,
  p_email VARCHAR DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_result RECORD;
BEGIN
  -- Load invite and enforce email match when invite was sent to a specific email
  SELECT fi.id, fi.invited_email
  INTO v_invite
  FROM facility_invites fi
  WHERE UPPER(TRIM(fi.code)) = UPPER(TRIM(p_code))
    AND fi.used_by IS NULL;

  IF v_invite.id IS NULL THEN
    RETURN FALSE; -- No matching unused invite
  END IF;

  IF v_invite.invited_email IS NOT NULL AND TRIM(v_invite.invited_email) <> '' THEN
    IF p_email IS NULL OR TRIM(p_email) = '' THEN
      RAISE EXCEPTION 'This invite was sent to a specific email. Please use the signup link from that email.';
    END IF;
    IF LOWER(TRIM(v_invite.invited_email)) <> LOWER(TRIM(p_email)) THEN
      RAISE EXCEPTION 'This invite was sent to a different email address. You must sign up with the email that received the invite.';
    END IF;
  END IF;

  -- Apply invite (marks as used, returns hospital_id, designation)
  -- Do not add AS t(col list) here: the function already has OUT params; redundant column list causes PG error.
  SELECT * INTO v_result
  FROM apply_facility_invite(p_code, p_user_id) AS t;

  IF v_result.hospital_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update user profile: join facility as nurse with pre-assigned designation, locked
  UPDATE user_profiles
  SET
    hospital_id = v_result.hospital_id,
    role = 'nurse',
    full_name = COALESCE(NULLIF(trim(p_full_name), ''), full_name),
    designation = v_result.designation,
    designation_locked = true,
    updated_at = NOW()
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION join_facility_via_invite(VARCHAR, UUID, VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION join_facility_via_invite(VARCHAR, UUID, VARCHAR, VARCHAR) TO anon;
