-- Fix for existing users who don't have profiles
-- Run this to create profiles for any auth users missing profiles

-- Create profiles for all auth users that don't have one yet
INSERT INTO public.user_profiles (id, email, full_name, role, hospital_id)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'User'),
  'nurse', -- Default role
  NULL -- Will be set when hospital is created/joined
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify all auth users have profiles
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  up.id as profile_id,
  up.full_name,
  up.role,
  CASE WHEN up.id IS NULL THEN 'MISSING PROFILE' ELSE 'OK' END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC;

