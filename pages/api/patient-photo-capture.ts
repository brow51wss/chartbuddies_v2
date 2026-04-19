import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  if (req.method === 'GET') {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Missing token' })
    }
    const { data, error } = await supabase.rpc('get_patient_photo_capture_context', { p_token: token })
    if (error) {
      console.error('[patient-photo-capture] get_patient_photo_capture_context:', error)
      return res.status(500).json({ valid: false })
    }
    const ctx = data as { valid?: boolean; patientId?: string; patientName?: string } | null
    if (!ctx?.valid) {
      return res.status(200).json({ valid: false })
    }
    return res.status(200).json({
      valid: true,
      patientId: ctx.patientId,
      patientName: ctx.patientName,
    })
  }

  if (req.method === 'POST') {
    const { token, photoDataUrl } = req.body as { token?: string; photoDataUrl?: string }
    const t = typeof token === 'string' ? token.trim() : ''
    const photo = typeof photoDataUrl === 'string' ? photoDataUrl.trim() : ''
    if (!t || !photo) {
      return res.status(400).json({ success: false, error: 'Missing token or photo' })
    }
    if (!photo.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'Photo must be image data' })
    }
    const { data: ok, error } = await supabase.rpc('complete_patient_photo_capture', {
      p_token: t,
      p_photo_data: photo,
    })
    if (error) {
      console.error('[patient-photo-capture] complete_patient_photo_capture:', error)
      return res.status(500).json({ success: false, error: 'Failed to save' })
    }
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Link expired or invalid' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
