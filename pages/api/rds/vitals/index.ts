import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'
import { parseLocalDateFromYMD, ymdFromDateInput } from '../../../../lib/calendarDate'

function isValidRecordedAt(raw: unknown): boolean {
  if (typeof raw !== 'string' || !raw.trim()) return false
  const value = raw.trim()
  const looksDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (looksDateOnly) return parseLocalDateFromYMD(ymdFromDateInput(value)) != null
  return !Number.isNaN(new Date(value).getTime())
}

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
        `SELECT * FROM patient_vitals WHERE patient_id = $1 ORDER BY recorded_at DESC`,
        [patient_id],
      )
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { patient_id, recorded_at } = body
      if (!patient_id || !recorded_at) {
        return res.status(400).json({ error: 'patient_id and recorded_at required' })
      }
      if (!isValidRecordedAt(recorded_at)) {
        return res.status(400).json({ error: 'Invalid recorded_at' })
      }
      const hospitalId = await getPatientHospitalId(patient_id)
      if (!hospitalId) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      const { rows } = await rdsQuery(
        `INSERT INTO patient_vitals (
           patient_id, recorded_at, bp, heart_rate, temperature, weight, initials, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          patient_id,
          recorded_at,
          body.bp?.trim() || null,
          body.heart_rate?.trim() || null,
          body.temperature?.trim() || null,
          body.weight?.trim() || null,
          body.initials?.trim() || null,
          caller.userId,
        ],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    if (err.message?.includes('Forbidden')) return res.status(403).json({ error: err.message })
    if (err.message?.includes('token')) return res.status(401).json({ error: err.message })
    console.error('[/api/rds/vitals]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
