-- Safe fix for user profile creation trigger (non-destructive)
-- This version only creates/updates, doesn't drop existing objects

-- Update the function if it exists, or create if it doesn't
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, hospital_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'nurse', -- Default role, can be updated later
    NULL -- Will be set when hospital is created or joined
  )
  ON CONFLICT (id) DO NOTHING; -- Prevent duplicate inserts
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if it doesn't exist, otherwise do nothing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW 
      EXECUTE FUNCTION create_user_profile();
  END IF;
END $$;

-- Ensure the INSERT policy exists (creates if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'user_profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile" ON user_profiles
      FOR INSERT
      TO authenticated, anon
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Verify trigger exists
SELECT 
  t.tgname as trigger_name,
  p.proname as function_name,
  CASE WHEN t.tgisinternal THEN 'Internal' ELSE 'User-defined' END as trigger_type
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE t.tgname = 'on_auth_user_created';

