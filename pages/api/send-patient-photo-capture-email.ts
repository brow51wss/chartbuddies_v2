import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, getFromEmail } from '../../lib/ses'
import { buildEmailHtml } from '../../lib/emailTemplate'
import { rdsQuery } from '../../lib/rds'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const TOKEN_EXPIRY_HOURS = 24

/** Masks a patient name for safe use in emails.
 *  Each word keeps only its first letter; the rest become asterisks.
 *  e.g. "Bobby S Drake" → "B**** S D****"
 */
function maskPatientName(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map(word => word.length <= 1 ? word : word[0] + '*'.repeat(word.length - 1))
    .join(' ')
}

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
      const { rows } = await rdsQuery(
        'SELECT id, patient_name FROM patients WHERE id = $1',
        [patientIdStr]
      )
      if (!rows[0]) {
        return res.status(403).json({ error: 'Patient not found or access denied' })
      }
      patientNameForEmail = String(rows[0].patient_name || 'Patient')
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
      console.error('[send-patient-photo-capture-email] insert token:', insertError.code, insertError.message)
      return res.status(500).json({ error: 'Failed to create capture link' })
    }

    const isLocal = (req.headers.host || '').includes('localhost')
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      ? process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
      : isLocal
        ? `http://${req.headers.host || 'localhost:3000'}`
        : (req.headers.host ? `https://${req.headers.host}` : '')

    const setupUrl = `${baseUrl}/auth/patient-photo-capture?token=${encodeURIComponent(setupToken)}`

    const fromEmail = getFromEmail()
    const maskedName = patientIdStr ? maskPatientName(patientNameForEmail) : ''
    const safeMaskedName = maskedName
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
    const subject = patientIdStr
      ? `Patient photo — ${maskedName}`
      : 'Patient photo — open link on your phone'

    await sendEmail({
      from: fromEmail,
      to: user.email,
      subject,
      html: buildEmailHtml({
        preheader: `Open on your phone to take a patient photo`,
        heading: patientIdStr ? `Patient photo — ${safeMaskedName}` : 'Take a patient photo',
        paragraphs: [
          `You requested to take or update a patient photo${patientIdStr ? ` for <strong>${safeMaskedName}</strong>` : ''}.`,
          '<strong>Open this link on your phone</strong> and tap "Open camera." The photo will be saved automatically once you confirm.',
          `This link is valid for ${TOKEN_EXPIRY_HOURS} hours and can only be used once.`,
        ],
        buttonText: 'Open on phone',
        buttonUrl: setupUrl,
        footerNote: "If you didn't request this, you can safely ignore this email.",
      }),
    })

    return res.status(200).json({
      success: true,
      message: patientIdStr
        ? 'Email sent. Open the link on your phone to capture the patient photo.'
        : 'Email sent. After you confirm the photo on your phone, return here and tap the same teal button again (it will say Add here).',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    console.error('[send-patient-photo-capture-email]', message)
    return res.status(500).json({ error: message })
  }
}
