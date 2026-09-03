import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'
import { createClient } from '@supabase/supabase-js'

function serviceRoleKey(): string {
  const { serverRuntimeConfig } = getConfig() || {}
  return serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = serviceRoleKey()
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(404).json({ error: 'Not found' })
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(404).json({ error: 'Not found' })
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: { user }, error: userError } = await callerClient.auth.getUser()
  if (userError || !user) {
    return res.status(404).json({ error: 'Not found' })
  }

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: caller } = await admin
    .from('user_profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!caller?.is_active || caller.role !== 'superadmin') {
    return res.status(404).json({ error: 'Not found' })
  }

  const { serverRuntimeConfig } = getConfig() || {}
  const rdsConnString = serverRuntimeConfig?.RDS_CONNECTION_STRING || process.env.RDS_CONNECTION_STRING

  return res.status(200).json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `SET (starts with: ${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 20)}...)`
      : 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey ? `SET (length: ${serviceKey.length})` : 'NOT SET',
    RDS_CONNECTION_STRING: rdsConnString ? `SET (length: ${rdsConnString.length})` : 'NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `SET (length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})`
      : 'NOT SET',
    source: {
      serviceRoleKey_from_serverRuntimeConfig: !!serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKey_from_processEnv: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      rds_from_serverRuntimeConfig: !!serverRuntimeConfig?.RDS_CONNECTION_STRING,
      rds_from_processEnv: !!process.env.RDS_CONNECTION_STRING,
    },
  })
}
