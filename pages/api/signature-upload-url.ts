import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authHeader = req.headers.authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  })

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { type } = req.body as { type?: string }
  if (type !== 'signature' && type !== 'initials') {
    return res.status(400).json({ error: 'Invalid type. Must be signature or initials.' })
  }

  const { bucket } = getS3Config()
  const key = `signatures/${user.id}/${Date.now()}-${type}.jpg`

  const s3 = createS3Client()
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: 'image/jpeg',
  })

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

  return res.status(200).json({ uploadUrl, key })
}
