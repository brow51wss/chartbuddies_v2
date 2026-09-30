import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import {
  assertSubscriptionWrite,
  getOrCreateFacilitySubscription,
  isFacilityPcg,
} from '../../../lib/facilityBilling'
import { getStripe, isStripeConfigured, stripeRuntimeConfig } from '../../../lib/stripeServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured yet. Add the extra-nurse price ID first.' })
  }

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })
  if (!isFacilityPcg(auth.profile) || !auth.profile.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can buy extra seats.' })
  }

  try {
    const { subscription, tableMissing } = await getOrCreateFacilitySubscription(
      auth.admin,
      auth.profile.hospital_id,
      auth.profile.id
    )
    if (tableMissing || !subscription) {
      return res.status(503).json({ error: 'Billing table is not applied yet. Run migration 076.' })
    }

    const nextExtra = (subscription.extra_nurse_seats || 0) + 1

    if (!subscription.stripe_subscription_id) {
      return res.status(409).json({
        error: 'Subscribe the facility first, then add extra nurses.',
        needsCheckout: true,
        extraNurseSeats: nextExtra,
      })
    }

    const stripe = getStripe()
    const { priceExtraNurse } = stripeRuntimeConfig()
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
    const extraItem = stripeSub.items.data.find((item) => item.price.id === priceExtraNurse)

    if (extraItem) {
      await stripe.subscriptionItems.update(extraItem.id, { quantity: nextExtra })
      const wrote = await auth.admin
        .from('facility_subscriptions')
        .update({
          extra_nurse_seats: nextExtra,
          stripe_extra_item_id: extraItem.id,
        })
        .eq('hospital_id', auth.profile.hospital_id)
        .select('hospital_id')
      await assertSubscriptionWrite(wrote)
    } else {
      const created = await stripe.subscriptionItems.create({
        subscription: subscription.stripe_subscription_id,
        price: priceExtraNurse,
        quantity: nextExtra,
      })
      const wrote = await auth.admin
        .from('facility_subscriptions')
        .update({
          extra_nurse_seats: nextExtra,
          stripe_extra_item_id: created.id,
        })
        .eq('hospital_id', auth.profile.hospital_id)
        .select('hospital_id')
      await assertSubscriptionWrite(wrote)
    }

    return res.status(200).json({ extraNurseSeats: nextExtra })
  } catch (err: any) {
    console.error('[billing/add-seat]', err?.message || err)
    return res.status(500).json({ error: 'Failed to add a nurse seat' })
  }
}
