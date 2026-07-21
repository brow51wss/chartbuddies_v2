import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { prnRecordId } = req.query as { prnRecordId: string }

    const { rows: rows0 } = await rdsQuery(
      `SELECT pr.*, f.hospital_id FROM mar_prn_records pr
       JOIN mar_forms f ON f.id = pr.mar_form_id WHERE pr.id = $1`,
      [prnRecordId],
    )
    if (!rows0[0]) return res.status(404).json({ error: 'PRN record not found' })
    if (!callerCanAccessHospital(caller, rows0[0].hospital_id)) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      return res.status(200).json(rows0[0])
    }

    if (req.method === 'PATCH') {
      const body = req.body as Record<string, any>
      const allowed = ['date','hour','initials','medication','dosage','reason',
        'result','staff_signature','note','signed_by','start_date']
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const key of allowed) {
        if (key in body) { sets.push(`${key} = $${idx++}`); params.push(body[key]) }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' })
      params.push(prnRecordId)
      const { rows } = await rdsQuery(
        `UPDATE mar_prn_records SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      // Delete linked progress notes first to avoid orphaned entries in Progress Notes
      await rdsQuery(
        'DELETE FROM progress_note_entries WHERE source_mar_prn_record_id = $1',
        [prnRecordId],
      )
      await rdsQuery('DELETE FROM mar_prn_records WHERE id = $1', [prnRecordId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/prn-records/[prnRecordId]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
