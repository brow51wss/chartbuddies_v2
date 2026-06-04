import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — list MAR forms for a patient
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { patient_id } = req.query
      if (!patient_id) return res.status(400).json({ error: 'patient_id required' })

      // Verify patient belongs to caller's facility
      const { rows: patients } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [patient_id])
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { rows } = await rdsQuery(
        'SELECT * FROM mar_forms WHERE patient_id = $1 ORDER BY created_at DESC',
        [patient_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — create a new MAR form
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { patient_id, month_year } = body
      if (!patient_id || !month_year) {
        return res.status(400).json({ error: 'patient_id and month_year required' })
      }

      const { rows: patients } = await rdsQuery('SELECT * FROM patients WHERE id = $1', [patient_id])
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const p = patients[0]
      const { rows } = await rdsQuery(
        `INSERT INTO mar_forms (
          patient_id, hospital_id, month_year, status,
          patient_name, record_number, date_of_birth, sex,
          diagnosis, diet, allergies, physician_name, physician_phone, facility_name,
          vital_signs_instructions, comments, mar_chart_row_order, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
        ) RETURNING *`,
        [
          patient_id, p.hospital_id, month_year, body.status ?? 'draft',
          p.patient_name, p.record_number, p.date_of_birth, p.sex,
          p.diagnosis ?? null, p.diet ?? null, p.allergies ?? '',
          p.physician_name, p.physician_phone ?? null, p.facility_name ?? null,
          body.vital_signs_instructions ?? null, body.comments ?? null,
          body.mar_chart_row_order ?? null,
          caller.userId,
        ],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/forms]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
