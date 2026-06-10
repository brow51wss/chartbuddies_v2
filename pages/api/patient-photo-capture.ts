import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function s3KeyToDataUrl(bucket: string, key: string): Promise<string> {
  const s3 = createS3Client()
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  const response = await s3.send(command)
  const chunks: Uint8Array[] = []
  const stream = response.Body as AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  const buffer = Buffer.concat(chunks)
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

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

    // Generate presigned S3 upload URL so the client can upload directly,
    // bypassing WAF and Lambda payload limits.
    const { bucket } = getS3Config()
    const key = `patient-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const s3 = createS3Client()
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }),
      { expiresIn: 600 }
    )

    return res.status(200).json({
      valid: true,
      patientId: ctx.patientId,
      patientName: ctx.patientName,
      photoUploadUrl: uploadUrl,
      photoKey: key,
    })
  }

  if (req.method === 'POST') {
    const { token, photoKey } = req.body as { token?: string; photoKey?: string }
    const t = typeof token === 'string' ? token.trim() : ''
    const key = typeof photoKey === 'string' ? photoKey.trim() : ''
    if (!t || !key) {
      return res.status(400).json({ success: false, error: 'Missing token or photo' })
    }
    if (!key.startsWith('patient-photos/')) {
      return res.status(400).json({ success: false, error: 'Invalid photo key' })
    }

    // Fetch image from S3 and convert to base64 data URL for the existing RPC.
    const { bucket } = getS3Config()
    let photoDataUrl: string
    try {
      photoDataUrl = await s3KeyToDataUrl(bucket, key)
    } catch (err) {
      console.error('[patient-photo-capture] s3 fetch:', err)
      return res.status(500).json({ success: false, error: 'Failed to retrieve photo' })
    }

    const { data: ok, error } = await supabase.rpc('complete_patient_photo_capture', {
      p_token: t,
      p_photo_data: photoDataUrl,
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
