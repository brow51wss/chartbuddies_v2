-- Fix RLS Policy for Patients Table - Allow Nurses to Insert Patients
-- Run this in Supabase SQL Editor

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Nurses can insert patients" ON patients;
DROP POLICY IF EXISTS "Head nurses can manage patients" ON patients;

-- Recreate the policy for nurses to insert patients
-- This policy allows nurses to insert patients into their own hospital
CREATE POLICY "Nurses can insert patients" ON patients
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role = 'nurse'
      AND user_profiles.hospital_id IS NOT NULL
    )
  );

-- Recreate the policy for head nurses and superadmins to manage patients
CREATE POLICY "Head nurses can manage patients" ON patients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role IN ('superadmin', 'head_nurse')
      AND user_profiles.hospital_id IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.hospital_id = patients.hospital_id
      AND user_profiles.role IN ('superadmin', 'head_nurse')
      AND user_profiles.hospital_id IS NOT NULL
    )
  );

-- Verify the policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY policyname;

