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
    const { data: userId, error } = await supabase.rpc('get_signature_setup_user_id', { p_token: token })
    if (error) {
      console.error('[signature-setup] get_signature_setup_user_id:', error)
      return res.status(500).json({ valid: false })
    }
    return res.status(200).json({ valid: !!userId })
  }

  if (req.method === 'POST') {
    const { token, signatureDataUrl, initialsDataUrl } = req.body as {
      token?: string
      signatureDataUrl?: string
      initialsDataUrl?: string
    }
    const t = typeof token === 'string' ? token.trim() : ''
    const sig = typeof signatureDataUrl === 'string' ? signatureDataUrl.trim() : ''
    const ini = typeof initialsDataUrl === 'string' ? initialsDataUrl.trim() : ''
    if (!t || !sig || !ini) {
      return res.status(400).json({ success: false, error: 'Missing token, signature, or initials' })
    }
    if (!sig.startsWith('data:image') || !ini.startsWith('data:image')) {
      return res.status(400).json({ success: false, error: 'Signature and initials must be drawn (image data)' })
    }
    const { data: ok, error } = await supabase.rpc('complete_signature_setup', {
      p_token: t,
      p_signature_data: sig,
      p_initials_data: ini
    })
    if (error) {
      console.error('[signature-setup] complete_signature_setup:', error)
      return res.status(500).json({ success: false, error: 'Failed to save' })
    }
    if (!ok) {
      return res.status(400).json({ success: false, error: 'Link expired or invalid' })
    }
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
