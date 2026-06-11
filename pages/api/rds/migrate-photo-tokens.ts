import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery } from '../../../lib/rds'

// One-time migration: creates patient_photo_capture_tokens in RDS.
// Protected by a static secret passed as ?secret=... in the URL.
// Delete this file after the migration has been confirmed.
const MIGRATION_SECRET = 'lasso-migrate-photo-tokens-2026'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.query.secret !== MIGRATION_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    await rdsQuery(`
      CREATE TABLE IF NOT EXISTS patient_photo_capture_tokens (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT        NOT NULL,
        patient_id  UUID,
        token       TEXT        NOT NULL UNIQUE,
        expires_at  TIMESTAMPTZ NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await rdsQuery(`
      CREATE INDEX IF NOT EXISTS idx_ppc_tokens_token
        ON patient_photo_capture_tokens(token)
    `)

    await rdsQuery(`
      CREATE INDEX IF NOT EXISTS idx_ppc_tokens_user_patient
        ON patient_photo_capture_tokens(user_id, patient_id)
    `)

    return res.status(200).json({ success: true, message: 'patient_photo_capture_tokens table ready in RDS.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[migrate-photo-tokens]', msg)
    return res.status(500).json({ success: false, error: msg })
  }
}
