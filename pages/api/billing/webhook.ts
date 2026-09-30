import type { NextApiRequest, NextApiResponse } from 'next'
import type Stripe from 'stripe'
import { createServiceClient } from '../../../lib/supabaseAdmin'
import { getStripe, stripeRuntimeConfig } from '../../../lib/stripeServer'
import {
  BILLING_SELECT,
  assertSubscriptionWrite,
  type FacilityBillingStatus,
  type FacilitySubscription,
} from '../../../lib/facilityBilling'

export const config = {
  api: { bodyParser: false },
}

async function rawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

function mapStripeStatus(status: Stripe.Subscription.Status): FacilityBillingStatus {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'incomplete') return 'past_due'
  return 'canceled'
}

function customerIdOf(stripeSub: Stripe.Subscription): string {
  return typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id
}

function acceptsIncomingSub(existing: FacilitySubscription | null, incomingId: string): boolean {
  if (!existing?.stripe_subscription_id) return true
  if (existing.stripe_subscription_id === incomingId) return true
  if (existing.status === 'canceled') return true
  return false
}

async function applySubscription(stripeSub: Stripe.Subscription) {
  const admin = createServiceClient()
  const prices = stripeRuntimeConfig()
  const hospitalId =
    (typeof stripeSub.metadata?.hospital_id === 'string' && stripeSub.metadata.hospital_id) ||
    null
  const customerId = customerIdOf(stripeSub)

  const existingQuery = hospitalId
    ? admin.from('facility_subscriptions').select(BILLING_SELECT).eq('hospital_id', hospitalId).maybeSingle()
    : admin.from('facility_subscriptions').select(BILLING_SELECT).eq('stripe_customer_id', customerId).maybeSingle()

  const { data: existingRow, error: loadError } = await existingQuery
  if (loadError) throw loadError
  const existing = (existingRow as FacilitySubscription | null) ?? null

  if (!acceptsIncomingSub(existing, stripeSub.id)) {
    console.warn('[billing/webhook] ignored event for non-current subscription', stripeSub.id)
    return
  }

  const extraItem = stripeSub.items.data.find((item) => item.price.id === prices.priceExtraNurse)
  const nextStatus = mapStripeStatus(stripeSub.status)
  const patch: Record<string, unknown> = {
    stripe_subscription_id: stripeSub.id,
    stripe_customer_id: customerId,
    stripe_extra_item_id: extraItem?.id ?? null,
    extra_nurse_seats: extraItem?.quantity ?? 0,
    status: nextStatus,
    past_due_since:
      nextStatus === 'past_due'
        ? existing?.past_due_since || new Date().toISOString()
        : null,
  }

  const billingUserId = stripeSub.metadata?.billing_user_id
  if (billingUserId) {
    const { data: payer } = await admin.from('user_profiles').select('id').eq('id', billingUserId).maybeSingle()
    if (payer?.id) patch.billing_user_id = payer.id
  }

  const writer = admin.from('facility_subscriptions').update(patch).select('hospital_id')
  const result = hospitalId
    ? await writer.eq('hospital_id', hospitalId)
    : await writer.eq('stripe_customer_id', customerId)

  await assertSubscriptionWrite({
    data: result.data as { hospital_id: string }[] | null,
    error: result.error,
  })
}

async function applySubscriptionId(subscriptionId: string) {
  const stripeSub = await getStripe().subscriptions.retrieve(subscriptionId)
  await applySubscription(stripeSub)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { webhookSecret } = stripeRuntimeConfig()
  if (!webhookSecret) {
    return res.status(503).json({ error: 'Webhook secret is not configured' })
  }

  let event: Stripe.Event
  try {
    const body = await rawBody(req)
    const signature = req.headers['stripe-signature']
    if (!signature || Array.isArray(signature)) {
      return res.status(400).json({ error: 'Missing Stripe signature' })
    }
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[billing/webhook] signature', err?.message || err)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.subscription) {
        const stripeSub = await getStripe().subscriptions.retrieve(String(session.subscription))
        if (session.metadata?.hospital_id && !stripeSub.metadata?.hospital_id) {
          await getStripe().subscriptions.update(stripeSub.id, {
            metadata: {
              hospital_id: session.metadata.hospital_id,
              billing_user_id: session.metadata.billing_user_id || '',
            },
          })
          stripeSub.metadata = {
            ...stripeSub.metadata,
            hospital_id: session.metadata.hospital_id,
            billing_user_id: session.metadata.billing_user_id || '',
          }
        }
        await applySubscription(stripeSub)
      }
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.deleted'
    ) {
      const incoming = event.data.object as Stripe.Subscription
      await applySubscriptionId(incoming.id)
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null
      }
      const subId = typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription?.id
      if (subId) await applySubscriptionId(subId)
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[billing/webhook]', err?.message || err)
    return res.status(500).json({ error: 'Webhook handler failed' })
  }
}
