import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Service role client — used ONLY to look up the user's email from user_profiles.
// Email is never returned to the client. Auth happens here and session tokens are returned.
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Auth client (anon key) — used to call signInWithPassword so the standard
// Supabase session lifecycle is respected.
const authClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { user_profile_id, password } = req.body as {
    user_profile_id?: string
    password?: string
  }

  if (!user_profile_id || !password?.trim()) {
    return res.status(400).json({ error: 'user_profile_id and password are required' })
  }

  // Fetch email server-side — never sent to the client
  const { data: profile, error: profileError } = await adminClient
    .from('user_profiles')
    .select('email, is_active, role')
    .eq('id', user_profile_id)
    .single()

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (!profile.is_active) {
    return res.status(403).json({ error: 'Account is inactive. Contact your administrator.' })
  }

  // Block superadmins from using this flow — they must use /auth/login
  if (profile.role === 'superadmin') {
    return res.status(403).json({ error: 'Please use the administrator login.' })
  }

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: profile.email,
    password,
  })

  if (authError || !authData.session) {
    return res.status(401).json({ error: 'Incorrect password. Please try again.' })
  }

  // Return session tokens — client calls supabase.auth.setSession() with these
  return res.status(200).json({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  })
}
