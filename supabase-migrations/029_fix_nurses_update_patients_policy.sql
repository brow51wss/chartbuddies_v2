-- Fix RLS policy for nurses to update patients
-- Add WITH CHECK clause to allow updates

DROP POLICY IF EXISTS "Nurses can update assigned patients" ON patients;

CREATE POLICY "Nurses can update assigned patients" ON patients
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nurse_patient_assignments npa
      JOIN user_profiles up ON up.id = npa.nurse_id
      WHERE up.id = auth.uid()
      AND npa.patient_id = patients.id
      AND npa.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nurse_patient_assignments npa
      JOIN user_profiles up ON up.id = npa.nurse_id
      WHERE up.id = auth.uid()
      AND npa.patient_id = patients.id
      AND npa.is_active = true
    )
  );

