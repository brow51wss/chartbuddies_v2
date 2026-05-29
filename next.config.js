/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    // The EHR app subdomain — hardcoded because it's a non-secret, stable value.
    // Used by the marketing homepage to point login/signup buttons at the correct domain.
    NEXT_PUBLIC_APP_URL: 'https://app.lasso-app.com',
  },
}

module.exports = nextConfig
