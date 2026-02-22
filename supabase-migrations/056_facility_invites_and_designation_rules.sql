-- Facility invites with pre-assigned designation
-- masteradmin (superadmin + hospital_id IS NULL): can assign PCG or SCG
-- superadmin/pcg (superadmin + hospital_id set): can only assign SCG
-- One PCG per facility
-- designation_locked: set when user joins via invite, prevents changing designation in profile

-- ============================================
-- 1. ADD designation_locked TO user_profiles
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS designation_locked BOOLEAN DEFAULT false;

-- ============================================
-- 2. ONE PCG PER FACILITY - unique partial index
-- ============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pcg_per_facility
ON user_profiles (hospital_id)
WHERE designation = 'PCG' AND hospital_id IS NOT NULL;

-- ============================================
-- 3. FACILITY_INVITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS facility_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  hospital_id UUID NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  designation VARCHAR(10) NOT NULL CHECK (designation IN ('PCG', 'SCG')),
  created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_facility_invites_code ON facility_invites(code);
CREATE INDEX idx_facility_invites_hospital ON facility_invites(hospital_id);
CREATE INDEX idx_facility_invites_used ON facility_invites(used_by) WHERE used_by IS NOT NULL;

-- ============================================
-- 4. RLS FOR facility_invites
-- ============================================
ALTER TABLE facility_invites ENABLE ROW LEVEL SECURITY;

-- Platform superadmin (hospital_id IS NULL) sees all invites
CREATE POLICY "Platform superadmin sees all facility_invites" ON facility_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id IS NULL
    )
  );

-- Facility superadmin sees invites for their facility only
CREATE POLICY "Facility superadmin sees own facility invites" ON facility_invites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id = facility_invites.hospital_id
    )
  );

-- Allow anon/authenticated to SELECT by code for signup lookup (public codes)
CREATE POLICY "Anyone can select facility_invite by code for signup" ON facility_invites
  FOR SELECT
  USING (true);

-- Allow anon to update used_by/used_at when applying invite (signup flow uses service role or anon)
-- We need a SECURITY DEFINER function for signup to mark invite as used and set designation_locked
-- For now: signup runs as authenticated user after auth, so we need UPDATE for the user applying
-- Actually: during signup the user is authenticated (they just created account). They can't update
-- facility_invites directly due to RLS. We need a function: apply_facility_invite(code, user_id)
-- that marks the invite as used and returns hospital_id, designation.

-- ============================================
-- 5. GENERATE INVITE CODE (8 chars, exclude confusing)
-- ============================================
CREATE OR REPLACE FUNCTION generate_facility_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT := '';
  i INT;
  exists_check BOOLEAN;
BEGIN
  FOR i IN 1..100 LOOP
    code := '';
    FOR j IN 1..8 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    SELECT NOT EXISTS (SELECT 1 FROM facility_invites WHERE facility_invites.code = code)
      AND NOT EXISTS (SELECT 1 FROM hospitals WHERE hospitals.invite_code = code)
    INTO exists_check;
    IF exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate unique invite code';
END;
$$;

-- ============================================
-- 6. CREATE FACILITY INVITE (checks rules)
-- ============================================
CREATE OR REPLACE FUNCTION create_facility_invite(
  p_hospital_id UUID,
  p_designation VARCHAR
)
RETURNS TABLE(id UUID, code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator RECORD;
  v_new_code TEXT;
  v_invite_id UUID;
BEGIN
  IF p_designation NOT IN ('PCG', 'SCG') THEN
    RAISE EXCEPTION 'Designation must be PCG or SCG';
  END IF;

  SELECT up.id, up.role, up.hospital_id INTO v_creator
  FROM user_profiles up
  WHERE up.id = auth.uid();

  IF v_creator.id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- masteradmin (superadmin + hospital_id IS NULL): can assign PCG or SCG
  -- superadmin/pcg (superadmin + hospital_id set): can only assign SCG
  IF v_creator.role = 'superadmin' AND v_creator.hospital_id IS NULL THEN
    -- masteradmin: OK for both
    NULL;
  ELSIF v_creator.role = 'superadmin' AND v_creator.hospital_id IS NOT NULL THEN
    -- facility superadmin/pcg: only SCG
    IF p_designation = 'PCG' THEN
      RAISE EXCEPTION 'You can only invite users as SCG. Only masteradmin can assign PCG.';
    END IF;
    IF v_creator.hospital_id != p_hospital_id THEN
      RAISE EXCEPTION 'You can only create invites for your facility';
    END IF;
  ELSE
    RAISE EXCEPTION 'Only masteradmin or facility admin can create invites';
  END IF;

  -- One PCG per facility
  IF p_designation = 'PCG' THEN
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE hospital_id = p_hospital_id AND designation = 'PCG'
    ) THEN
      RAISE EXCEPTION 'There is already a PCG for this facility. Only one PCG per facility is allowed.';
    END IF;
  END IF;

  v_new_code := generate_facility_invite_code();

  INSERT INTO facility_invites (code, hospital_id, designation, created_by)
  VALUES (v_new_code, p_hospital_id, p_designation, v_creator.id)
  RETURNING facility_invites.id, facility_invites.code INTO v_invite_id, v_new_code;

  RETURN QUERY SELECT v_invite_id, v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION create_facility_invite(UUID, VARCHAR) TO authenticated;

-- ============================================
-- 7. APPLY FACILITY INVITE (used during signup)
-- ============================================
CREATE OR REPLACE FUNCTION apply_facility_invite(
  p_code VARCHAR,
  p_user_id UUID
)
RETURNS TABLE(hospital_id UUID, designation VARCHAR)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
BEGIN
  -- Find unused invite by code
  SELECT id, facility_invites.hospital_id, facility_invites.designation
  INTO v_invite
  FROM facility_invites
  WHERE UPPER(TRIM(facility_invites.code)) = UPPER(TRIM(p_code))
    AND used_by IS NULL;

  IF v_invite.id IS NULL THEN
    RETURN; -- No matching invite
  END IF;

  -- Mark invite as used
  UPDATE facility_invites
  SET used_by = p_user_id, used_at = NOW()
  WHERE facility_invites.id = v_invite.id;

  -- One PCG per facility - check again at apply time (race condition guard)
  IF v_invite.designation = 'PCG' THEN
    IF EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.hospital_id = v_invite.hospital_id
        AND user_profiles.designation = 'PCG'
        AND user_profiles.id != p_user_id
    ) THEN
      RAISE EXCEPTION 'This facility already has a PCG. The invite may have expired.';
    END IF;
  END IF;

  RETURN QUERY SELECT v_invite.hospital_id, v_invite.designation;
END;
$$;

GRANT EXECUTE ON FUNCTION apply_facility_invite(VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_facility_invite(VARCHAR, UUID) TO anon;

-- ============================================
-- 8. JOIN FACILITY VIA INVITE (signup flow - updates profile + marks invite used)
-- ============================================
CREATE OR REPLACE FUNCTION join_facility_via_invite(
  p_code VARCHAR,
  p_user_id UUID,
  p_full_name VARCHAR
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Apply invite (gets hospital_id, designation; marks invite as used)
  SELECT * INTO v_result
  FROM apply_facility_invite(p_code, p_user_id) AS t(hospital_id UUID, designation VARCHAR);

  IF v_result.hospital_id IS NULL THEN
    RETURN FALSE; -- No matching unused invite
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

GRANT EXECUTE ON FUNCTION join_facility_via_invite(VARCHAR, UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION join_facility_via_invite(VARCHAR, UUID, VARCHAR) TO anon;
