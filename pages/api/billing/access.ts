import type { NextApiRequest, NextApiResponse } from 'next'
import { requireBearerProfile } from '../../../lib/supabaseAdmin'
import {
  facilityHasAccess,
  getFacilitySubscription,
  isPlatformAdmin,
} from '../../../lib/facilityBilling'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  res.setHeader('Cache-Control', 'no-store')

  const auth = await requireBearerProfile(req)
  if (!auth.ok) return res.status(auth.error.status).json({ error: auth.error.message })

  if (isPlatformAdmin(auth.profile) || !auth.profile.hospital_id) {
    return res.status(200).json({ allowed: true, reason: 'platform' })
  }

  try {
    const { subscription, tableMissing } = await getFacilitySubscription(auth.admin, auth.profile.hospital_id)
    if (tableMissing) {
      return res.status(200).json({ allowed: false, reason: 'unconfigured' })
    }
    return res.status(200).json({
      allowed: facilityHasAccess(subscription),
      status: subscription?.status ?? null,
    })
  } catch (err: any) {
    console.error('[billing/access]', err?.message || err)
    return res.status(500).json({ error: 'Failed to check billing access' })
  }
}
