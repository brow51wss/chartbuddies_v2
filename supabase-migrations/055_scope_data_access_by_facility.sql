-- Restrict data access to user's facility only.
-- Superadmins with hospital_id set = facility-scoped (like head_nurse).
-- Superadmins with hospital_id IS NULL = platform admin (cross-facility for support).

-- ============================================
-- HOSPITALS
-- ============================================

DROP POLICY IF EXISTS "Superadmins see all hospitals" ON hospitals;
CREATE POLICY "Superadmins see all hospitals" ON hospitals
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id IS NULL
    )
  );

-- ============================================
-- PATIENTS
-- ============================================

-- "Superadmins see all patients" - only platform superadmins (no facility)
DROP POLICY IF EXISTS "Superadmins see all patients" ON patients;
CREATE POLICY "Superadmins see all patients" ON patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id IS NULL
    )
  );

-- "Superadmins can manage all patients" (052) - only platform superadmins
DROP POLICY IF EXISTS "Superadmins can manage all patients" ON patients;
CREATE POLICY "Superadmins can manage all patients" ON patients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'superadmin'
      AND user_profiles.hospital_id IS NULL
    )
  );

-- ============================================
-- MAR_FORMS
-- ============================================

DROP POLICY IF EXISTS "Users see relevant MAR forms" ON mar_forms;
CREATE POLICY "Users see relevant MAR forms" ON mar_forms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (up.hospital_id = mar_forms.hospital_id AND up.role IN ('superadmin', 'head_nurse'))
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id AND npa.patient_id = mar_forms.patient_id AND npa.is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can manage MAR forms for accessible patients" ON mar_forms;
CREATE POLICY "Users can manage MAR forms for accessible patients" ON mar_forms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (up.hospital_id = mar_forms.hospital_id AND up.role IN ('superadmin', 'head_nurse'))
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id AND npa.patient_id = mar_forms.patient_id AND npa.is_active = true
        )
      )
    )
  );

-- ============================================
-- MAR_MEDICATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can manage MAR medications" ON mar_medications;
CREATE POLICY "Users can manage MAR medications" ON mar_medications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_medications.mar_form_id
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

-- ============================================
-- MAR_ADMINISTRATIONS
-- ============================================

DROP POLICY IF EXISTS "Users can manage MAR administrations" ON mar_administrations;
CREATE POLICY "Users can manage MAR administrations" ON mar_administrations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_medications mm
      JOIN mar_forms mf ON mf.id = mm.mar_form_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mm.id = mar_administrations.mar_medication_id
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

-- ============================================
-- MAR_PRN_RECORDS
-- ============================================

DROP POLICY IF EXISTS "Users can manage MAR PRN records" ON mar_prn_records;
CREATE POLICY "Users can manage MAR PRN records" ON mar_prn_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_prn_records.mar_form_id
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

-- ============================================
-- MAR_VITAL_SIGNS
-- ============================================

DROP POLICY IF EXISTS "Users can manage vital signs" ON mar_vital_signs;
CREATE POLICY "Users can manage vital signs" ON mar_vital_signs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM mar_forms mf
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE mf.id = mar_vital_signs.mar_form_id
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

-- ============================================
-- PROGRESS_NOTE_ENTRIES
-- ============================================

DROP POLICY IF EXISTS "Users can manage progress notes for accessible patients" ON progress_note_entries;
CREATE POLICY "Users can manage progress notes for accessible patients" ON progress_note_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE p.id = progress_note_entries.patient_id
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (up.hospital_id = p.hospital_id AND up.role IN ('superadmin', 'head_nurse'))
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id AND npa.patient_id = p.id AND npa.is_active = true
        )
      )
    )
  );

-- ============================================
-- PROGRESS_NOTE_MONTHLY_SUMMARIES
-- ============================================

DROP POLICY IF EXISTS "Users can manage progress note summaries for accessible patients" ON progress_note_monthly_summaries;
CREATE POLICY "Users can manage progress note summaries for accessible patients" ON progress_note_monthly_summaries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE p.id = progress_note_monthly_summaries.patient_id
      AND (
        (up.role = 'superadmin' AND up.hospital_id IS NULL)
        OR (up.hospital_id = p.hospital_id AND up.role IN ('superadmin', 'head_nurse'))
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id AND npa.patient_id = p.id AND npa.is_active = true
        )
      )
    )
  );
