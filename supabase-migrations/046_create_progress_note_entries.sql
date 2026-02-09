-- Progress Notes module: one entry per row (date, notes, signature) per patient
CREATE TABLE IF NOT EXISTS progress_note_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  signature TEXT,
  physician_name TEXT,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_progress_note_entries_patient_id ON progress_note_entries(patient_id);
CREATE INDEX idx_progress_note_entries_note_date ON progress_note_entries(note_date);

ALTER TABLE progress_note_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage progress notes for accessible patients" ON progress_note_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE p.id = progress_note_entries.patient_id
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

CREATE TRIGGER update_progress_note_entries_updated_at
  BEFORE UPDATE ON progress_note_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
