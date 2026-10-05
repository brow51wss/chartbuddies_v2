-- 078: Retire the patient photo capture feature at the database layer.
--
-- Why: the app code for patient photos was removed (2026-10-05). Migrations 069/070 left
-- SECURITY DEFINER functions with EXECUTE granted to anon/authenticated, plus a token
-- table that any signed-in user can INSERT into. Cowork audit 2026-10-05 (HIGH #1):
--   * get_patient_photo_capture_context has no facility check -> reads any patient's name
--   * complete_patient_photo_capture allows any facility PCG (superadmin) to write a photo
--     onto another facility's patient
-- Dropping them closes both, independent of any app deploy.
--
-- NOT dropped here (separate data-cleanup step, needs explicit approval):
--   * public.patients.patient_photo column
--   * patient-photos/ objects in S3
--
-- No CASCADE on purpose: if anything unexpected depends on these objects, this fails
-- loudly instead of silently dropping more.
-- Run in Supabase SQL Editor (production). Safe to re-run (IF EXISTS).

BEGIN;

-- 1) Drop the functions first: this closes the anon/authenticated EXECUTE door immediately
--    (exact signatures from 069/070)
DROP FUNCTION IF EXISTS public.get_patient_photo_capture_context(TEXT);
DROP FUNCTION IF EXISTS public.complete_patient_photo_capture(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.pop_patient_photo_mobile_pickup();

-- 2) Drop the tables (transient tokens / pickups only). Their grants, RLS policies and
--    indexes are removed with them, so no separate REVOKE is needed.
DROP TABLE IF EXISTS public.patient_photo_capture_tokens;
DROP TABLE IF EXISTS public.patient_photo_mobile_pickups;

COMMIT;

-- Verify (expect 0 rows from each):
--   SELECT proname FROM pg_proc WHERE proname ILIKE '%patient_photo%';
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE '%patient_photo%';
