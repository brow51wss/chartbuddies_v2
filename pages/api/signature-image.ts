import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import getConfig from 'next/config'

function getS3Config() {
  try {
    const { serverRuntimeConfig } = getConfig() || {}
    return {
      bucket: serverRuntimeConfig?.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'chartbuddies-signatures-prod',
      region: serverRuntimeConfig?.AWS_S3_REGION || process.env.AWS_S3_REGION || 'us-east-2',
    }
  } catch {
    return {
      bucket: process.env.S3_BUCKET_NAME || 'chartbuddies-signatures-prod',
      region: process.env.AWS_S3_REGION || 'us-east-2',
    }
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = typeof req.query.key === 'string' ? req.query.key : ''
  if (!key || !key.startsWith('signatures/')) {
    return res.status(400).json({ error: 'Invalid key' })
  }

  try {
    const { bucket, region } = getS3Config()
    const s3 = new S3Client({ region })
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    res.setHeader('Cache-Control', 'public, max-age=3300, s-maxage=3300')
    return res.redirect(302, url)
  } catch (err) {
    console.error('[signature-image] failed to generate signed URL:', err)
    return res.status(500).json({ error: 'Could not load signature image' })
  }
}
