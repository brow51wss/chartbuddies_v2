-- =============================================================================
-- Lasso EHR — RDS Migration 03
-- Adds: patient_vitals, patient_appointments
-- Resident-level logs for the dashboard Vitals and Appointments tabs.
-- MAR chart vitals (mar_vital_signs) are unchanged.
-- =============================================================================

CREATE TABLE IF NOT EXISTS patient_vitals (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  recorded_at    TIMESTAMPTZ NOT NULL,
  bp             TEXT,
  heart_rate     TEXT,
  temperature    TEXT,
  weight         TEXT,
  initials       TEXT,
  created_by     UUID,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_vitals_patient_id
  ON patient_vitals(patient_id, recorded_at DESC);

CREATE TRIGGER trg_patient_vitals_updated_at
  BEFORE UPDATE ON patient_vitals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS patient_appointments (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id         UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_date   DATE        NOT NULL,
  appointment_time   TIME,
  title              TEXT        NOT NULL,
  location           TEXT,
  notes              TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_appointments_patient_id
  ON patient_appointments(patient_id, appointment_date ASC, appointment_time ASC NULLS LAST);

CREATE TRIGGER trg_patient_appointments_updated_at
  BEFORE UPDATE ON patient_appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
