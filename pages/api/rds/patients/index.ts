import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — list patients for the caller's facility
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { includeDeleted } = req.query
      let sql: string
      let params: any[]

      if (caller.role === 'superadmin' && caller.hospitalId === null) {
        sql = `SELECT * FROM patients${includeDeleted ? '' : ' WHERE deleted_at IS NULL'} ORDER BY patient_name ASC`
        params = []
      } else {
        sql = `SELECT * FROM patients WHERE hospital_id = $1${includeDeleted ? '' : ' AND deleted_at IS NULL'} ORDER BY patient_name ASC`
        params = [caller.hospitalId]
      }

      const { rows } = await rdsQuery(sql, params)
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — create a new patient
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const hospitalId = body.hospital_id ?? caller.hospitalId
      if (!hospitalId) return res.status(400).json({ error: 'hospital_id required' })
      if (!callerCanAccessHospital(caller, hospitalId)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { rows } = await rdsQuery(
        `INSERT INTO patients (
          hospital_id, patient_name, record_number, date_of_birth, sex,
          diagnosis, diet, allergies, physician_name, physician_phone,
          facility_name, street_address, city, state, zip_code,
          home_phone, email, admission_date, patient_photo, created_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        ) RETURNING *`,
        [
          hospitalId, body.patient_name, body.record_number, body.date_of_birth, body.sex,
          body.diagnosis ?? null, body.diet ?? null, body.allergies ?? '',
          body.physician_name, body.physician_phone ?? null,
          body.facility_name ?? null, body.street_address ?? null,
          body.city ?? null, body.state ?? null, body.zip_code ?? null,
          body.home_phone ?? null, body.email ?? null,
          body.admission_date ?? null, body.patient_photo ?? null,
          caller.userId,
        ],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/patients]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
