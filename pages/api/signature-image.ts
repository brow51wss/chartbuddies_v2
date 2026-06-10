import type { NextApiRequest, NextApiResponse } from 'next'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = typeof req.query.key === 'string' ? req.query.key : ''
  if (!key || !key.startsWith('signatures/')) {
    return res.status(400).json({ error: 'Invalid key' })
  }

  try {
    const { bucket } = getS3Config()
    const s3 = createS3Client()
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    res.setHeader('Cache-Control', 'public, max-age=3300, s-maxage=3300')
    return res.redirect(302, url)
  } catch (err) {
    console.error('[signature-image] failed to generate signed URL:', err)
    return res.status(500).json({ error: 'Could not load signature image' })
  }
}
