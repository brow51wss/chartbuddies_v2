-- Add missing RLS policies for nurse_patient_assignments.
-- This table had RLS enabled but no policies, which silently blocked
-- all SELECT and INSERT operations from the app (dashboard.tsx, admissions.tsx).
--
-- Policy design:
--   Nurses        → can SELECT their own assignments only
--   Head nurses   → can SELECT and manage all assignments for their facility's patients
--   Superadmins (facility-scoped, hospital_id IS NOT NULL) → same as head_nurse
--   Superadmins (platform, hospital_id IS NULL) → full access across all facilities
--
-- Note: nurse_patient_assignments has no hospital_id column; facility scope is
-- resolved by joining through the patients table.

-- SELECT: nurses see their own assignments; head nurses / superadmins see facility-wide
DROP POLICY IF EXISTS "Nurses see own assignments" ON nurse_patient_assignments;
CREATE POLICY "Nurses see own assignments" ON nurse_patient_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        -- Platform superadmin: sees all
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        -- Nurse: sees only their own
        OR (up.role = 'nurse' AND nurse_patient_assignments.nurse_id = auth.uid())
        -- Head nurse or facility superadmin: sees assignments for their facility's patients
        OR (
          up.role IN ('head_nurse', 'superadmin')
          AND up.hospital_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = nurse_patient_assignments.patient_id
            AND p.hospital_id = up.hospital_id
          )
        )
      )
    )
  );

-- INSERT/UPDATE/DELETE: only head nurses and superadmins can manage assignments
DROP POLICY IF EXISTS "Head nurses and superadmins manage assignments" ON nurse_patient_assignments;
CREATE POLICY "Head nurses and superadmins manage assignments" ON nurse_patient_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        -- Platform superadmin: full access
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        -- Head nurse or facility superadmin: only for their facility's patients
        OR (
          up.role IN ('head_nurse', 'superadmin')
          AND up.hospital_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = nurse_patient_assignments.patient_id
            AND p.hospital_id = up.hospital_id
          )
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (
          up.role IN ('head_nurse', 'superadmin')
          AND up.hospital_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM patients p
            WHERE p.id = nurse_patient_assignments.patient_id
            AND p.hospital_id = up.hospital_id
          )
        )
      )
    )
  );
