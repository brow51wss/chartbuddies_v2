-- Add start_date column to mar_prn_medications table (library)
-- This represents when the PRN medication order was started
-- Rename date_added to start_date for clarity

ALTER TABLE mar_prn_medications
RENAME COLUMN date_added TO start_date;

-- Add start_date column to mar_prn_records table (actual administration records)
-- This will reference the start date from the library entry
ALTER TABLE mar_prn_records
ADD COLUMN start_date DATE;

-- Backfill existing records with the 'date' value as a reasonable default
UPDATE mar_prn_records
SET start_date = date
WHERE start_date IS NULL;
