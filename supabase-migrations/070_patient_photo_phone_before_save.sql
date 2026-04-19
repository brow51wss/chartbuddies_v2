-- Allow phone capture before a patient row exists (e.g. admissions): nullable patient_id on tokens.
-- In Supabase SQL Editor, select the full script (or each CREATE FUNCTION … $tag$; block) before Run so statements are not split on semicolons inside the body.
-- and a short-lived per-user pickup row when capture completes without a patient.

ALTER TABLE public.patient_photo_capture_tokens
  ALTER COLUMN patient_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.patient_photo_mobile_pickups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  photo_data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_photo_mobile_pickups_user_created
  ON public.patient_photo_mobile_pickups(user_id, created_at DESC);

ALTER TABLE public.patient_photo_mobile_pickups ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.patient_photo_mobile_pickups IS 'Latest phone-captured photo for a user when no patient_id was bound yet; claimed via pop_patient_photo_mobile_pickup.';

-- Replace context helper: valid when token exists; patientName from row or generic for new admission.
-- LANGUAGE sql + single SELECT (no semicolons inside body) for Supabase SQL Editor.
CREATE OR REPLACE FUNCTION public.get_patient_photo_capture_context(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $mig070_ctx$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN tr.patient_id IS NULL THEN jsonb_build_object(
          'valid', true,
          'patientId', NULL,
          'patientName', 'New patient'
        )
        WHEN pn.patient_name IS NOT NULL THEN jsonb_build_object(
          'valid', true,
          'patientId', tr.patient_id,
          'patientName', pn.patient_name
        )
        ELSE NULL::jsonb
      END
      FROM public.patient_photo_capture_tokens tr
      LEFT JOIN public.patients pn ON pn.id = tr.patient_id
      WHERE tr.token = btrim($1)
        AND tr.expires_at > now()
        AND tr.user_id IS NOT NULL
      LIMIT 1
    ),
    jsonb_build_object('valid', false)
  )
$mig070_ctx$;

-- Complete: either update patient (when patient_id set) or enqueue mobile pickup (when patient_id null).
-- LANGUAGE sql + one statement for Supabase SQL Editor.
CREATE OR REPLACE FUNCTION public.complete_patient_photo_capture(p_token TEXT, p_photo_data TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $mig070_complete$
  WITH bounds AS (
    SELECT
      btrim($1) AS tok,
      CASE
        WHEN $1 IS NULL OR btrim($1) = '' THEN false
        WHEN $2 IS NULL OR length(btrim($2)) < 22 THEN false
        WHEN btrim($2) !~* '^data:image/(jpeg|jpg|pjpeg|png|webp|gif);base64,' THEN false
        WHEN length($2) > 12000000 THEN false
        ELSE true
      END AS inputs_ok
  ),
  tok AS (
    SELECT t.patient_id, t.user_id
    FROM public.patient_photo_capture_tokens t
    CROSS JOIN bounds b
    WHERE b.inputs_ok
      AND t.token = b.tok
      AND t.expires_at > now()
      AND t.user_id IS NOT NULL
    LIMIT 1
  ),
  pickup_ins AS (
    INSERT INTO public.patient_photo_mobile_pickups (user_id, photo_data)
    SELECT t.user_id, $2
    FROM tok t
    WHERE t.patient_id IS NULL
    RETURNING id
  ),
  del_pickup AS (
    DELETE FROM public.patient_photo_capture_tokens t
    USING bounds b
    WHERE t.token = b.tok
      AND EXISTS (SELECT 1 FROM pickup_ins)
    RETURNING t.id
  ),
  scope AS (
    SELECT s.patient_id AS pid, s.user_id AS uid, u.role::text AS role, u.hospital_id AS user_hospital, p.hospital_id AS patient_hospital
    FROM tok s
    INNER JOIN public.user_profiles u ON u.id = s.user_id
    INNER JOIN public.patients p ON p.id = s.patient_id
    WHERE s.patient_id IS NOT NULL
  ),
  scope_ok AS (
    SELECT *
    FROM scope x
    WHERE x.role IS NOT NULL
      AND x.patient_hospital IS NOT NULL
      AND (x.role = 'superadmin' OR (x.user_hospital IS NOT NULL AND x.user_hospital IS NOT DISTINCT FROM x.patient_hospital))
  ),
  upd AS (
    UPDATE public.patients p
    SET patient_photo = $2, updated_at = now()
    FROM scope_ok s
    WHERE p.id = s.pid
    RETURNING p.id
  ),
  del_pat AS (
    DELETE FROM public.patient_photo_capture_tokens t
    USING bounds b
    WHERE t.token = b.tok
      AND EXISTS (SELECT 1 FROM upd)
    RETURNING t.id
  )
  SELECT COALESCE(
    (SELECT true FROM del_pickup LIMIT 1),
    (SELECT EXISTS (SELECT 1 FROM upd)),
    false
  )
$mig070_complete$;

-- Authenticated user claims the most recent pending phone photo (one row), or returns NULL.
-- LANGUAGE sql + single DELETE … RETURNING (no semicolons inside body) for Supabase SQL Editor.
CREATE OR REPLACE FUNCTION public.pop_patient_photo_mobile_pickup()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $mig070_pop$
  DELETE FROM public.patient_photo_mobile_pickups p
  WHERE p.id = (
    SELECT p2.id
    FROM public.patient_photo_mobile_pickups p2
    WHERE p2.user_id = auth.uid()
    ORDER BY p2.created_at DESC
    LIMIT 1
  )
  AND p.user_id = auth.uid()
  RETURNING p.photo_data
$mig070_pop$;

GRANT EXECUTE ON FUNCTION public.pop_patient_photo_mobile_pickup() TO authenticated;

COMMENT ON FUNCTION public.pop_patient_photo_mobile_pickup() IS 'Returns and deletes the latest pending phone-captured photo for the current user (admissions flow).';
