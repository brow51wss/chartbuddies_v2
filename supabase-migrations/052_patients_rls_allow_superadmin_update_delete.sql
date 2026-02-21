-- Allow superadmins to UPDATE and DELETE any patient (e.g. soft-delete / restore).
-- The existing "Head nurses can manage patients" requires hospital_id match and IS NOT NULL,
-- so superadmins with hospital_id = NULL could not update or delete.

DROP POLICY IF EXISTS "Superadmins can manage all patients" ON patients;

CREATE POLICY "Superadmins can manage all patients" ON patients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
    )
  );
