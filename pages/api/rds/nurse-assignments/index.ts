import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — list assignments by nurse_id or patient_id
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { nurse_id, patient_id } = req.query as Record<string, string>

      if (patient_id) {
        const { rows: patients } = await rdsQuery(
          'SELECT hospital_id FROM patients WHERE id = $1',
          [patient_id],
        )
        if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
        if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        const { rows } = await rdsQuery(
          'SELECT * FROM nurse_patient_assignments WHERE patient_id = $1 ORDER BY assigned_at DESC',
          [patient_id],
        )
        return res.status(200).json(rows)
      }

      if (nurse_id) {
        const { rows } = await rdsQuery(
          'SELECT * FROM nurse_patient_assignments WHERE nurse_id = $1 ORDER BY assigned_at DESC',
          [nurse_id],
        )
        return res.status(200).json(rows)
      }

      return res.status(400).json({ error: 'nurse_id or patient_id query param required' })
    }

    // -------------------------------------------------------------------------
    // POST — create assignment
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const { nurse_id, patient_id, assigned_by, is_active = true } = req.body as Record<string, any>

      if (!nurse_id || !patient_id || !assigned_by) {
        return res.status(400).json({ error: 'nurse_id, patient_id, and assigned_by are required' })
      }

      const { rows: patients } = await rdsQuery(
        'SELECT hospital_id FROM patients WHERE id = $1',
        [patient_id],
      )
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { rows } = await rdsQuery(
        `INSERT INTO nurse_patient_assignments (nurse_id, patient_id, assigned_by, is_active)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (nurse_id, patient_id) DO UPDATE SET is_active = EXCLUDED.is_active, assigned_at = NOW()
         RETURNING *`,
        [nurse_id, patient_id, assigned_by, is_active],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/nurse-assignments]', err)
    return res
      .status(err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
