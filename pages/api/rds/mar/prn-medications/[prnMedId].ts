import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { prnMedId } = req.query as { prnMedId: string }

    const { rows: rows0 } = await rdsQuery(
      `SELECT pm.*, f.hospital_id FROM mar_prn_medications pm
       JOIN mar_forms f ON f.id = pm.mar_form_id WHERE pm.id = $1`,
      [prnMedId],
    )
    if (!rows0[0]) return res.status(404).json({ error: 'PRN medication not found' })
    if (!callerCanAccessHospital(caller, rows0[0].hospital_id)) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'PATCH') {
      const body = req.body as Record<string, any>
      const allowed = ['start_date','medication','dosage','reason']
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const key of allowed) {
        if (key in body) { sets.push(`${key} = $${idx++}`); params.push(body[key]) }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' })
      params.push(prnMedId)
      const { rows } = await rdsQuery(
        `UPDATE mar_prn_medications SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      await rdsQuery('DELETE FROM mar_prn_medications WHERE id = $1', [prnMedId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/prn-medications/[prnMedId]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
