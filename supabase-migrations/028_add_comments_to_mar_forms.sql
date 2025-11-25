-- Add comments field to mar_forms table
ALTER TABLE mar_forms
ADD COLUMN IF NOT EXISTS comments TEXT;

-- Add comment to document the field
COMMENT ON COLUMN mar_forms.comments IS 'General comments and notes for the MAR form';

