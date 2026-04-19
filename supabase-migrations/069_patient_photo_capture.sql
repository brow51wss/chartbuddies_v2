-- Patient profile photo (data URL or future URL) + one-time email-link capture tokens (phone camera).
-- In Supabase SQL Editor: select the entire CREATE FUNCTION … $tag$; block before Run (or use CLI migrations), or the editor may split on `;` and error on v_patient_id.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_photo TEXT;

COMMENT ON COLUMN public.patients.patient_photo IS 'Optional patient portrait; often a JPEG/PNG data URL from upload or phone capture flow.';

CREATE TABLE IF NOT EXISTS public.patient_photo_capture_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_photo_capture_tokens_token
  ON public.patient_photo_capture_tokens(token);
CREATE INDEX IF NOT EXISTS idx_patient_photo_capture_tokens_expires_at
  ON public.patient_photo_capture_tokens(expires_at);

ALTER TABLE public.patient_photo_capture_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own patient photo capture token"
  ON public.patient_photo_capture_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own patient photo capture tokens"
  ON public.patient_photo_capture_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT INSERT, DELETE ON public.patient_photo_capture_tokens TO authenticated;
GRANT SELECT, DELETE ON public.patient_photo_capture_tokens TO service_role;

-- Validate token for anonymous capture page (no auth cookie required).
-- LANGUAGE sql + single SELECT (no semicolons inside body) so Supabase SQL Editor does not split the statement.
CREATE OR REPLACE FUNCTION public.get_patient_photo_capture_context(p_token TEXT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $mig069_ctx$
  SELECT COALESCE(
    (
      SELECT jsonb_build_object(
        'valid', true,
        'patientId', tr.patient_id,
        'patientName', pn.patient_name
      )
      FROM public.patient_photo_capture_tokens tr
      INNER JOIN public.patients pn ON pn.id = tr.patient_id
      WHERE tr.token = btrim($1)
        AND tr.expires_at > now()
        AND tr.patient_id IS NOT NULL
        AND tr.user_id IS NOT NULL
      LIMIT 1
    ),
    jsonb_build_object('valid', false)
  )
$mig069_ctx$;

-- Consume token and save photo; enforces facility scope for non-superadmin requester.
-- LANGUAGE sql + one statement (no semicolons inside body) for Supabase SQL Editor.
CREATE OR REPLACE FUNCTION public.complete_patient_photo_capture(p_token TEXT, p_photo_data TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $mig069_complete$
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
      AND t.patient_id IS NOT NULL
      AND t.user_id IS NOT NULL
    LIMIT 1
  ),
  scope AS (
    SELECT s.patient_id AS pid, s.user_id AS uid, u.role::text AS role, u.hospital_id AS user_hospital, p.hospital_id AS patient_hospital
    FROM tok s
    INNER JOIN public.user_profiles u ON u.id = s.user_id
    INNER JOIN public.patients p ON p.id = s.patient_id
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
  del AS (
    DELETE FROM public.patient_photo_capture_tokens t
    USING bounds b
    WHERE t.token = b.tok
      AND EXISTS (SELECT 1 FROM upd)
    RETURNING t.id
  )
  SELECT EXISTS (SELECT 1 FROM upd)
$mig069_complete$;

GRANT EXECUTE ON FUNCTION public.get_patient_photo_capture_context(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_patient_photo_capture(TEXT, TEXT) TO anon, authenticated;

COMMENT ON TABLE public.patient_photo_capture_tokens IS 'One-time tokens for patient photo capture via email link (phone camera).';
COMMENT ON FUNCTION public.get_patient_photo_capture_context(TEXT) IS 'Returns JSON {valid, patientId?, patientName?} for token validation on capture landing page.';
COMMENT ON FUNCTION public.complete_patient_photo_capture(TEXT, TEXT) IS 'Consumes token and saves patient_photo on patients row after scope check.';
