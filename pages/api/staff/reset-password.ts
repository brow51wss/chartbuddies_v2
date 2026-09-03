import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Server is not configured for password reset' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: caller, error: callerError } = await admin
    .from('user_profiles')
    .select('id, role, hospital_id, is_active')
    .eq('id', user.id)
    .single()

  if (callerError || !caller || !caller.is_active) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (caller.role !== 'superadmin' || !caller.hospital_id) {
    return res.status(403).json({ error: 'Only the facility PCG can reset caregiver passwords' })
  }

  const body = req.body as { user_profile_id?: string; password?: string }
  const targetId = (body.user_profile_id || '').trim()
  const password = body.password || ''
  if (!targetId) {
    return res.status(400).json({ error: 'Caregiver is required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }
  if (targetId === caller.id) {
    return res.status(400).json({ error: 'Use Admin login to change your own password' })
  }

  const { data: target, error: targetError } = await admin
    .from('user_profiles')
    .select('id, role, hospital_id, is_active')
    .eq('id', targetId)
    .single()

  if (targetError || !target) {
    return res.status(404).json({ error: 'Caregiver not found' })
  }
  if (target.hospital_id !== caller.hospital_id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (!target.is_active) {
    return res.status(400).json({ error: 'This caregiver is inactive' })
  }
  if (target.role === 'superadmin') {
    return res.status(400).json({ error: 'Cannot reset a PCG password from here' })
  }
  if (target.role !== 'nurse' && target.role !== 'head_nurse') {
    return res.status(400).json({ error: 'Can only reset staff login passwords' })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(target.id, { password })
  if (updateError) {
    return res.status(400).json({ error: 'Failed to reset password. Try again.' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ ok: true })
}
