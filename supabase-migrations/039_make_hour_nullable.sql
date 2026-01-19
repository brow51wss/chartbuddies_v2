-- Make hour column nullable for vitals entries (vitals don't have administration time)
ALTER TABLE mar_medications 
ALTER COLUMN hour DROP NOT NULL;

COMMENT ON COLUMN mar_medications.hour IS 'Administration time for medications. NULL for vitals entries which do not have a specific administration time.';
