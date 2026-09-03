import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'
import { clientIp, rateLimit, rejectTooMany } from '../../../lib/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const ip = clientIp(req)
  const ipLimit = rateLimit(`staff-signin-ip:${ip}`, 20, 15 * 60_000)
  if (!ipLimit.ok) return rejectTooMany(res, ipLimit.retryAfterSec)

  const { user_profile_id, password } = req.body as {
    user_profile_id?: string
    password?: string
  }

  if (!user_profile_id || !UUID_RE.test(user_profile_id) || !password?.trim()) {
    return res.status(400).json({ error: 'user_profile_id and password are required' })
  }

  const idLimit = rateLimit(`staff-signin-id:${user_profile_id}`, 5, 15 * 60_000)
  if (!idLimit.ok) return rejectTooMany(res, idLimit.retryAfterSec)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Server is not configured' })
  }

  const adminClient = createClient(supabaseUrl, serviceKey)
  const authClient = createClient(supabaseUrl, anonKey)

  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('email, is_active, role')
    .eq('id', user_profile_id)
    .single()

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (!profile.is_active) {
    return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' })
  }

  if (profile.role === 'superadmin') {
    return res.status(403).json({ error: 'Please use the administrator login.' })
  }

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (authError || !authData.session) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' })
  }

  return res.status(200).json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  })
}
