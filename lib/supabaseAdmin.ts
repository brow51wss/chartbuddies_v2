import getConfig from 'next/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { NextApiRequest } from 'next'

export function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = serviceRoleKey()
  if (!url || !key) {
    throw new Error('Supabase service client is not configured')
  }
  return createClient(url, key)
}

type BearerProfile = {
  id: string
  email: string
  full_name: string
  role: string
  hospital_id: string | null
  is_active: boolean
}

export type BearerAuthResult =
  | { ok: true; admin: SupabaseClient; profile: BearerProfile; user: { id: string } }
  | { ok: false; error: { status: number; message: string } }

export async function requireBearerProfile(req: NextApiRequest): Promise<BearerAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = serviceRoleKey()
  if (!url || !anonKey || !serviceKey) {
    return { ok: false, error: { status: 500, message: 'Server is not configured' } }
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return { ok: false, error: { status: 401, message: 'Unauthorized' } }
  }

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) {
    return { ok: false, error: { status: 401, message: 'Unauthorized' } }
  }

  const admin = createClient(url, serviceKey)
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('id, email, full_name, role, hospital_id, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || !profile.is_active) {
    return { ok: false, error: { status: 403, message: 'Forbidden' } }
  }

  return { ok: true, admin, profile, user }
}
