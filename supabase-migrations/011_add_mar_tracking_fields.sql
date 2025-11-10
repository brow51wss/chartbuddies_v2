-- Migration: Add Blood Pressure, Bowel Movement tracking, and Custom Instructions to MAR
-- Date: 2025

-- ============================================
-- 1. Add Blood Pressure fields to mar_vital_signs
-- ============================================
ALTER TABLE mar_vital_signs
ADD COLUMN IF NOT EXISTS systolic_bp INTEGER,
ADD COLUMN IF NOT EXISTS diastolic_bp INTEGER;

-- ============================================
-- 2. Add Bowel Movement tracking to mar_vital_signs
-- ============================================
ALTER TABLE mar_vital_signs
ADD COLUMN IF NOT EXISTS bowel_movement VARCHAR(50); -- e.g., "Yes", "No", "Loose", "Formed", etc.

-- ============================================
-- 3. Add Custom Instructions field to mar_forms for vital signs notes
-- ============================================
ALTER TABLE mar_forms
ADD COLUMN IF NOT EXISTS vital_signs_instructions TEXT; -- e.g., "BP (sprinkle salt on food if BP low <80/60)"

-- Add comments for documentation
COMMENT ON COLUMN mar_vital_signs.systolic_bp IS 'Systolic blood pressure reading';
COMMENT ON COLUMN mar_vital_signs.diastolic_bp IS 'Diastolic blood pressure reading';
COMMENT ON COLUMN mar_vital_signs.bowel_movement IS 'Bowel movement tracking (Yes/No/Loose/Formed/etc.)';
COMMENT ON COLUMN mar_forms.vital_signs_instructions IS 'Custom instructions for vital signs tracking (e.g., BP thresholds, special notes)';

