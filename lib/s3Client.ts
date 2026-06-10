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
 * Uses explicit credentials from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env vars
 * when present (required for Amplify deployments where the Lambda execution role
 * may only have PutObject but not GetObject). Falls back to the default credential
 * chain (instance role, ECS task role, etc.) if the vars are not set.
 */
export function createS3Client(region?: string): S3Client {
  const { region: defaultRegion } = getS3Config()
  const resolvedRegion = region || defaultRegion

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (accessKeyId && secretAccessKey) {
    return new S3Client({
      region: resolvedRegion,
      credentials: { accessKeyId, secretAccessKey },
    })
  }

  return new S3Client({ region: resolvedRegion })
}
