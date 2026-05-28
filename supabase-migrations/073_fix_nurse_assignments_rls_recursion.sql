-- Fix infinite recursion introduced by migration 071.
--
-- Root cause: 071 policies on nurse_patient_assignments queried the patients
-- table to resolve facility scope. The patients table has a policy
-- ("Nurses see assigned patients") that queries nurse_patient_assignments,
-- creating a circular RLS dependency → infinite recursion.
--
-- Fix: Remove the patients subquery from nurse_patient_assignments policies.
-- Facility-level scoping is already enforced by patients table RLS.
-- nurse_patient_assignments only needs to control row-level ownership.

DROP POLICY IF EXISTS "Nurses see own assignments" ON nurse_patient_assignments;
DROP POLICY IF EXISTS "Head nurses and superadmins manage assignments" ON nurse_patient_assignments;

-- SELECT: nurses see their own rows; head nurses and superadmins see all rows
-- (facility scope is enforced upstream by patients RLS — no need to re-check here)
CREATE POLICY "Nurses see own assignments" ON nurse_patient_assignments
  FOR SELECT
  USING (
    nurse_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('head_nurse', 'superadmin')
    )
  );

-- INSERT / UPDATE / DELETE: only head nurses and superadmins
CREATE POLICY "Head nurses and superadmins manage assignments" ON nurse_patient_assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('head_nurse', 'superadmin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role IN ('head_nurse', 'superadmin')
    )
  );
