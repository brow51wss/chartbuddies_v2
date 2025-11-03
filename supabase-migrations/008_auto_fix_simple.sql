-- Simple auto-fix - tries to fix everything automatically
-- Run this in Supabase SQL Editor

-- Step 1: Create hospital if none exists
DO $$
DECLARE
  hospital_count INTEGER;
  new_hospital_id UUID;
BEGIN
  SELECT COUNT(*) INTO hospital_count FROM hospitals;
  
  IF hospital_count = 0 THEN
    -- Create a hospital
    INSERT INTO hospitals (name, facility_type, invite_code)
    VALUES ('Grand River Hospital', 'hospital', 'GRH' || substr(md5(random()::text), 1, 5))
    RETURNING id INTO new_hospital_id;
    
    RAISE NOTICE 'Created new hospital with ID: %', new_hospital_id;
  ELSE
    -- Use existing hospital
    SELECT id INTO new_hospital_id FROM hospitals ORDER BY created_at DESC LIMIT 1;
    RAISE NOTICE 'Using existing hospital with ID: %', new_hospital_id;
  END IF;
  
  -- Step 2: Update all users with NULL hospital_id
  UPDATE user_profiles
  SET 
    hospital_id = new_hospital_id,
    role = 'superadmin'
  WHERE hospital_id IS NULL;
  
  RAISE NOTICE 'Updated user profiles';
END $$;

-- Step 3: Verify it worked
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.hospital_id,
  h.name as hospital_name
FROM user_profiles up
LEFT JOIN hospitals h ON up.hospital_id = h.id
ORDER BY up.created_at DESC;

