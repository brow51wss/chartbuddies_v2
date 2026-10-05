import type { NextApiRequest, NextApiResponse } from 'next'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createS3Client, getS3Config } from '../../lib/s3Client'
import { requireBearerProfile } from '../../lib/supabaseAdmin'
import { rateLimit, rejectTooMany } from '../../lib/rate-limit'

/**
 * Returns a short-lived signed S3 URL for a signature / initials image.
 *
 * - Requires a valid login (Authorization: Bearer <supabase access token>).
 * - Only `signatures/<ownerUserId>/<file>.jpg` keys are served. Patient photos are
 *   retired and are intentionally NOT served by this endpoint.
 * - The caller must be the owner, a user in the same facility as the owner,
 *   or a platform admin (superadmin with no hospital).
 * - If the owner has no hospital (left the facility), any authenticated active
 *   user with a facility may read it, so historical signed records keep rendering.
 * - If the owner no longer exists in user_profiles, access is denied.
 * - Response is JSON `{ url }` (not a redirect) so the browser can send the
 *   Bearer token; the client then loads the signed URL directly into <img>.
 */
// Case-sensitive on purpose: our writers always produce lowercase `signatures/<uuid>/...`.
const SIGNATURE_KEY_RE = /^signatures\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/[A-Za-z0-9._-]+\.jpg$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await requireBearerProfile(req)
  if (!auth.ok) {
    return res.status(auth.error.status).json({ error: auth.error.message })
  }
  const { admin, profile } = auth

  // Per-user cap (the client caches resolved URLs, so normal use stays far below this).
  const limited = rateLimit(`signature-image:${profile.id}`, 300, 60_000)
  if (!limited.ok) return rejectTooMany(res, limited.retryAfterSec)

  const key = typeof req.query.key === 'string' ? req.query.key : ''
  const match = SIGNATURE_KEY_RE.exec(key)
  if (!match || key.includes('..')) {
    return res.status(400).json({ error: 'Invalid key' })
  }
  const ownerId = match[1].toLowerCase()

  const isOwner = profile.id.toLowerCase() === ownerId
  const isPlatformAdmin = profile.role === 'superadmin' && !profile.hospital_id

  if (!isOwner && !isPlatformAdmin) {
    // Caller must belong to the same facility as the signature owner.
    // Owner's is_active is deliberately NOT checked: historical signatures
    // on signed records must stay viewable after a user is deactivated.
    if (!profile.hospital_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const { data: owner, error: ownerError } = await admin
      .from('user_profiles')
      .select('hospital_id')
      .eq('id', ownerId)
      .maybeSingle()

    if (ownerError) {
      console.error('[signature-image] owner lookup failed:', ownerError)
      return res.status(500).json({ error: 'Could not load signature image' })
    }
    if (!owner) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    // Owner has no hospital (e.g. left the facility and hospital_id was cleared per the
    // user-data-retention rule): their historical signatures on signed records must stay
    // viewable, so any authenticated, active user may read them. Otherwise facility must match.
    if (owner.hospital_id && owner.hospital_id !== profile.hospital_id) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  }

  try {
    const { bucket } = getS3Config()
    const s3 = createS3Client()
    const command = new GetObjectCommand({ Bucket: bucket, Key: key })
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 })
    return res.status(200).json({ url })
  } catch (err) {
    console.error('[signature-image] failed to generate signed URL:', err)
    return res.status(500).json({ error: 'Could not load signature image' })
  }
}
