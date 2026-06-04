import type { NextApiRequest, NextApiResponse } from 'next'
import getConfig from 'next/config'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { serverRuntimeConfig } = getConfig() || {}

  const serviceRoleKey = serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const rdsConnString = serverRuntimeConfig?.RDS_CONNECTION_STRING || process.env.RDS_CONNECTION_STRING

  res.status(200).json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `SET (starts with: ${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 20)}...)`
      : 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey
      ? `SET (length: ${serviceRoleKey.length})`
      : 'NOT SET',
    RDS_CONNECTION_STRING: rdsConnString
      ? `SET (length: ${rdsConnString.length})`
      : 'NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `SET (length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})`
      : 'NOT SET',
    source: {
      serviceRoleKey_from_serverRuntimeConfig: !!serverRuntimeConfig?.SUPABASE_SERVICE_ROLE_KEY,
      serviceRoleKey_from_processEnv: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      rds_from_serverRuntimeConfig: !!serverRuntimeConfig?.RDS_CONNECTION_STRING,
      rds_from_processEnv: !!process.env.RDS_CONNECTION_STRING,
    }
  })
}
