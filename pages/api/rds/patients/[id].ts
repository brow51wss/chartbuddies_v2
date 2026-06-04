import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { id } = req.query as { id: string }

    // -------------------------------------------------------------------------
    // GET — single patient
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { rows } = await rdsQuery('SELECT * FROM patients WHERE id = $1', [id])
      if (!rows[0]) return res.status(404).json({ error: 'Not found' })
      if (!callerCanAccessHospital(caller, rows[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      return res.status(200).json(rows[0])
    }

    // -------------------------------------------------------------------------
    // PATCH — update patient fields
    // -------------------------------------------------------------------------
    if (req.method === 'PATCH') {
      const { rows: existing } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [id])
      if (!existing[0]) return res.status(404).json({ error: 'Not found' })
      if (!callerCanAccessHospital(caller, existing[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const body = req.body as Record<string, any>
      const allowed = [
        'patient_name','record_number','date_of_birth','sex','diagnosis','diet',
        'allergies','physician_name','physician_phone','facility_name',
        'street_address','city','state','zip_code','home_phone','email',
        'admission_date','patient_photo','deleted_at',
      ]
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const key of allowed) {
        if (key in body) {
          sets.push(`${key} = $${idx++}`)
          params.push(body[key])
        }
      }
      if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
      params.push(id)
      const { rows } = await rdsQuery(
        `UPDATE patients SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )

      // Optionally sync demographic snapshot on all open MAR forms for this patient
      if (body.sync_mar_forms === true) {
        const marDemoKeys = ['patient_name','date_of_birth','sex','diagnosis','diet',
          'allergies','physician_name','physician_phone','facility_name']
        const marSets: string[] = []
        const marParams: any[] = []
        let mIdx = 1
        for (const key of marDemoKeys) {
          if (key in body) { marSets.push(`${key} = $${mIdx++}`); marParams.push(body[key]) }
        }
        if (marSets.length > 0) {
          marParams.push(id)
          await rdsQuery(
            `UPDATE mar_forms SET ${marSets.join(', ')}, updated_at = NOW() WHERE patient_id = $${mIdx}`,
            marParams,
          ).catch((e) => console.warn('[rds patients PATCH] mar_forms sync failed:', e.message))
        }
      }

      return res.status(200).json(rows[0])
    }

    // -------------------------------------------------------------------------
    // DELETE — hard delete (only used as fallback; prefer soft-delete via PATCH)
    // -------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      if (caller.role !== 'superadmin' && caller.role !== 'head_nurse') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const { rows: existing } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [id])
      if (!existing[0]) return res.status(404).json({ error: 'Not found' })
      if (!callerCanAccessHospital(caller, existing[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await rdsQuery('DELETE FROM patients WHERE id = $1', [id])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/patients/[id]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
