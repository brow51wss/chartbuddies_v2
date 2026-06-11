import { S3Client } from '@aws-sdk/client-s3'
import getConfig from 'next/config'

export function getS3Config(): { bucket: string; region: string } {
  try {
    const { serverRuntimeConfig } = getConfig() || {}
    return {
      bucket: serverRuntimeConfig?.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'chartbuddies-signatures-prod',
      region: serverRuntimeConfig?.AWS_S3_REGION || process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-2',
    }
  } catch {
    return {
      bucket: process.env.S3_BUCKET_NAME || 'chartbuddies-signatures-prod',
      region: process.env.AWS_S3_REGION || process.env.AWS_REGION || 'us-east-2',
    }
  }
}

/**
 * Returns an S3Client configured for the app's bucket region.
 *
 * Credential resolution order:
 * 1. If AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY are set AND there is no
 *    AWS_SESSION_TOKEN, treat them as long-term IAM user credentials and pass
 *    them explicitly (covers local dev via .env.local).
 * 2. Otherwise fall back to the SDK default credential chain, which correctly
 *    handles Lambda execution-role STS credentials (all three env vars including
 *    the session token) as well as instance profiles and ECS task roles.
 */
export function createS3Client(region?: string): S3Client {
  const { region: defaultRegion } = getS3Config()
  const resolvedRegion = region || defaultRegion

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const sessionToken = process.env.AWS_SESSION_TOKEN

  // Only use explicit credentials when they are long-term IAM user keys
  // (no session token). Lambda execution-role creds always carry a session
  // token — let the SDK default chain handle those so all three values are
  // picked up correctly.
  if (accessKeyId && secretAccessKey && !sessionToken) {
    return new S3Client({
      region: resolvedRegion,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  return new S3Client({ region: resolvedRegion })
}
