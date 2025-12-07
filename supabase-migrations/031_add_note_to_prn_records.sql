-- Add note field to PRN records for additional notes on Reason/Indication
ALTER TABLE mar_prn_records 
  ADD COLUMN IF NOT EXISTS note TEXT;

