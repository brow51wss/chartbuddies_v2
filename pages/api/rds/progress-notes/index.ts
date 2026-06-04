import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — list progress notes for a patient, or lookup by source_mar_prn_record_id
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { patient_id, include_addendums, source_mar_prn_record_id } = req.query

      // Lookup by source PRN record ID (used by MAR PRN → progress note sync)
      if (source_mar_prn_record_id) {
        const { rows } = await rdsQuery(
          `SELECT pn.*, p.hospital_id FROM progress_note_entries pn
           JOIN patients p ON p.id = pn.patient_id
           WHERE pn.source_mar_prn_record_id = $1`,
          [source_mar_prn_record_id],
        )
        if (rows[0] && !callerCanAccessHospital(caller, rows[0].hospital_id)) {
          return res.status(403).json({ error: 'Forbidden' })
        }
        return res.status(200).json(rows[0] ?? null)
      }

      if (!patient_id) return res.status(400).json({ error: 'patient_id required' })

      const { rows: patients } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [patient_id])
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const addendumClause = include_addendums === 'true' ? '' : ' AND is_addendum = false'
      const { rows } = await rdsQuery(
        `SELECT * FROM progress_note_entries WHERE patient_id = $1${addendumClause} ORDER BY note_date DESC, created_at DESC`,
        [patient_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — create progress note
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { patient_id, note_date, notes } = body
      if (!patient_id || !note_date || notes == null) {
        return res.status(400).json({ error: 'patient_id, note_date, and notes required' })
      }

      const { rows: patients } = await rdsQuery('SELECT hospital_id FROM patients WHERE id = $1', [patient_id])
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { rows } = await rdsQuery(
        `INSERT INTO progress_note_entries (
           patient_id, note_date, notes, signature, physician_name,
           is_addendum, source_mar_prn_record_id, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          patient_id, note_date, notes,
          body.signature ?? null, body.physician_name ?? null,
          body.is_addendum ?? false, body.source_mar_prn_record_id ?? null,
          caller.userId,
        ],
      )
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/progress-notes]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
