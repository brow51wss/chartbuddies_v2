-- Fix Missing Hospital ID for User Profiles
-- Run this in Supabase SQL Editor to fix users with missing hospital_id
-- This will link users to an existing hospital or create one if none exists

-- Step 1: Check current state
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.hospital_id,
  h.name as hospital_name
FROM user_profiles up
LEFT JOIN hospitals h ON up.hospital_id = h.id
WHERE up.hospital_id IS NULL
ORDER BY up.created_at DESC;

-- Step 2: Fix users with missing hospital_id
DO $$
DECLARE
  hospital_count INTEGER;
  new_hospital_id UUID;
  hospital_name TEXT;
  user_count INTEGER;
BEGIN
  -- Count hospitals
  SELECT COUNT(*) INTO hospital_count FROM hospitals;
  
  -- Count users without hospital_id
  SELECT COUNT(*) INTO user_count FROM user_profiles WHERE hospital_id IS NULL;
  
  RAISE NOTICE 'Found % users without hospital_id', user_count;
  RAISE NOTICE 'Found % hospitals', hospital_count;
  
  -- If no hospitals exist, create one
  IF hospital_count = 0 THEN
    INSERT INTO hospitals (name, facility_type, invite_code)
    VALUES (
      'Default Hospital', 
      'hospital', 
      'DEFAULT' || substr(md5(random()::text), 1, 5)
    )
    RETURNING id, name INTO new_hospital_id, hospital_name;
    
    RAISE NOTICE 'Created new hospital: % (ID: %)', hospital_name, new_hospital_id;
  ELSE
    -- Use the most recent hospital
    SELECT id, name INTO new_hospital_id, hospital_name
    FROM hospitals 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    RAISE NOTICE 'Using existing hospital: % (ID: %)', hospital_name, new_hospital_id;
  END IF;
  
  -- Update all users with NULL hospital_id
  -- If user is a nurse, keep them as nurse. Otherwise make them superadmin
  UPDATE user_profiles
  SET 
    hospital_id = new_hospital_id,
    role = CASE 
      WHEN role = 'nurse' THEN 'nurse'  -- Keep nurse role
      ELSE 'superadmin'  -- Make others superadmin
    END
  WHERE hospital_id IS NULL;
  
  RAISE NOTICE 'Updated % user profiles', user_count;
END $$;

-- Step 3: Verify the fix worked
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

