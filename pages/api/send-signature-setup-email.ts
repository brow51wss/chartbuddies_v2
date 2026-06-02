import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getFromEmail } from '../../lib/ses'
import { buildEmailHtml } from '../../lib/emailTemplate'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TOKEN_EXPIRY_HOURS = 24

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const authHeader = req.headers.authorization
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' })
    }

    const setupToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase
      .from('signature_setup_tokens')
      .insert({
        user_id: user.id,
        token: setupToken,
        expires_at: expiresAt
      })

    if (insertError) {
      console.error('[send-signature-setup-email] insert token:', insertError.code, insertError.message)
      return res.status(500).json({ error: 'Failed to create setup link' })
    }

    // Use NEXT_PUBLIC_APP_URL when set (e.g. ngrok URL for testing on phone); otherwise localhost or deployed host
    const isLocal = (req.headers.host || '').includes('localhost')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : isLocal
        ? `http://${req.headers.host || 'localhost:3000'}`
        : (req.headers.host ? `https://${req.headers.host}` : '')
    const setupUrl = `${baseUrl}/auth/signature-setup?token=${encodeURIComponent(setupToken)}`

    const fromEmail = getFromEmail()
    const subject = 'Set your signature and initials (use a mobile device or tablet)'

    await sendEmail({
      from: fromEmail,
      to: user.email,
      subject,
      html: buildEmailHtml({
        preheader: 'Set up your signature and initials for Lasso — open on your phone or tablet',
        heading: 'Set up your signature & initials',
        paragraphs: [
          'You requested to create or update your signature and initials for Lasso.',
          '<strong>Open this link on your phone or tablet</strong> — do not use a desktop computer. You will draw your signature and initials directly on the screen.',
          `This link is valid for ${TOKEN_EXPIRY_HOURS} hours and can only be used once.`,
        ],
        buttonText: 'Open on phone or tablet',
        buttonUrl: setupUrl,
        footerNote: "If you didn't request this, you can safely ignore this email.",
      }),
    })

    return res.status(200).json({ success: true, message: 'Email sent. Use the link on your phone or tablet to draw your signature and initials.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    console.error('[send-signature-setup-email]', message)
    return res.status(500).json({ error: message })
  }
}
