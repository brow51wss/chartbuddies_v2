import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const ACCESS_CODE = 'LAX926'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  if (req.query.code !== ACCESS_CODE) {
    return res.status(401).json({ error: 'Invalid access code' })
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)
  const { data: leads, error } = await supabaseAdmin
    .from('early_access_leads')
    .select('id, full_name, email, phone, facility, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[early-access-leads] fetch error:', error)
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }

  return res.status(200).json({ leads: leads ?? [] })
}
