-- Link progress note rows to MAR PRN records for stable upserts when PRN data changes.

ALTER TABLE progress_note_entries
  ADD COLUMN IF NOT EXISTS source_mar_prn_record_id UUID REFERENCES mar_prn_records(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_note_entries_source_mar_prn_unique
  ON progress_note_entries(source_mar_prn_record_id)
  WHERE source_mar_prn_record_id IS NOT NULL;

COMMENT ON COLUMN progress_note_entries.source_mar_prn_record_id IS 'When set, this entry is auto-synced from the given mar_prn_records row.';
