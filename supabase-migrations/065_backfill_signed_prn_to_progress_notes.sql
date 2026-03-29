-- Signed PRN → Progress Notes backfill.
--
-- If you see: column "source_mar_prn_record_id" does not exist — the block below adds it (same as
-- 064_progress_note_entries_source_mar_prn_record.sql). Safe if 064 already ran (IF NOT EXISTS).

ALTER TABLE progress_note_entries
  ADD COLUMN IF NOT EXISTS source_mar_prn_record_id UUID REFERENCES mar_prn_records(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_note_entries_source_mar_prn_unique
  ON progress_note_entries(source_mar_prn_record_id)
  WHERE source_mar_prn_record_id IS NOT NULL;

COMMENT ON COLUMN progress_note_entries.source_mar_prn_record_id IS 'When set, this entry is auto-synced from the given mar_prn_records row.';

-- Backfill: Progress Notes rows for signed PRNs that never got synced.
-- Safe to re-run: skips any PRN that already has progress_note_entries.source_mar_prn_record_id set.

INSERT INTO progress_note_entries (
  patient_id,
  note_date,
  notes,
  signature,
  physician_name,
  is_addendum,
  created_by,
  source_mar_prn_record_id
)
SELECT
  mf.patient_id,
  pr.date::date,
  format(
    E'%s\nMedication: %s\nDosage: %s\nReason/Indication: %s%s\nResult: %s\nInitials: %s\nDocumentation: Signed',
    CASE
      WHEN pr.hour IS NOT NULL THEN
        '(from MAR PRN, ' || trim(to_char(pr.hour::time, 'HH12:MI AM')) || ')'
      ELSE
        '(from MAR PRN)'
    END,
    COALESCE(NULLIF(trim(pr.medication), ''), '—'),
    COALESCE(NULLIF(trim(pr.dosage), ''), '—'),
    COALESCE(NULLIF(trim(pr.reason), ''), '—'),
    CASE
      WHEN pr.note IS NOT NULL AND trim(pr.note) <> '' THEN
        E'\nAdditional note: ' || trim(pr.note)
      ELSE
        ''
    END,
    COALESCE(NULLIF(trim(pr.result), ''), '—'),
    COALESCE(NULLIF(trim(pr.initials), ''), '—')
  ),
  NULL,
  mf.physician_name,
  false,
  COALESCE(pr.signed_by, mf.created_by),
  pr.id
FROM mar_prn_records pr
INNER JOIN mar_forms mf ON mf.id = pr.mar_form_id
WHERE pr.staff_signature IS NOT NULL
  AND trim(pr.staff_signature) <> ''
  AND COALESCE(pr.signed_by, mf.created_by) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM progress_note_entries e
    WHERE e.source_mar_prn_record_id = pr.id
  );
