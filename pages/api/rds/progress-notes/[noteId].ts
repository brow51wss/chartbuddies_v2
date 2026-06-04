import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { noteId } = req.query as { noteId: string }

    const { rows: notes } = await rdsQuery(
      `SELECT pn.*, p.hospital_id FROM progress_note_entries pn
       JOIN patients p ON p.id = pn.patient_id WHERE pn.id = $1`,
      [noteId],
    )
    if (!notes[0]) return res.status(404).json({ error: 'Progress note not found' })
    if (!callerCanAccessHospital(caller, notes[0].hospital_id)) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'GET') {
      return res.status(200).json(notes[0])
    }

    if (req.method === 'PATCH') {
      const body = req.body as Record<string, any>
      const allowed = ['note_date','notes','signature','physician_name','is_addendum']
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const key of allowed) {
        if (key in body) { sets.push(`${key} = $${idx++}`); params.push(body[key]) }
      }
      if (!sets.length) return res.status(400).json({ error: 'No fields to update' })
      params.push(noteId)
      const { rows } = await rdsQuery(
        `UPDATE progress_note_entries SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    if (req.method === 'DELETE') {
      if (caller.role !== 'superadmin' && caller.role !== 'head_nurse') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await rdsQuery('DELETE FROM progress_note_entries WHERE id = $1', [noteId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/progress-notes/[noteId]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
