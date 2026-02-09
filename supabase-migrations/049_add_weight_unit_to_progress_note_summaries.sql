-- Store weight unit (kg or lbs) per summary; used for consistency across this patient's progress notes
ALTER TABLE progress_note_monthly_summaries
  ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lbs';
