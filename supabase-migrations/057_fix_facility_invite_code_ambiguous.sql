-- Fix "column reference \"code\" is ambiguous" in generate_facility_invite_code()
-- The variable "code" shadowed the column facility_invites.code in the subquery.
-- Use v_code for the variable so the subquery unambiguously refers to the variable.

CREATE OR REPLACE FUNCTION generate_facility_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code TEXT := '';
  i INT;
  exists_check BOOLEAN;
BEGIN
  FOR i IN 1..100 LOOP
    v_code := '';
    FOR j IN 1..8 LOOP
      v_code := v_code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    SELECT NOT EXISTS (SELECT 1 FROM facility_invites WHERE facility_invites.code = v_code)
      AND NOT EXISTS (SELECT 1 FROM hospitals WHERE hospitals.invite_code = v_code)
    INTO exists_check;
    IF exists_check THEN
      RETURN v_code;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Could not generate unique invite code';
END;
$$;
