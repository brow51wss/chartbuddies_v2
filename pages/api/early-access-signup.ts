import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { full_name, email, phone, facility } = req.body ?? {}

  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2) {
    return res.status(400).json({ error: 'Full name is required.' })
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  if (!phone || typeof phone !== 'string' || phone.trim().length < 7) {
    return res.status(400).json({ error: 'Phone number is required.' })
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { error } = await supabase.from('early_access_leads').insert({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      facility: facility?.trim() || null,
    })

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'This email has already been registered for early access.' })
      }
      console.error('[early-access-signup] Supabase insert error:', error)
      return res.status(500).json({ error: 'Failed to save your registration. Please try again.' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('[early-access-signup] Unexpected error:', err)
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' })
  }
}
