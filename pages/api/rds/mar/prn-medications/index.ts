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
    // GET
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { mar_form_id } = req.query
      if (!mar_form_id) return res.status(400).json({ error: 'mar_form_id required' })
      const hospitalId = await getFormHospitalId(mar_form_id as string)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })
      const { rows } = await rdsQuery(
        'SELECT * FROM mar_prn_medications WHERE mar_form_id = $1 ORDER BY created_at ASC',
        [mar_form_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — add PRN medication
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { mar_form_id, medication, reason } = body
      if (!mar_form_id || !medication || !reason) {
        return res.status(400).json({ error: 'mar_form_id, medication, and reason required' })
      }
      const hospitalId = await getFormHospitalId(mar_form_id)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })
      const { rows } = await rdsQuery(
        `INSERT INTO mar_prn_medications (mar_form_id, start_date, medication, dosage, reason, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [mar_form_id, body.start_date ?? 'CURRENT_DATE', medication, body.dosage ?? null, reason, caller.userId],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/prn-medications]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
