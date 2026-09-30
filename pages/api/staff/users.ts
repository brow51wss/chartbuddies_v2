import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, rejectTooMany } from '../../../lib/rate-limit'
import {
  INCLUDED_NURSE_SEATS,
  allowedNurseSeats,
  getFacilitySubscription,
  seatedNurseIds,
} from '../../../lib/facilityBilling'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const limited = rateLimit(`staff-users:${clientIp(req)}`, 30, 60_000)
  if (!limited.ok) return rejectTooMany(res, limited.retryAfterSec)

  const { hospital_id } = req.query
  if (!hospital_id || typeof hospital_id !== 'string' || !UUID_RE.test(hospital_id)) {
    return res.status(400).json({ error: 'hospital_id is required' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server is not configured' })
  }

  const adminClient = createClient(supabaseUrl, serviceKey)
  const { data, error } = await adminClient
    .from('user_profiles')
    .select('id, full_name, first_name, last_name, staff_initials_text, role, created_at')
    .eq('hospital_id', hospital_id)
    .in('role', ['nurse', 'head_nurse'])
    .eq('is_active', true)
    .order('full_name')

  if (error) {
    console.error('[staff/users] query error:', error.message)
    return res.status(500).json({ error: 'Failed to load staff' })
  }

  const staff = data ?? []
  let allowed = INCLUDED_NURSE_SEATS
  try {
    const { subscription, tableMissing } = await getFacilitySubscription(adminClient, hospital_id)
    if (!tableMissing && subscription) allowed = allowedNurseSeats(subscription)
  } catch (err: any) {
    console.error('[staff/users] billing seats', err?.message || err)
  }

  const seated = seatedNurseIds(staff, allowed)
  return res.status(200).json(
    staff.map((person) => ({
      id: person.id,
      full_name: person.full_name,
      first_name: person.first_name,
      last_name: person.last_name,
      staff_initials_text: person.staff_initials_text,
      role: person.role,
      seat_locked: !seated.has(person.id),
    }))
  )
}
