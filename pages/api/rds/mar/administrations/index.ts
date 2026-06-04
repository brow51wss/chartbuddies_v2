import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

async function getFormHospitalIdFromMed(medId: string): Promise<string | null> {
  const { rows } = await rdsQuery(
    `SELECT f.hospital_id FROM mar_medications m JOIN mar_forms f ON f.id = m.mar_form_id WHERE m.id = $1`,
    [medId],
  )
  return rows[0]?.hospital_id ?? null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — administrations for a medication
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { mar_medication_id } = req.query
      if (!mar_medication_id) return res.status(400).json({ error: 'mar_medication_id required' })

      const hospitalId = await getFormHospitalIdFromMed(mar_medication_id as string)
      if (!hospitalId) return res.status(404).json({ error: 'Medication not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        'SELECT * FROM mar_administrations WHERE mar_medication_id = $1 ORDER BY day_number ASC',
        [mar_medication_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — upsert administration (insert or update by medication + day)
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { mar_medication_id, day_number } = body
      if (!mar_medication_id || day_number == null) {
        return res.status(400).json({ error: 'mar_medication_id and day_number required' })
      }

      const hospitalId = await getFormHospitalIdFromMed(mar_medication_id)
      if (!hospitalId) return res.status(404).json({ error: 'Medication not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        `INSERT INTO mar_administrations (mar_medication_id, day_number, status, initials, notes, administered_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (mar_medication_id, day_number)
         DO UPDATE SET
           status = EXCLUDED.status,
           initials = EXCLUDED.initials,
           notes = EXCLUDED.notes,
           administered_at = EXCLUDED.administered_at,
           updated_at = NOW()
         RETURNING *`,
        [
          mar_medication_id, day_number,
          body.status ?? 'Not Given',
          body.initials ?? null,
          body.notes ?? null,
          body.administered_at ?? null,
        ],
      )
      return res.status(200).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/administrations]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
