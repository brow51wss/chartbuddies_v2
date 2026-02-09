-- Add flag to distinguish main progress notes from addendum / additional notes
ALTER TABLE progress_note_entries
  ADD COLUMN IF NOT EXISTS is_addendum BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_progress_note_entries_patient_addendum
  ON progress_note_entries(patient_id, is_addendum);
