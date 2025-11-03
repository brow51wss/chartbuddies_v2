-- Manual fix for your user profile
-- Run this step by step in Supabase SQL Editor

-- Step 1: Check if you have any hospitals
-- Look at the results - if you see hospitals, note the 'id' column
SELECT id, name, facility_type, invite_code, created_at 
FROM hospitals 
ORDER BY created_at DESC;

-- Step 2: Get your user ID
-- Find your user (should show your email 'aneeshwhitespace@gmail.com')
-- Note the 'id' column value
SELECT id, email, full_name, role, hospital_id
FROM user_profiles
WHERE email = 'aneeshwhitespace@gmail.com';

-- Step 3: Update your profile manually
-- Replace 'YOUR_USER_ID_HERE' with the ID from Step 2
-- Replace 'HOSPITAL_ID_HERE' with the ID from Step 1 (if hospital exists)
-- If no hospital exists, we'll create one first

-- OPTION A: If hospital exists, use this:
/*
UPDATE user_profiles
SET 
  hospital_id = 'HOSPITAL_ID_HERE',
  role = 'superadmin'
WHERE id = 'YOUR_USER_ID_HERE';
*/

-- OPTION B: If NO hospital exists, create one first, then update:
-- First create hospital:
/*
INSERT INTO hospitals (name, facility_type, invite_code)
VALUES ('Grand River Hospital', 'hospital', 'ABC12345')
RETURNING id;
*/
-- Then use the returned ID in the UPDATE above

