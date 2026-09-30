import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import { getFacilitySubscription, isFacilityPcg } from '../../../lib/facilityBilling'
import { appBaseUrl, getStripe, isStripeConfigured } from '../../../lib/stripeServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'Stripe is not configured yet.' })
  }

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })
  if (!isFacilityPcg(auth.profile) || !auth.profile.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can manage billing.' })
  }

  try {
    const { subscription, tableMissing } = await getFacilitySubscription(auth.admin, auth.profile.hospital_id)
    if (tableMissing || !subscription?.stripe_customer_id) {
      return res.status(400).json({ error: 'No Stripe customer yet. Subscribe first.' })
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${appBaseUrl()}/billing`,
    })
    return res.status(200).json({ url: session.url })
  } catch (err: any) {
    console.error('[billing/portal]', err?.message || err)
    return res.status(500).json({ error: 'Failed to open billing portal' })
  }
}
