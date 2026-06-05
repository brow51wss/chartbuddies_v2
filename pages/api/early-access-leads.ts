import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = authHeader.split(' ')[1]
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid session' })

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || profile.role !== 'superadmin') {
    return res.status(403).json({ error: 'Superadmin access required' })
  }

  const { data: leads, error: leadsError } = await supabaseAdmin
    .from('early_access_leads')
    .select('id, full_name, email, phone, facility, created_at')
    .order('created_at', { ascending: false })

  if (leadsError) {
    console.error('[early-access-leads] fetch error:', leadsError)
    return res.status(500).json({ error: 'Failed to fetch leads' })
  }

  return res.status(200).json({ leads: leads ?? [] })
}
