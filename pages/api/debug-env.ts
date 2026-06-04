import type { NextApiRequest, NextApiResponse } from 'next'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `SET (starts with: ${process.env.NEXT_PUBLIC_SUPABASE_URL.slice(0, 20)}...)`
      : 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `SET (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})`
      : 'NOT SET',
    RDS_CONNECTION_STRING: process.env.RDS_CONNECTION_STRING
      ? `SET (length: ${process.env.RDS_CONNECTION_STRING.length})`
      : 'NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? `SET (length: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length})`
      : 'NOT SET',
  })
}
