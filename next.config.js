/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // The EHR app subdomain — hardcoded because it's a non-secret, stable value.
    // Used by the marketing homepage to point login/signup buttons at the correct domain.
    NEXT_PUBLIC_APP_URL: 'https://app.lasso-app.com',
  },
  // Baked in at build time from Amplify's build environment (where env vars ARE available).
  // Available server-side only at runtime via getConfig().serverRuntimeConfig.
  serverRuntimeConfig: {
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || '',
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || 'chartbuddies-signatures-prod',
    AWS_S3_REGION: process.env.AWS_S3_REGION || 'us-east-2',
  },
}

module.exports = nextConfig
