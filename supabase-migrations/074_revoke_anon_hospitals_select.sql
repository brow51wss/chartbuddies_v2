-- Diagnosed 2026-09-02: anon REST GET /hospitals returned rows (HTTP 206)
-- and could read invite_code. No repo migration defined that policy.
-- Staff clock-in now searches via /api/staff/facilities (service role, safe columns).
-- Apply this in the Supabase SQL editor after that API is deployed so PostgREST
-- cannot list invite codes without a session.

REVOKE SELECT ON TABLE public.hospitals FROM anon;
