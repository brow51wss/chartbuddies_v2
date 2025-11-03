-- Fix for existing user and UPDATE policy
-- Run this in Supabase SQL Editor

-- Step 1: Fix the UPDATE policy to allow users to update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Step 2: Check if hospitals exist and link to your user
-- This will show hospitals and try to link the first one to your user
DO $$
DECLARE
  user_uuid UUID;
  hospital_uuid UUID;
  hospital_name TEXT;
BEGIN
  -- Find the user profile (assuming they're the one with NULL hospital_id)
  SELECT id INTO user_uuid 
  FROM user_profiles 
  WHERE hospital_id IS NULL 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- Find the most recent hospital (likely created by this user)
  SELECT id, name INTO hospital_uuid, hospital_name
  FROM hospitals 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF user_uuid IS NOT NULL AND hospital_uuid IS NOT NULL THEN
    -- Update the user profile to link to hospital and make them superadmin
    UPDATE user_profiles
    SET 
      hospital_id = hospital_uuid,
      role = 'superadmin'
    WHERE id = user_uuid;
    
    RAISE NOTICE 'Updated user % to be superadmin of hospital: %', user_uuid, hospital_name;
  ELSE
    RAISE NOTICE 'Could not find user or hospital to link';
  END IF;
END $$;

-- Step 3: Verify the update worked
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.role,
  up.hospital_id,
  h.name as hospital_name
FROM user_profiles up
LEFT JOIN hospitals h ON up.hospital_id = h.id
WHERE up.hospital_id IS NOT NULL
ORDER BY up.created_at DESC;

