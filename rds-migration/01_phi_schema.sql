-- =============================================================================
-- Lasso EHR — RDS PHI Schema
-- Target: AWS RDS PostgreSQL 16
-- Tables: patients, mar_forms, mar_medications, mar_administrations,
--         mar_prn_records, mar_prn_medications, mar_vital_signs,
--         progress_note_entries
--
-- Cross-database references (hospital_id, created_by, signed_by, etc.) that
-- point to Supabase-hosted tables (hospitals, user_profiles) are stored as
-- plain UUID columns WITHOUT foreign key constraints. Access control is
-- enforced at the application layer (see lib/rds-auth.ts).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Utility: auto-update updated_at on every row change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 1. PATIENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Facility reference (lives in Supabase hospitals table — no FK)
  hospital_id        UUID        NOT NULL,

  -- Demographics (PHI)
  patient_name       VARCHAR(255) NOT NULL,
  record_number      VARCHAR(100) UNIQUE NOT NULL,
  date_of_birth      DATE        NOT NULL,
  sex                VARCHAR(10) NOT NULL CHECK (sex IN ('Male','Female','Other')),
  diagnosis          TEXT,
  diet               TEXT,
  allergies          TEXT        NOT NULL DEFAULT '',
  physician_name     VARCHAR(255) NOT NULL,
  physician_phone    VARCHAR(20),
  facility_name      VARCHAR(255),

  -- Contact / admissions (migration 067)
  street_address     TEXT,
  city               VARCHAR(255),
  state              VARCHAR(100),
  zip_code           VARCHAR(20),
  home_phone         VARCHAR(30),
  email              VARCHAR(255),
  admission_date     DATE,

  -- Photo (migration 069)
  patient_photo      TEXT,

  -- Soft delete (migration 051)
  deleted_at         TIMESTAMPTZ DEFAULT NULL,

  -- Audit (created_by references user_profiles on Supabase — no FK)
  created_by         UUID        NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_hospital_id    ON patients(hospital_id);
