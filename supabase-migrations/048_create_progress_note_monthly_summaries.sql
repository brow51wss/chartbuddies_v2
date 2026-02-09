-- Progress Notes Page 2: Monthly Summary / Assessment (one per patient per month)
CREATE TABLE IF NOT EXISTS progress_note_monthly_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,

  -- Monthly Summary
  bp TEXT,
  pulse TEXT,
  resp TEXT,
  temp TEXT,
  wt TEXT,
  wt_change_yn TEXT,
  response_to_diet TEXT,

  -- Medication
  medication_available_yn TEXT,
  medication_secured_yn TEXT,
  taking_medications_yn TEXT,
  physician_notified_yn TEXT,
  physician_notified_date DATE,
  medication_changes_yn TEXT,
  response_to_medication TEXT,

  -- Treatments
  treatments_yn TEXT,
  treatments_type TEXT,
  response_to_treatment TEXT,
  therapy_yn TEXT,
  therapy_pt TEXT,
  therapy_ot TEXT,
  therapy_st TEXT,

  -- ADL
  adl_level TEXT,
  ambulation TEXT,
  continent_urine_yn TEXT,
  continent_stool_yn TEXT,
  incontinent_urine_yn TEXT,
  incontinent_stool_yn TEXT,
  timed_toileting_yn TEXT,
  diapers_yn TEXT,
  bm_type TEXT,

  -- Skin Integrity
  skin_intact_yn TEXT,
  wound_type TEXT,
  wound_location TEXT,
  wound_treatment TEXT,
  wound_response TEXT,

  -- Pain
  pain_yn TEXT,
  pain_location TEXT,
  pain_intensity TEXT,
  pain_cause TEXT,
  pain_treatment TEXT,
  pain_response TEXT,

  -- Mental (comma-separated or single values)
  mental_descriptors TEXT,
  impaired_communication_other TEXT,

  -- Changes and Actions
  describe_changes TEXT,
  date_md_notified DATE,
  actions TEXT,
  changes_in_condition_yn TEXT,
  illness_yn TEXT,
  injury_yn TEXT,
  date_physician_notified DATE,
  describe_type_actions_taken TEXT,

  -- Plan of Care
  plan_of_care TEXT,

  -- Signature
  signature TEXT,
  signature_title TEXT,
  signature_date DATE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, month_year)
);

CREATE INDEX idx_progress_note_summaries_patient ON progress_note_monthly_summaries(patient_id);
CREATE INDEX idx_progress_note_summaries_month ON progress_note_monthly_summaries(patient_id, month_year);

ALTER TABLE progress_note_monthly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage progress note summaries for accessible patients" ON progress_note_monthly_summaries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE p.id = progress_note_monthly_summaries.patient_id
      AND (
        up.role = 'superadmin'
        OR (up.hospital_id = p.hospital_id AND up.role = 'head_nurse')
        OR EXISTS (
          SELECT 1 FROM nurse_patient_assignments npa
          WHERE npa.nurse_id = up.id
          AND npa.patient_id = p.id
          AND npa.is_active = true
        )
      )
    )
  );

CREATE TRIGGER update_progress_note_monthly_summaries_updated_at
  BEFORE UPDATE ON progress_note_monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
