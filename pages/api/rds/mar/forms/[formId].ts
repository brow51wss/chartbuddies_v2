import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, rdsTransaction, resolveCallerFromToken, callerCanAccessHospital } from '../../../../../lib/rds'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)
    const { formId } = req.query as { formId: string }

    // -------------------------------------------------------------------------
    // Fetch form + verify access
    // -------------------------------------------------------------------------
    const { rows: forms } = await rdsQuery('SELECT * FROM mar_forms WHERE id = $1', [formId])
    if (!forms[0]) return res.status(404).json({ error: 'MAR form not found' })
    if (!callerCanAccessHospital(caller, forms[0].hospital_id)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    // -------------------------------------------------------------------------
    // GET — return form with medications, administrations, vitals, prn
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const [meds, admins, vitals, prnMeds, prnRecords] = await Promise.all([
        rdsQuery('SELECT * FROM mar_medications WHERE mar_form_id = $1 ORDER BY display_order ASC, created_at ASC', [formId]),
        rdsQuery(
          `SELECT a.* FROM mar_administrations a
           JOIN mar_medications m ON m.id = a.mar_medication_id
           WHERE m.mar_form_id = $1`,
          [formId],
        ),
        rdsQuery('SELECT * FROM mar_vital_signs WHERE mar_form_id = $1 ORDER BY day_number ASC', [formId]),
        rdsQuery('SELECT * FROM mar_prn_medications WHERE mar_form_id = $1 ORDER BY created_at ASC', [formId]),
        rdsQuery('SELECT * FROM mar_prn_records WHERE mar_form_id = $1 ORDER BY date ASC, created_at ASC', [formId]),
      ])

      return res.status(200).json({
        form: forms[0],
        medications: meds.rows,
        administrations: admins.rows,
        vital_signs: vitals.rows,
        prn_medications: prnMeds.rows,
        prn_records: prnRecords.rows,
      })
    }

    // -------------------------------------------------------------------------
    // PATCH — update form-level fields (status, comments, vital_signs_instructions, mar_chart_row_order)
    // -------------------------------------------------------------------------
    if (req.method === 'PATCH') {
      const body = req.body as Record<string, any>
      const allowed = ['status', 'comments', 'vital_signs_instructions', 'mar_chart_row_order',
        'patient_name','record_number','date_of_birth','sex','diagnosis','diet',
        'allergies','physician_name','physician_phone','facility_name']
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
      params.push(formId)
      const { rows } = await rdsQuery(
        `UPDATE mar_forms SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    // -------------------------------------------------------------------------
    // DELETE — delete entire MAR form (cascades to child tables)
    // -------------------------------------------------------------------------
    if (req.method === 'DELETE') {
      if (caller.role !== 'superadmin' && caller.role !== 'head_nurse') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      await rdsQuery('DELETE FROM mar_forms WHERE id = $1', [formId])
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/mar/forms/[formId]]', err)
    return res.status(err.message?.includes('Forbidden') ? 403 : err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