CREATE INDEX IF NOT EXISTS idx_patients_record_number  ON patients(record_number);
CREATE INDEX IF NOT EXISTS idx_patients_created_by     ON patients(created_by);
CREATE INDEX IF NOT EXISTS idx_patients_deleted_at     ON patients(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. MAR FORMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_forms (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links (patient stays in RDS; hospital in Supabase — no FK)
  patient_id                 UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  hospital_id                UUID        NOT NULL,

  month_year                 VARCHAR(20) NOT NULL,   -- e.g. "November 2025"
  status                     VARCHAR(50) NOT NULL DEFAULT 'draft',

  -- Snapshot of patient info at form creation (intentional denormalisation
  -- for clinical record integrity — do NOT sync back)
  patient_name               VARCHAR(255) NOT NULL,
  record_number              VARCHAR(100) NOT NULL,
  date_of_birth              DATE        NOT NULL,
  sex                        VARCHAR(10) NOT NULL,
  diagnosis                  TEXT,
  diet                       TEXT,
  allergies                  TEXT        NOT NULL DEFAULT '',
  physician_name             VARCHAR(255) NOT NULL,
  physician_phone            VARCHAR(20),
  facility_name              VARCHAR(255),

  -- Extras (migrations 011, 028, 068)
  vital_signs_instructions   TEXT,
  comments                   TEXT,
  mar_chart_row_order        JSONB       DEFAULT NULL,

  -- Audit (created_by references user_profiles on Supabase — no FK)
  created_by                 UUID        NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_forms_patient_id  ON mar_forms(patient_id);
CREATE INDEX IF NOT EXISTS idx_mar_forms_hospital_id ON mar_forms(hospital_id);
CREATE INDEX IF NOT EXISTS idx_mar_forms_month_year  ON mar_forms(month_year);
CREATE INDEX IF NOT EXISTS idx_mar_forms_status      ON mar_forms(status);

CREATE TRIGGER trg_mar_forms_updated_at
  BEFORE UPDATE ON mar_forms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. MAR MEDICATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_medications (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_form_id       UUID        NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,

  medication_name   VARCHAR(255) NOT NULL,
  dosage            TEXT        NOT NULL,
  start_date        DATE        NOT NULL,
  stop_date         DATE,
  hour              TIME,                   -- NULL for vitals rows (migration 039)
  notes             TEXT,

  -- Additional fields (migrations 032–038)
  parameter         TEXT,
  route             VARCHAR(255),
  frequency         INTEGER     DEFAULT 1,
  frequency_display TEXT,
  display_order     INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_medications_mar_form_id    ON mar_medications(mar_form_id);
CREATE INDEX IF NOT EXISTS idx_mar_medications_display_order  ON mar_medications(mar_form_id, display_order);

CREATE TRIGGER trg_mar_medications_updated_at
  BEFORE UPDATE ON mar_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. MAR ADMINISTRATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_administrations (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_medication_id    UUID        NOT NULL REFERENCES mar_medications(id) ON DELETE CASCADE,

  day_number           INTEGER     NOT NULL CHECK (day_number >= 1 AND day_number <= 31),
  status               VARCHAR(50) NOT NULL DEFAULT 'Not Given',
  initials             TEXT,                -- may store data-URL or s3: key (migration 045)
  notes                TEXT,
  administered_at      TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(mar_medication_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_mar_admin_medication_id ON mar_administrations(mar_medication_id);
CREATE INDEX IF NOT EXISTS idx_mar_admin_day_number    ON mar_administrations(day_number);

CREATE TRIGGER trg_mar_administrations_updated_at
  BEFORE UPDATE ON mar_administrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. MAR PRN MEDICATIONS  (library of reusable PRN choices per MAR form)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_prn_medications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_form_id   UUID        NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,

  start_date    DATE        NOT NULL DEFAULT CURRENT_DATE,  -- renamed from date_added (migration 066)
  medication    VARCHAR(255) NOT NULL,
  dosage        TEXT,
  reason        TEXT        NOT NULL,

  -- created_by references user_profiles on Supabase — no FK
  created_by    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_prn_medications_mar_form_id ON mar_prn_medications(mar_form_id);
CREATE INDEX IF NOT EXISTS idx_mar_prn_medications_medication  ON mar_prn_medications(medication);

CREATE TRIGGER trg_mar_prn_medications_updated_at
  BEFORE UPDATE ON mar_prn_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. MAR PRN RECORDS  (actual PRN administration entries)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_prn_records (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_form_id      UUID        NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,

  date             DATE        NOT NULL,
  hour             TIME,                       -- nullable (migration 030)
  initials         VARCHAR(10),               -- nullable (migration 030)
  medication       VARCHAR(255) NOT NULL,
  dosage           TEXT,                      -- migration 040
  reason           TEXT        NOT NULL,
  result           TEXT,
  staff_signature  TEXT,                      -- nullable TEXT (migrations 030, 050)
  note             TEXT,                      -- migration 031
  entry_number     INTEGER,

  -- Who signed (references user_profiles on Supabase — no FK) (migration 062)
  signed_by        UUID,

  -- Prescription start date (migration 066)
  start_date       DATE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mar_prn_records_mar_form_id ON mar_prn_records(mar_form_id);
CREATE INDEX IF NOT EXISTS idx_mar_prn_records_date        ON mar_prn_records(date);
CREATE INDEX IF NOT EXISTS idx_mar_prn_records_signed_by   ON mar_prn_records(signed_by);

CREATE TRIGGER trg_mar_prn_records_updated_at
  BEFORE UPDATE ON mar_prn_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 7. MAR VITAL SIGNS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mar_vital_signs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mar_form_id    UUID        NOT NULL REFERENCES mar_forms(id) ON DELETE CASCADE,

  day_number     INTEGER     NOT NULL CHECK (day_number >= 1 AND day_number <= 31),
  temperature    DECIMAL(5,2),
  pulse          INTEGER,
  respiration    INTEGER,
  weight         DECIMAL(6,2),

  -- Blood pressure + bowel movement (migration 011)
  systolic_bp    INTEGER,
  diastolic_bp   INTEGER,
  bowel_movement VARCHAR(50),

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(mar_form_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_vital_signs_mar_form_id  ON mar_vital_signs(mar_form_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_day_number   ON mar_vital_signs(day_number);

CREATE TRIGGER trg_mar_vital_signs_updated_at
  BEFORE UPDATE ON mar_vital_signs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. PROGRESS NOTE ENTRIES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS progress_note_entries (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id                UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  note_date                 DATE        NOT NULL,
  notes                     TEXT        NOT NULL DEFAULT '',
  signature                 TEXT,
  physician_name            TEXT,

  -- Addendum flag (migration 047)
  is_addendum               BOOLEAN     NOT NULL DEFAULT false,

  -- Link back to the PRN record that generated this entry, if any (migration 064)
  source_mar_prn_record_id  UUID        REFERENCES mar_prn_records(id) ON DELETE SET NULL,

  -- created_by references user_profiles on Supabase — no FK
  created_by                UUID        NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_note_entries_patient_id
  ON progress_note_entries(patient_id);
CREATE INDEX IF NOT EXISTS idx_progress_note_entries_note_date
  ON progress_note_entries(note_date);
CREATE INDEX IF NOT EXISTS idx_progress_note_entries_patient_addendum
  ON progress_note_entries(patient_id, is_addendum);
CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_note_entries_source_mar_prn_unique
  ON progress_note_entries(source_mar_prn_record_id)
  WHERE source_mar_prn_record_id IS NOT NULL;

CREATE TRIGGER trg_progress_note_entries_updated_at
  BEFORE UPDATE ON progress_note_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
