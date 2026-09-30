import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import {
  assertSubscriptionWrite,
  getOrCreateFacilitySubscription,
  isFacilityPcg,
} from '../../../lib/facilityBilling'
import { appBaseUrl, getStripe, isStripeConfigured, stripeRuntimeConfig } from '../../../lib/stripeServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured yet. Add the Stripe keys and price IDs first.' })
  }

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })
  if (!isFacilityPcg(auth.profile) || !auth.profile.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can subscribe.' })
  }

  const extraRequested = Number(req.body?.extraNurseSeats)
  try {
    const { subscription, tableMissing } = await getOrCreateFacilitySubscription(
      auth.admin,
      auth.profile.hospital_id,
      auth.profile.id
    )
    if (tableMissing || !subscription) {
      return res.status(503).json({ error: 'Billing table is not applied yet. Run migration 076.' })
    }

    if (
      subscription.stripe_subscription_id &&
      (subscription.status === 'active' || subscription.status === 'past_due')
    ) {
      return res.status(409).json({
        error: 'This facility already has a subscription. Use Manage payment method.',
        needsPortal: true,
      })
    }

    const extraSeats = Number.isFinite(extraRequested)
      ? Math.max(0, Math.floor(extraRequested))
      : subscription.extra_nurse_seats || 0

    const stripe = getStripe()
    const prices = stripeRuntimeConfig()
    let customerId = subscription.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.profile.email,
        name: auth.profile.full_name,
        metadata: {
          hospital_id: auth.profile.hospital_id,
          billing_user_id: auth.profile.id,
        },
      })
      customerId = customer.id
      const wrote = await auth.admin
        .from('facility_subscriptions')
        .update({
          stripe_customer_id: customerId,
          billing_user_id: auth.profile.id,
        })
        .eq('hospital_id', auth.profile.hospital_id)
        .select('hospital_id')
      await assertSubscriptionWrite(wrote)
    }

    const lineItems: { price: string; quantity: number }[] = [
      { price: prices.priceFacility, quantity: 1 },
    ]
    if (extraSeats > 0) {
      lineItems.push({ price: prices.priceExtraNurse, quantity: extraSeats })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: auth.profile.hospital_id,
      line_items: lineItems,
      success_url: `${appBaseUrl()}/billing?checkout=success`,
      cancel_url: `${appBaseUrl()}/billing?checkout=canceled`,
      metadata: {
        hospital_id: auth.profile.hospital_id,
        billing_user_id: auth.profile.id,
      },
      subscription_data: {
        metadata: {
          hospital_id: auth.profile.hospital_id,
          billing_user_id: auth.profile.id,
        },
      },
    })

    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('[billing/checkout]', err?.message || err)
    return res.status(500).json({ error: 'Failed to start checkout' })
  }
}
