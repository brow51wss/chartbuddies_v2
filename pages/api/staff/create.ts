import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function initialsFromNames(first: string, last: string, explicit: string): string {
  const trimmed = explicit.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4)
  if (trimmed) return trimmed
  const a = first.trim()[0] || ''
  const b = last.trim()[0] || ''
  return (a + b).toUpperCase() || '?'
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ error: 'Server is not configured for staff creation' })
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
    return res.status(403).json({ error: 'Only the facility PCG can add caregivers' })
  }

  const body = req.body as {
    first_name?: string
    last_name?: string
    initials?: string
    password?: string
  }
  const firstName = (body.first_name || '').trim()
  const lastName = (body.last_name || '').trim()
  const password = body.password || ''
  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const initials = initialsFromNames(firstName, lastName, body.initials || '')
  const fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()
  const email = `scg-${randomBytes(8).toString('hex')}@staff.lasso-app.com`

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, first_name: firstName, last_name: lastName },
  })

  if (createError || !created.user) {
    return res.status(400).json({ error: createError?.message || 'Failed to create caregiver' })
  }

  // Typed initials/signature so they skip email onboarding (generated staff emails cannot receive that link)
  // and can chart immediately — same pattern MAR already uses for plain-text initials.
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .upsert({
      id: created.user.id,
      email,
      full_name: fullName,
      first_name: firstName,
      last_name: lastName,
      role: 'nurse',
      designation: 'SCG',
      designation_locked: true,
      hospital_id: caller.hospital_id,
      staff_initials: initials,
      staff_initials_text: initials,
      staff_signature: fullName,
      staff_signature_text: fullName,
      is_active: true,
    }, { onConflict: 'id' })
    .select('id, full_name, first_name, last_name, staff_initials_text, role, designation, hospital_id')
    .single()

  if (profileError || !profile) {
    await admin.auth.admin.deleteUser(created.user.id)
    return res.status(500).json({ error: 'Caregiver account was created but profile setup failed. Try again.' })
  }

  res.setHeader('Cache-Control', 'no-store')
  return res.status(201).json({ caregiver: profile })
}
