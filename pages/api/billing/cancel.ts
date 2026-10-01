import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import {
  assertSubscriptionWrite,
  getFacilitySubscription,
  isFacilityPcg,
} from '../../../lib/facilityBilling'
import { getStripe, isStripeConfigured } from '../../../lib/stripeServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })
  if (!isFacilityPcg(auth.profile) || !auth.profile.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can cancel billing.' })
  }

  try {
    const { subscription, tableMissing } = await getFacilitySubscription(auth.admin, auth.profile.hospital_id)
    if (tableMissing || !subscription) {
      return res.status(503).json({ error: 'Billing is not configured yet.' })
    }
    if (subscription.status === 'canceled') {
      return res.status(400).json({ error: 'This facility plan is already canceled.' })
    }

    const undo = Boolean(req.body?.undo)

    if (subscription.stripe_subscription_id) {
      if (!isStripeConfigured()) {
        return res.status(503).json({ error: 'Stripe is not configured yet.' })
      }
      const stripe = getStripe()
      const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
      if (stripeSub.status === 'canceled' || stripeSub.status === 'incomplete_expired') {
        const wrote = await auth.admin
          .from('facility_subscriptions')
          .update({ status: 'canceled', extra_nurse_seats: 0, stripe_extra_item_id: null, past_due_since: null })
          .eq('hospital_id', auth.profile.hospital_id)
          .select('hospital_id')
        await assertSubscriptionWrite(wrote)
        return res.status(200).json({ canceled: true, immediate: true })
      }

      if (stripeSub.status === 'incomplete') {
        if (undo) {
          return res.status(400).json({ error: 'An incomplete checkout cannot be kept. Cancel it, then subscribe again.' })
        }
        await stripe.subscriptions.cancel(stripeSub.id, { prorate: true })
        const wrote = await auth.admin
          .from('facility_subscriptions')
          .update({ status: 'canceled', extra_nurse_seats: 0, stripe_extra_item_id: null, past_due_since: null })
          .eq('hospital_id', auth.profile.hospital_id)
          .select('hospital_id')
        await assertSubscriptionWrite(wrote)
        return res.status(200).json({ canceled: true, immediate: true })
      }

      await stripe.subscriptions.update(stripeSub.id, { cancel_at_period_end: !undo })
      return res.status(200).json({
        canceled: !undo,
        atPeriodEnd: !undo,
        undo,
      })
    }

    if (undo) {
      return res.status(400).json({ error: 'There is no scheduled cancellation to undo.' })
    }

    const wrote = await auth.admin
      .from('facility_subscriptions')
      .update({
        status: 'canceled',
        extra_nurse_seats: 0,
        stripe_extra_item_id: null,
        past_due_since: null,
      })
      .eq('hospital_id', auth.profile.hospital_id)
      .select('hospital_id')
    await assertSubscriptionWrite(wrote)
    return res.status(200).json({ canceled: true, immediate: true })
  } catch (err: any) {
    console.error('[billing/cancel]', err?.message || err)
    return res.status(500).json({ error: 'Failed to update cancellation' })
  }
}
