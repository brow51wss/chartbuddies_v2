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
 * Credential resolution:
 * - If APP_AWS_ACCESS_KEY_ID + APP_AWS_SECRET_ACCESS_KEY are set, use them
 *   as explicit long-term IAM user credentials (works for both local dev and
 *   Amplify env vars without colliding with Lambda's auto-injected AWS_* vars).
 * - Otherwise fall through to the SDK default credential chain (Lambda
 *   execution role, instance profile, etc.).
 */
export function createS3Client(region?: string): S3Client {
  const { region: defaultRegion } = getS3Config()
  const resolvedRegion = region || defaultRegion

  const accessKeyId = process.env.APP_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.APP_AWS_SECRET_ACCESS_KEY

  if (accessKeyId && secretAccessKey) {
    return new S3Client({
      region: resolvedRegion,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  return new S3Client({ region: resolvedRegion })
}
