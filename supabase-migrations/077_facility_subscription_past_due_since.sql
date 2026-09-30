-- Grace window for failed cards. Run after 076 (already applied on live).
ALTER TABLE public.facility_subscriptions
  ADD COLUMN IF NOT EXISTS past_due_since TIMESTAMPTZ;
