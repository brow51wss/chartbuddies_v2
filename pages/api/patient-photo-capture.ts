import type { NextApiRequest, NextApiResponse } from 'next'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'
import { rdsQuery } from '../../lib/rds'

function maskPatientName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map(word => word.length <= 1 ? word : word[0] + '*'.repeat(word.length - 1))
    .join(' ')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const token = typeof req.query.token === 'string' ? req.query.token.trim() : ''
    if (!token) {
      return res.status(400).json({ valid: false, error: 'Missing token' })
    }

    const { rows } = await rdsQuery(
      `SELECT t.patient_id, t.expires_at, p.patient_name
       FROM patient_photo_capture_tokens t
       LEFT JOIN patients p ON p.id = t.patient_id
       WHERE t.token = $1`,
      [token]
    )
    const row = rows[0]
    if (!row || new Date(row.expires_at) < new Date()) {
      return res.status(200).json({ valid: false })
    }

    const { bucket } = getS3Config()
    const key = `patient-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
    const s3 = createS3Client()
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }),
      { expiresIn: 600 }
    )

    const rawName: string = row.patient_name || ''
    const displayName = rawName ? maskPatientName(rawName) : 'Patient'

    return res.status(200).json({
      valid: true,
      patientId: row.patient_id,
      patientName: displayName,
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

    // Validate token in RDS
    const { rows: tokenRows } = await rdsQuery(
      'SELECT patient_id, expires_at FROM patient_photo_capture_tokens WHERE token = $1',
      [t]
    )
    const tokenRow = tokenRows[0]
    if (!tokenRow || new Date(tokenRow.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'Link expired or invalid' })
    }
    const patientId = tokenRow.patient_id

    // Store the S3 key reference (never download the image through Lambda)
    try {
      await rdsQuery('UPDATE patients SET patient_photo = $1 WHERE id = $2', [`s3:${key}`, patientId])
      await rdsQuery('DELETE FROM patient_photo_capture_tokens WHERE token = $1', [t])
    } catch (err) {
      console.error('[patient-photo-capture] rds update:', err)
      return res.status(500).json({ success: false, error: 'Failed to save photo' })
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
