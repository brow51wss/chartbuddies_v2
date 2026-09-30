-- Facility billing / seats. Card numbers stay in Stripe.
-- App stores trial, seat counts, and Stripe IDs only.

CREATE TABLE IF NOT EXISTS public.facility_subscriptions (
  hospital_id UUID PRIMARY KEY REFERENCES public.hospitals(id) ON DELETE CASCADE,
  billing_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'grandfathered')),
  trial_ends_at TIMESTAMPTZ,
  past_due_since TIMESTAMPTZ,
  included_nurse_seats INTEGER NOT NULL DEFAULT 2,
  extra_nurse_seats INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_extra_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_facility_subscriptions_billing_user
  ON public.facility_subscriptions(billing_user_id);
CREATE INDEX IF NOT EXISTS idx_facility_subscriptions_status
  ON public.facility_subscriptions(status);

ALTER TABLE public.facility_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.facility_subscriptions FROM anon, authenticated;
GRANT SELECT ON TABLE public.facility_subscriptions TO authenticated;
GRANT ALL ON TABLE public.facility_subscriptions TO service_role;

DROP POLICY IF EXISTS "pcg_or_platform_reads_facility_billing" ON public.facility_subscriptions;
CREATE POLICY "pcg_or_platform_reads_facility_billing"
  ON public.facility_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active = true
        AND up.role = 'superadmin'
        AND (
          up.hospital_id IS NULL
          OR up.hospital_id = facility_subscriptions.hospital_id
        )
    )
  );

CREATE OR REPLACE FUNCTION public.touch_facility_subscription_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facility_subscriptions_updated_at ON public.facility_subscriptions;
CREATE TRIGGER trg_facility_subscriptions_updated_at
  BEFORE UPDATE ON public.facility_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_facility_subscription_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_facility_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.facility_subscriptions (
    hospital_id,
    status,
    trial_ends_at,
    included_nurse_seats,
    extra_nurse_seats
  )
  VALUES (
    NEW.id,
    'trialing',
    NOW() + INTERVAL '14 days',
    2,
    0
  )
  ON CONFLICT (hospital_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hospitals_ensure_subscription ON public.hospitals;
CREATE TRIGGER trg_hospitals_ensure_subscription
  AFTER INSERT ON public.hospitals
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_facility_subscription();

-- Existing hospitals start a 14-day trial when this migration is applied.
-- No grandfathered free access. Extra nurses stay in the roster but are over-seat.
INSERT INTO public.facility_subscriptions (
  hospital_id,
  status,
  trial_ends_at,
  included_nurse_seats,
  extra_nurse_seats
)
SELECT
  h.id,
  'trialing',
  NOW() + INTERVAL '14 days',
  2,
  0
FROM public.hospitals h
ON CONFLICT (hospital_id) DO NOTHING;

UPDATE public.facility_subscriptions fs
SET billing_user_id = (
  SELECT up.id
  FROM public.user_profiles up
  WHERE up.hospital_id = fs.hospital_id
    AND up.role = 'superadmin'
    AND up.is_active = true
  ORDER BY up.created_at
  LIMIT 1
)
WHERE fs.billing_user_id IS NULL;
