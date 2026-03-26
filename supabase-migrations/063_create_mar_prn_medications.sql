-- PRN medication library per MAR form.
-- Used by the top "+ PRN" action to create reusable PRN choices.

CREATE TABLE IF NOT EXISTS mar_prn_medications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mar_form_id UUID NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,
  date_added DATE NOT NULL DEFAULT CURRENT_DATE,
  medication VARCHAR(255) NOT NULL,
  dosage TEXT,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_prn_medications_mar_form_id ON mar_prn_medications(mar_form_id);
CREATE INDEX IF NOT EXISTS idx_mar_prn_medications_medication ON mar_prn_medications(medication);

ALTER TABLE mar_prn_medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage MAR PRN medications" ON mar_prn_medications;
CREATE POLICY "Users can manage MAR PRN medications" ON mar_prn_medications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_prn_medications.mar_form_id
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (up.hospital_id = mf.hospital_id AND up.role IN ('superadmin', 'head_nurse'))
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id AND npa.patient_id = mf.patient_id AND npa.is_active = true
        )
      )
    )
  );

DROP TRIGGER IF EXISTS update_mar_prn_medications_updated_at ON mar_prn_medications;
CREATE TRIGGER update_mar_prn_medications_updated_at
  BEFORE UPDATE ON mar_prn_medications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
