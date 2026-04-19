import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: photoDataUrl, error } = await supabase.rpc('pop_patient_photo_mobile_pickup')
  if (error) {
    console.error('[patient-photo-pickup] pop_patient_photo_mobile_pickup:', error)
    return res.status(500).json({ error: 'Failed to load photo' })
  }

  const url = typeof photoDataUrl === 'string' && photoDataUrl.length > 0 ? photoDataUrl : null
  return res.status(200).json({ photoDataUrl: url })
}
