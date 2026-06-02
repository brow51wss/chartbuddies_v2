import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getFromEmail } from '../../lib/ses'
import { buildEmailHtml } from '../../lib/emailTemplate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const authHeader = req.headers.authorization
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const fromEmail = getFromEmail()

    await sendEmail({
      from: fromEmail,
      to: user.email,
      subject: 'Your Lasso password was changed',
      html: buildEmailHtml({
        preheader: 'Your Lasso account password was just changed.',
        heading: 'Your password was changed',
        paragraphs: [
          `The password for your Lasso account (<strong>${user.email}</strong>) was just changed.`,
          'If you made this change, no further action is needed.',
          '<strong>If you did not change your password</strong>, your account may be compromised. Contact your administrator immediately and do not use your account until the issue is resolved.',
        ],
        footerNote: 'This is an automated security notification. Do not reply to this email.',
      }),
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send notification'
    console.error('[send-password-changed-email]', message)
    return res.status(500).json({ error: message })
  }
}
