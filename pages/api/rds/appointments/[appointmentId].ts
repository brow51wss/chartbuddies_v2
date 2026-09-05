import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { appointmentId } = req.query as { appointmentId: string }

    const { rows: existing } = await rdsQuery(
      `SELECT a.*, p.hospital_id FROM patient_appointments a
       JOIN patients p ON p.id = a.patient_id WHERE a.id = $1`,
      [appointmentId],
    )
    if (!existing[0]) return res.status(404).json({ error: 'Appointment not found' })
    if (!callerCanAccessHospital(caller, existing[0].hospital_id)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.method === 'DELETE') {
      if (caller.role !== 'superadmin' && caller.role !== 'head_nurse') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await rdsQuery('DELETE FROM patient_appointments WHERE id = $1', [appointmentId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    if (err.message?.includes('Forbidden')) return res.status(403).json({ error: err.message })
    if (err.message?.includes('token')) return res.status(401).json({ error: err.message })
    console.error('[/api/rds/appointments/[appointmentId]]', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
