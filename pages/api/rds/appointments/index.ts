import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'
import { ymdFromDateInput } from '../../../../lib/calendarDate'

async function getPatientHospitalId(patientId: string): Promise<string | null> {
  const { rows } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [patientId])
  return rows[0]?.hospital_id ?? null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    if (req.method === 'GET') {
      const { patient_id } = req.query
      if (!patient_id) return res.status(400).json({ error: 'patient_id required' })
      const hospitalId = await getPatientHospitalId(patient_id as string)
      if (!hospitalId) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        `SELECT * FROM patient_appointments
         WHERE patient_id = $1
         ORDER BY appointment_date ASC, appointment_time ASC NULLS LAST, created_at ASC`,
        [patient_id],
      )
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const title = String(body.title || '').trim()
      const appointmentDate = ymdFromDateInput(body.appointment_date)
      if (!body.patient_id || !title || !appointmentDate) {
        return res.status(400).json({ error: 'patient_id, title, and appointment_date required' })
      }
      const hospitalId = await getPatientHospitalId(body.patient_id)
      if (!hospitalId) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const time = typeof body.appointment_time === 'string' && body.appointment_time.trim()
        ? body.appointment_time.trim()
        : null

      const { rows } = await rdsQuery(
        `INSERT INTO patient_appointments (
           patient_id, appointment_date, appointment_time, title, location, notes, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          body.patient_id,
          appointmentDate,
          time,
          title,
          String(body.location || '').trim() || null,
          String(body.notes || '').trim() || null,
          caller.userId,
        ],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    if (err.message?.includes('Forbidden')) return res.status(403).json({ error: err.message })
    if (err.message?.includes('token')) return res.status(401).json({ error: err.message })
    console.error('[/api/rds/appointments]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
