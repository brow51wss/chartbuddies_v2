-- One-time tokens for signature/initials capture via email link (mobile/tablet).
-- Authenticated users insert a row for themselves; token is validated and consumed by anon via SECURITY DEFINER functions.

CREATE TABLE IF NOT EXISTS public.signature_setup_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signature_setup_tokens_token ON public.signature_setup_tokens(token);
CREATE INDEX IF NOT EXISTS idx_signature_setup_tokens_expires_at ON public.signature_setup_tokens(expires_at);

ALTER TABLE public.signature_setup_tokens ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only insert a row for themselves (used when requesting the email).
CREATE POLICY "Users can insert own signature setup token"
  ON public.signature_setup_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- No SELECT/UPDATE/DELETE for authenticated; token validation and consumption happen via SECURITY DEFINER functions.
-- Service role can do anything for cleanup if needed.

GRANT INSERT ON public.signature_setup_tokens TO authenticated;
GRANT SELECT, DELETE ON public.signature_setup_tokens TO service_role;

-- Returns user_id if token exists and is not expired; otherwise NULL. Used by GET /api/signature-setup.
CREATE OR REPLACE FUNCTION public.get_signature_setup_user_id(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN NULL;
  END IF;
  SELECT user_id INTO v_user_id
  FROM public.signature_setup_tokens
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;
  RETURN v_user_id;
END;
$$;

-- Consumes token (deletes it), updates user_profiles with drawn signature and initials, returns true. Used by POST /api/signature-setup.
CREATE OR REPLACE FUNCTION public.complete_signature_setup(
  p_token TEXT,
  p_signature_data TEXT,
  p_initials_data TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR trim(p_token) = '' THEN
    RETURN FALSE;
  END IF;
  IF p_signature_data IS NULL OR trim(p_signature_data) = '' OR p_initials_data IS NULL OR trim(p_initials_data) = '' THEN
    RETURN FALSE;
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.signature_setup_tokens
  WHERE token = p_token AND expires_at > now()
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.signature_setup_tokens WHERE token = p_token;

  UPDATE public.user_profiles
  SET
    staff_signature = p_signature_data,
    staff_initials = p_initials_data,
    staff_signature_text = NULL,
    staff_initials_text = NULL,
    staff_signature_font = NULL,
    updated_at = now()
  WHERE id = v_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_signature_setup_user_id(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_signature_setup(TEXT, TEXT, TEXT) TO anon, authenticated;

COMMENT ON TABLE public.signature_setup_tokens IS 'One-time tokens for signature/initials capture via email link; requires mobile/tablet.';
COMMENT ON FUNCTION public.get_signature_setup_user_id(TEXT) IS 'Validates token and returns user_id if valid and not expired.';
COMMENT ON FUNCTION public.complete_signature_setup(TEXT, TEXT, TEXT) IS 'Consumes token and saves drawn signature and initials to user_profiles.';
