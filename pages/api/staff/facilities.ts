import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, rejectTooMany } from '../../../lib/rate-limit'

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const limited = rateLimit(`staff-facilities:${clientIp(req)}`, 30, 60_000)
  if (!limited.ok) return rejectTooMany(res, limited.retryAfterSec)

  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length < 2) {
    return res.status(200).json([])
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server is not configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data, error } = await admin
    .from('hospitals')
    .select('id, name, facility_type, address, is_active')
    .ilike('name', `%${q}%`)
    .eq('is_active', true)
    .limit(6)

  if (error) {
    console.error('[staff/facilities] query error:', error.message)
    return res.status(500).json({ error: 'Failed to search facilities' })
  }

  return res.status(200).json(data ?? [])
}
