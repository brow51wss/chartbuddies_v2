-- =============================================================================
-- Lasso EHR — RDS Migration 02
-- Adds: nurse_patient_assignments, progress_note_monthly_summaries
--
-- Cross-database references (nurse_id, assigned_by, created_by → Supabase
-- user_profiles; hospital_id → Supabase hospitals) are stored as plain UUID
-- columns WITHOUT foreign key constraints. Access control is enforced at the
-- application layer.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. NURSE PATIENT ASSIGNMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nurse_patient_assignments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id     UUID        NOT NULL,
  patient_id   UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  assigned_by  UUID        NOT NULL,
  assigned_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active    BOOLEAN     DEFAULT true,
  UNIQUE(nurse_id, patient_id)
);

CREATE INDEX IF NOT EXISTS idx_npa_nurse_id    ON nurse_patient_assignments(nurse_id);
CREATE INDEX IF NOT EXISTS idx_npa_patient_id  ON nurse_patient_assignments(patient_id);

-- ---------------------------------------------------------------------------
-- 2. PROGRESS NOTE MONTHLY SUMMARIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress_note_monthly_summaries (
  id                          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                  UUID    NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  month_year                  TEXT    NOT NULL,

  -- Vitals
  bp                          TEXT,
  pulse                       TEXT,
  resp                        TEXT,
  temp                        TEXT,
  wt                          TEXT,
  wt_change_yn                TEXT,
  weight_unit                 TEXT    DEFAULT 'lbs',
  response_to_diet            TEXT,

  -- Medication
  medication_available_yn     TEXT,
  medication_secured_yn       TEXT,
  taking_medications_yn       TEXT,
  physician_notified_yn       TEXT,
  physician_notified_date     DATE,
  medication_changes_yn       TEXT,
  response_to_medication      TEXT,

  -- Treatments
  treatments_yn               TEXT,
  treatments_type             TEXT,
  response_to_treatment       TEXT,
  therapy_yn                  TEXT,
  therapy_pt                  TEXT,
  therapy_ot                  TEXT,
  therapy_st                  TEXT,

  -- ADL
  adl_level                   TEXT,
  ambulation                  TEXT,
  continent_urine_yn          TEXT,
  continent_stool_yn          TEXT,
  incontinent_urine_yn        TEXT,
  incontinent_stool_yn        TEXT,
  timed_toileting_yn          TEXT,
  diapers_yn                  TEXT,
  bm_type                     TEXT,

  -- Skin
  skin_intact_yn              TEXT,
  wound_type                  TEXT,
  wound_location              TEXT,
  wound_treatment             TEXT,
  wound_response              TEXT,

  -- Pain
  pain_yn                     TEXT,
  pain_location               TEXT,
  pain_intensity              TEXT,
  pain_cause                  TEXT,
  pain_treatment              TEXT,
  pain_response               TEXT,

  -- Mental
  mental_descriptors          TEXT,
  impaired_communication_other TEXT,

  -- Changes
  describe_changes            TEXT,
  date_md_notified            DATE,
  actions                     TEXT,
  changes_in_condition_yn     TEXT,
  illness_yn                  TEXT,
  injury_yn                   TEXT,
  date_physician_notified     DATE,
  describe_type_actions_taken TEXT,

  -- Plan / Signature
  plan_of_care                TEXT,
  signature                   TEXT,
  signature_title             TEXT,
  signature_date              DATE,

  created_by                  UUID    NOT NULL,
  created_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(patient_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_pnms_patient      ON progress_note_monthly_summaries(patient_id);
CREATE INDEX IF NOT EXISTS idx_pnms_patient_month ON progress_note_monthly_summaries(patient_id, month_year);

CREATE OR REPLACE TRIGGER update_progress_note_monthly_summaries_updated_at
  BEFORE UPDATE ON progress_note_monthly_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
