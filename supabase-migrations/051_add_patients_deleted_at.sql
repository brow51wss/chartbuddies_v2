-- Soft delete for patients: allow viewing and restoring deleted patients (data preserved)
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_patients_deleted_at ON patients(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN patients.deleted_at IS 'When set, patient is hidden from main list; can be restored from Deleted Patients page.';
