import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import {
  EXTRA_NURSE_MONTHLY_CENTS,
  FACILITY_MONTHLY_CENTS,
  allowedNurseSeats,
  countActiveNurses,
  facilityHasAccess,
  getOrCreateFacilitySubscription,
  isFacilityPcg,
  isPlatformAdmin,
  trialDaysRemaining,
} from '../../../lib/facilityBilling'
import { isStripeConfigured } from '../../../lib/stripeServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })

  if (isPlatformAdmin(auth.profile)) {
    return res.status(200).json({
      platform: true,
      stripeConfigured: isStripeConfigured(),
    })
  }

  if (!isFacilityPcg(auth.profile) || !auth.profile.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can view billing.' })
  }

  try {
    const { subscription, tableMissing } = await getOrCreateFacilitySubscription(
      auth.admin,
      auth.profile.hospital_id,
      auth.profile.id
    )
    if (tableMissing || !subscription) {
      return res.status(200).json({
        unconfigured: true,
        stripeConfigured: isStripeConfigured(),
        allowed: true,
      })
    }

    const nurseCount = await countActiveNurses(auth.admin, auth.profile.hospital_id)
    const seats = allowedNurseSeats(subscription)
    return res.status(200).json({
      hospitalId: subscription.hospital_id,
      status: subscription.status,
      allowed: facilityHasAccess(subscription),
      trialDaysRemaining: trialDaysRemaining(subscription),
      trialEndsAt: subscription.trial_ends_at,
      includedNurseSeats: subscription.included_nurse_seats,
      extraNurseSeats: subscription.extra_nurse_seats,
      nurseSeatsAllowed: seats,
      nurseSeatsUsed: nurseCount,
      canAddNurse: nurseCount < seats,
      facilityPriceCents: FACILITY_MONTHLY_CENTS,
      extraNursePriceCents: EXTRA_NURSE_MONTHLY_CENTS,
      hasStripeCustomer: Boolean(subscription.stripe_customer_id),
      hasStripeSubscription: Boolean(subscription.stripe_subscription_id),
      stripeConfigured: isStripeConfigured(),
    })
  } catch (err: any) {
    console.error('[billing/status]', err?.message || err)
    return res.status(500).json({ error: 'Failed to load billing status' })
  }
}
