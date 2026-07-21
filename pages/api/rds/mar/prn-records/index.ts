import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, rdsTransaction, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

async function getFormHospitalId(formId: string): Promise<string | null> {
  const { rows } = await rdsQuery('SELECT hospital_id FROM mar_forms WHERE id = $1', [formId])
  return rows[0]?.hospital_id ?? null
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { mar_form_id } = req.query
      if (!mar_form_id) return res.status(400).json({ error: 'mar_form_id required' })
      const hospitalId = await getFormHospitalId(mar_form_id as string)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })
      const { rows } = await rdsQuery(
        `SELECT * FROM mar_prn_records
         WHERE mar_form_id = $1
         ORDER BY date ASC, hour ASC NULLS LAST, created_at ASC`,
        [mar_form_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — create PRN record (optionally also create linked progress note)
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { mar_form_id, date, medication, reason } = body
      if (!mar_form_id || !date || !medication || !reason) {
        return res.status(400).json({ error: 'mar_form_id, date, medication, and reason required' })
      }
      const hospitalId = await getFormHospitalId(mar_form_id)
      if (!hospitalId) return res.status(404).json({ error: 'MAR form not found' })
      if (!callerCanAccessHospital(caller, hospitalId)) return res.status(403).json({ error: 'Forbidden' })

      // Determine next entry_number within this form
      const { rows: countRows } = await rdsQuery(
        'SELECT COALESCE(MAX(entry_number), 0) + 1 AS next_num FROM mar_prn_records WHERE mar_form_id = $1',
        [mar_form_id],
      )
      const nextNum = countRows[0].next_num

      // Use a transaction if we also need to create a progress note
      const createProgressNote = body.create_progress_note === true
      const { rows: formRows } = await rdsQuery('SELECT patient_id FROM mar_forms WHERE id = $1', [mar_form_id])
      const patientId = formRows[0]?.patient_id

      let prnRecord: any
      let progressNote: any

      await rdsTransaction(async (client) => {
        const res1 = await client.query(
          `INSERT INTO mar_prn_records (
             mar_form_id, date, hour, initials, medication, dosage,
             reason, result, staff_signature, note, entry_number, signed_by, start_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
          [
            mar_form_id, date, body.hour ?? null,
            body.initials ?? null, medication, body.dosage ?? null,
            reason, body.result ?? null, body.staff_signature ?? null,
            body.note ?? null, nextNum, caller.userId,
            body.start_date ?? null,
          ],
        )
        prnRecord = res1.rows[0]

        if (createProgressNote && patientId) {
          const noteText = `PRN #${nextNum}: ${medication} — Reason: ${reason}${body.result ? ` — Result: ${body.result}` : ''}`
          const res2 = await client.query(
            `INSERT INTO progress_note_entries (
               patient_id, note_date, notes, signature, physician_name,
               is_addendum, source_mar_prn_record_id, created_by
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [
              patientId, date, noteText,
              body.staff_signature ?? null, body.physician_name ?? null,
              false, prnRecord.id, caller.userId,
            ],
          )
          progressNote = res2.rows[0]
        }
      })

      return res.status(201).json({ prn_record: prnRecord, progress_note: progressNote ?? null })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/prn-records]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
