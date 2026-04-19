import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
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
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()
    if (userError || !user?.email) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { patientId } = req.body as { patientId?: string | null }
    const patientIdStr =
      patientId != null && typeof patientId === 'string' && patientId.trim() !== '' ? patientId.trim() : null

    const { data: profile } = await supabase.from('user_profiles').select('id').eq('id', user.id).single()
    if (!profile) {
      return res.status(403).json({ error: 'Profile not found' })
    }

    let patientNameForEmail = 'New patient'
    if (patientIdStr) {
      const { data: patientRow, error: patientErr } = await supabase
        .from('patients')
        .select('id, patient_name')
        .eq('id', patientIdStr)
        .maybeSingle()

      if (patientErr || !patientRow) {
        return res.status(403).json({ error: 'Patient not found or access denied' })
      }
      patientNameForEmail = String(patientRow.patient_name || 'Patient')
    }

    if (patientIdStr) {
      await supabase
        .from('patient_photo_capture_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('patient_id', patientIdStr)
    } else {
      await supabase.from('patient_photo_capture_tokens').delete().eq('user_id', user.id).is('patient_id', null)
    }

    const setupToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabase.from('patient_photo_capture_tokens').insert({
      user_id: user.id,
      patient_id: patientIdStr,
      token: setupToken,
      expires_at: expiresAt,
    })

    if (insertError) {
      console.error('[send-patient-photo-capture-email] insert token:', insertError)
      return res.status(500).json({ error: 'Failed to create capture link' })
    }

    const isLocal = (req.headers.host || '').includes('localhost')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : isLocal
        ? `http://${req.headers.host || 'localhost:3000'}`
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
          (req.headers.host ? `https://${req.headers.host}` : '')

    const setupUrl = `${baseUrl}/auth/patient-photo-capture?token=${encodeURIComponent(setupToken)}`

    if (!process.env.RESEND_API_KEY) {
      return res.status(503).json({
        error: 'Email sending is not configured. Set RESEND_API_KEY in your environment.',
        code: 'RESEND_NOT_CONFIGURED',
      })
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
    const safeName = String(patientNameForEmail || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
    const subject = patientIdStr
      ? `Patient photo — ${patientNameForEmail}`
      : 'Patient photo — open link on your phone'
    const { error: sendError } = await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject,
      html: `
        <p>You requested to take or update a <strong>patient photo</strong> for Lasso.</p>
        <p><strong>Open this link on your phone</strong> to use the camera. The page will ask for camera permission, show a framing guide, then let you confirm or retake.</p>
        <p>Patient: <strong>${safeName}</strong></p>
        <p>This link is valid for ${TOKEN_EXPIRY_HOURS} hours and can only be used once.</p>
        <p><a href="${setupUrl}" style="display:inline-block; padding:12px 24px; background:#0d9488; color:#fff; text-decoration:none; border-radius:6px;">Open on phone</a></p>
        <p>Or copy:</p>
        <p style="word-break:break-all;">${setupUrl}</p>
        <p>If you didn't request this, you can ignore this email.</p>
      `,
    })

    if (sendError) {
      console.error('[send-patient-photo-capture-email] Resend error:', sendError)
      return res.status(500).json({ error: sendError.message || 'Failed to send email' })
    }

    return res.status(200).json({
      success: true,
      message: patientIdStr
        ? 'Email sent. Open the link on your phone to capture the patient photo.'
        : 'Email sent. After you confirm the photo on your phone, return here and tap the same teal button again (it will say Add here).',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    console.error('[send-patient-photo-capture-email]', err)
    return res.status(500).json({ error: message })
  }
}
