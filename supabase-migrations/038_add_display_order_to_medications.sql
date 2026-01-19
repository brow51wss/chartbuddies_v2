-- Add display_order column to mar_medications for custom row ordering
-- This allows users to insert medications/vitals at specific positions

ALTER TABLE mar_medications 
ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Initialize display_order based on current created_at order
-- This ensures existing rows maintain their current order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY mar_form_id ORDER BY created_at) * 10 as new_order
  FROM mar_medications
)
UPDATE mar_medications m
SET display_order = o.new_order
FROM ordered o
WHERE m.id = o.id;

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_mar_medications_display_order ON mar_medications(mar_form_id, display_order);

-- Add comment for documentation
COMMENT ON COLUMN mar_medications.display_order IS 'Custom display order for row positioning. Multiplied by 10 to allow insertions between rows.';
