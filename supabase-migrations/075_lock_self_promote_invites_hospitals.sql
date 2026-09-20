-- Diagnosed 2026-09-10: public signup + leftover policies let a stranger
-- become facility PCG (role=superadmin + hospital_id), read hospitals /
-- user_profiles / facility_invites, and open /facility-users.
-- Signup is already disabled in the Auth dashboard. Apply this in the
-- SQL editor immediately. Ban the pentest Auth user separately (do not DELETE).

-- ---------------------------------------------------------------------------
-- 1. facility_invites: no visitor read; drop the USING (true) policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can select facility_invite by code for signup" ON public.facility_invites;

REVOKE SELECT ON TABLE public.facility_invites FROM anon;
REVOKE INSERT ON TABLE public.facility_invites FROM anon;
REVOKE UPDATE ON TABLE public.facility_invites FROM anon;
REVOKE DELETE ON TABLE public.facility_invites FROM anon;

-- ---------------------------------------------------------------------------
-- 2. hospitals: drop leftover signup-era policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can see hospitals they created" ON public.hospitals;
DROP POLICY IF EXISTS "Allow authenticated hospital creation" ON public.hospitals;
DROP POLICY IF EXISTS "Users can create hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Authenticated users can create hospitals" ON public.hospitals;
DROP POLICY IF EXISTS "Superadmins can create hospitals" ON public.hospitals;

REVOKE INSERT ON TABLE public.hospitals FROM anon;
REVOKE INSERT ON TABLE public.hospitals FROM authenticated;
REVOKE UPDATE ON TABLE public.hospitals FROM anon;
REVOKE DELETE ON TABLE public.hospitals FROM anon;

-- ---------------------------------------------------------------------------
-- 3. Block client-side role / hospital_id changes (service_role still allowed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(auth.jwt() ->> 'role', '');
  IF jwt_role IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role := 'nurse';
      NEW.hospital_id := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.role := OLD.role;
      NEW.hospital_id := OLD.hospital_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ---------------------------------------------------------------------------
-- 4. Revoke leftover signup RPCs (PCG add-caregiver uses service role, not these)
-- create_user_profile_safe stays for /auth/login profile backfill (always nurse).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'create_hospital_safe',
        'update_user_profile_on_signup',
        'get_facility_invite_for_signup',
        'apply_facility_invite',
        'join_facility_via_invite'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;
END $$;
