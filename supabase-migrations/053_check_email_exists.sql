-- RPC to check if an email is already registered (for signup step 1 validation)
-- SECURITY DEFINER allows querying auth.users; returns boolean only (no enumeration risk beyond what signUp would expose)

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = lower(trim(p_email)));
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_email_exists(text) TO authenticated;
