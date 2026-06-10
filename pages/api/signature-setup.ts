import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

async function makeUploadUrl(key: string): Promise<string> {
  const { bucket } = getS3Config()
  const s3 = createS3Client()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'image/jpeg',
  })
  return getSignedUrl(s3, command, { expiresIn: 600 })
}

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
    if (!userId) return res.status(200).json({ valid: false })

    const ts = Date.now()
    const sigKey = `signatures/${userId}/${ts}-signature.jpg`
    const iniKey = `signatures/${userId}/${ts}-initials.jpg`

    const [signatureUploadUrl, initialsUploadUrl] = await Promise.all([
      makeUploadUrl(sigKey),
      makeUploadUrl(iniKey),
    ])

    return res.status(200).json({
      valid: true,
      signatureUploadUrl,
      initialsUploadUrl,
      signatureKey: `s3:${sigKey}`,
      initialsKey: `s3:${iniKey}`,
    })
  }

  if (req.method === 'POST') {
    const { token, signatureKey, initialsKey } = req.body as {
      token?: string
      signatureKey?: string
      initialsKey?: string
    }
    const t = typeof token === 'string' ? token.trim() : ''
    const sig = typeof signatureKey === 'string' ? signatureKey.trim() : ''
    const ini = typeof initialsKey === 'string' ? initialsKey.trim() : ''
    if (!t || !sig || !ini) {
      return res.status(400).json({ success: false, error: 'Missing token, signature, or initials' })
    }
    if (!sig.startsWith('s3:') || !ini.startsWith('s3:')) {
      return res.status(400).json({ success: false, error: 'Invalid signature format' })
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
