import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { medId } = req.query as { medId: string }

    const { rows: meds } = await rdsQuery(
      `SELECT m.*, f.hospital_id
       FROM mar_medications m
       JOIN mar_forms f ON f.id = m.mar_form_id
       WHERE m.id = $1`,
      [medId],
    )
    if (!meds[0]) return res.status(404).json({ error: 'Medication not found' })
    if (!callerCanAccessHospital(caller, meds[0].hospital_id)) return res.status(403).json({ error: 'Forbidden' })

    // -------------------------------------------------------------------------
    // GET
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      return res.status(200).json(meds[0])
    }

    // -------------------------------------------------------------------------
    // PATCH
    // -------------------------------------------------------------------------
    if (req.method === 'PATCH') {
      const body = req.body as Record<string, any>
      const allowed = ['medication_name','dosage','start_date','stop_date','hour',
        'notes','parameter','route','frequency','frequency_display','display_order']
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const key of allowed) {
        if (key in body) { sets.push(`${key} = $${idx++}`); params.push(body[key]) }
      }
      if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
      params.push(medId)
      const { rows } = await rdsQuery(
        `UPDATE mar_medications SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    // -------------------------------------------------------------------------
    // DELETE
    // -------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      await rdsQuery('DELETE FROM mar_medications WHERE id = $1', [medId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/medications/[medId]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
