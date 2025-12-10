-- Add frequency column to mar_medications table
ALTER TABLE mar_medications
ADD COLUMN frequency INTEGER DEFAULT 1;

