import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getFromEmail } from '../../lib/ses'
import { buildEmailHtml } from '../../lib/emailTemplate'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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

    const { inviteId, code, email, facilityName, designation } = req.body as {
      inviteId?: string
      code?: string
      email?: string
      facilityName?: string
      designation?: string
    }

    if (!inviteId || !code || !email?.trim() || !facilityName) {
      return res.status(400).json({ error: 'Missing inviteId, code, email, or facilityName' })
    }

    const designationLabel = designation === 'PCG' ? 'Primary Care Giver' : 'Secondary Care Giver'

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: invite, error: fetchError } = await supabase
      .from('facility_invites')
      .select('id, used_by')
      .eq('id', inviteId)
      .single()

    if (fetchError || !invite) {
      return res.status(404).json({ error: 'Invite not found or access denied' })
    }
    if (invite.used_by) {
      return res.status(400).json({ error: 'This invite has already been used' })
    }

    const { error: updateError } = await supabase
      .from('facility_invites')
      .update({
        invited_email: email.trim().toLowerCase(),
        invited_at: new Date().toISOString()
      })
      .eq('id', inviteId)

    if (updateError) {
      return res.status(500).json({ error: 'Failed to record invite' })
    }

    const isLocal = (req.headers.host || '').includes('localhost')
    let baseUrl: string
    if (isLocal) {
      baseUrl = `http://${req.headers.host || 'localhost:3000'}`
    } else {
      baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (req.headers.host ? `https://${req.headers.host}` : '')
    }
    const signupUrl = `${baseUrl}/auth/signup?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email.trim())}`

    const fromEmail = getFromEmail()

    await sendEmail({
      from: fromEmail,
      to: email.trim(),
      subject: `You've been invited to join ${facilityName}`,
      html: buildEmailHtml({
        preheader: `Join ${facilityName} as ${designationLabel} on Lasso`,
        heading: `You're invited to join ${facilityName}`,
        paragraphs: [
          `You've been invited to join <strong>${facilityName}</strong> as a <strong>${designationLabel}</strong>.`,
          `Click the button below to complete your sign-up. Your email address and invite code will be pre-filled.`,
          `Your invite code is: <strong>${code}</strong>`,
        ],
        buttonText: 'Complete sign-up',
        buttonUrl: signupUrl,
        footerNote: "If you weren't expecting this invitation, you can safely ignore this email.",
      }),
    })

    return res.status(200).json({ success: true, message: 'Invite sent.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send invite'
    console.error('[send-invite-email]', message)
    return res.status(500).json({ error: message })
  }
}
