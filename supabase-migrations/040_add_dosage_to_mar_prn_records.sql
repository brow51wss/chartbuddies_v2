-- Add dosage field to PRN records (displayed between Medication and Reason/Indication)
ALTER TABLE mar_prn_records 
  ADD COLUMN IF NOT EXISTS dosage TEXT;
