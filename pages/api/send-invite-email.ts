import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
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

  let baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || (req.headers.host ? `https://${req.headers.host}` : '')
  if (baseUrl && (req.headers.host || '').includes('localhost')) {
    baseUrl = baseUrl.replace(/^https:\/\//, 'http://')
  }
  const signupUrl = `${baseUrl}/auth/signup?code=${encodeURIComponent(code)}&email=${encodeURIComponent(email.trim())}`

  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({
      error: 'Email sending is not configured. Set RESEND_API_KEY in your environment (see https://resend.com).',
      code: 'RESEND_NOT_CONFIGURED'
    })
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
  const { data: sendData, error: sendError } = await resend.emails.send({
    from: fromEmail,
    to: email.trim(),
    subject: `Join ${facilityName} as ${designationLabel}`,
    html: `
      <p>You've been invited to join <strong>${facilityName}</strong> as <strong>${designationLabel}</strong>.</p>
      <p>Use the link below to complete your signup. Your email and invite code will be pre-filled.</p>
      <p><a href="${signupUrl}" style="display:inline-block; padding:10px 20px; background:#0d9488; color:#fff; text-decoration:none; border-radius:6px;">Complete signup</a></p>
      <p>Or copy this link: ${signupUrl}</p>
      <p>Invite code: <strong>${code}</strong></p>
      <p>If you didn't expect this invite, you can ignore this email.</p>
    `
  })

  if (sendError) {
    const message = sendError.message || 'Failed to send email'
    console.error('[send-invite-email] Resend error:', sendError)
    return res.status(500).json({ error: message })
  }

  return res.status(200).json({ success: true, message: 'Invite sent.', id: sendData?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send invite'
    console.error('[send-invite-email]', err)
    return res.status(500).json({ error: message })
  }
}
