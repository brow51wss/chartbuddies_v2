import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

async function getFormHospitalId(formId: string): Promise<string | null> {
  const { rows } = await rdsQuery('SELECT hospital_id FROM mar_forms WHERE id = $1', [formId])
  return rows[0]?.hospital_id ?? null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — vital signs for a MAR form
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { mar_form_id } = req.query
      if (!mar_form_id) return res.status(400).json({ error: 'mar_form_id required' })

      const hospitalId = await getFormHospitalId(mar_form_id as string)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        'SELECT * FROM mar_vital_signs WHERE mar_form_id = $1 ORDER BY day_number ASC',
        [mar_form_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — upsert vital signs row (upsert by form + day_number)
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { mar_form_id, day_number } = body
      if (!mar_form_id || day_number == null) {
        return res.status(400).json({ error: 'mar_form_id and day_number required' })
      }

      const hospitalId = await getFormHospitalId(mar_form_id)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        `INSERT INTO mar_vital_signs (
           mar_form_id, day_number,
           temperature, pulse, respiration, weight,
           systolic_bp, diastolic_bp, bowel_movement
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (mar_form_id, day_number)
         DO UPDATE SET
           temperature    = EXCLUDED.temperature,
           pulse          = EXCLUDED.pulse,
           respiration    = EXCLUDED.respiration,
           weight         = EXCLUDED.weight,
           systolic_bp    = EXCLUDED.systolic_bp,
           diastolic_bp   = EXCLUDED.diastolic_bp,
           bowel_movement = EXCLUDED.bowel_movement,
           updated_at     = NOW()
         RETURNING *`,
        [
          mar_form_id, day_number,
          body.temperature ?? null, body.pulse ?? null,
          body.respiration ?? null, body.weight ?? null,
          body.systolic_bp ?? null, body.diastolic_bp ?? null,
          body.bowel_movement ?? null,
        ],
      )
      return res.status(200).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/vital-signs]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
