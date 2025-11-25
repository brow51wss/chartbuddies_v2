-- Add separate name fields to user_profiles table
-- This allows better data organization and more precise name handling

-- ============================================
-- 1. ADD NEW COLUMNS
-- ============================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS middle_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);

-- ============================================
-- 2. MIGRATE EXISTING DATA
-- ============================================
-- Split existing full_name into first_name and last_name
-- This handles common patterns: "First Last", "First Middle Last", etc.
UPDATE user_profiles
SET 
  first_name = CASE 
    WHEN full_name ~ '^[^ ]+ [^ ]+ [^ ]+' THEN 
      -- Three or more words: take first word as first_name
      SPLIT_PART(full_name, ' ', 1)
    WHEN full_name ~ '^[^ ]+ [^ ]+' THEN 
      -- Two words: first is first_name
      SPLIT_PART(full_name, ' ', 1)
    ELSE 
      -- Single word: use as first_name
      full_name
  END,
  middle_name = CASE 
    WHEN full_name ~ '^[^ ]+ [^ ]+ [^ ]+' THEN 
      -- Three or more words: middle words as middle_name
      array_to_string(
        (SELECT array_agg(part) 
         FROM unnest(string_to_array(full_name, ' ')) WITH ORDINALITY AS t(part, idx)
         WHERE idx > 1 AND idx < array_length(string_to_array(full_name, ' '), 1)
        ), 
        ' '
      )
    ELSE 
      NULL
  END,
  last_name = CASE 
    WHEN full_name ~ '^[^ ]+ [^ ]+' THEN 
      -- Two or more words: last word is last_name
      (string_to_array(full_name, ' '))[array_length(string_to_array(full_name, ' '), 1)]
    ELSE 
      NULL
  END
WHERE first_name IS NULL OR last_name IS NULL;

-- ============================================
-- 3. CREATE FUNCTION TO UPDATE full_name FROM PARTS
-- ============================================
-- This function automatically updates full_name when first/middle/last names change
CREATE OR REPLACE FUNCTION update_full_name_from_parts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name = TRIM(
    COALESCE(NEW.first_name, '') || ' ' ||
    COALESCE(NEW.middle_name, '') || ' ' ||
    COALESCE(NEW.last_name, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. CREATE TRIGGER
-- ============================================
DROP TRIGGER IF EXISTS trigger_update_full_name ON user_profiles;
CREATE TRIGGER trigger_update_full_name
  BEFORE INSERT OR UPDATE OF first_name, middle_name, last_name ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_full_name_from_parts();

-- ============================================
-- 5. VERIFY
-- ============================================
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
  AND column_name IN ('first_name', 'middle_name', 'last_name', 'full_name')
ORDER BY column_name;

