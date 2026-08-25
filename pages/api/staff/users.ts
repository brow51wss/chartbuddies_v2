import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Service role client — bypasses RLS so we never need to expose user_profiles to anon.
// ONLY safe fields are returned; email is intentionally excluded.
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { hospital_id } = req.query

  if (!hospital_id || typeof hospital_id !== 'string') {
    return res.status(400).json({ error: 'hospital_id is required' })
  }

  const { data, error } = await adminClient
    .from('user_profiles')
    .select('id, full_name, first_name, last_name, staff_initials, staff_initials_text, staff_signature, role, hospital_id')
    .eq('hospital_id', hospital_id)
    .in('role', ['nurse', 'head_nurse'])
    .eq('is_active', true)
    .order('full_name')

  if (error) {
    console.error('[staff/users] query error:', error.message)
    return res.status(500).json({ error: 'Failed to load staff' })
  }

  return res.status(200).json(data ?? [])
}
