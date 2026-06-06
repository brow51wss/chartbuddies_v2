import type { NextApiRequest, NextApiResponse } from 'next'
import { rdsQuery, resolveCallerFromToken, callerCanAccessHospital } from '../../../../lib/rds'

const ALLOWED_FIELDS = [
  'month_year','bp','pulse','resp','temp','wt','wt_change_yn','weight_unit',
  'response_to_diet','medication_available_yn','medication_secured_yn',
  'taking_medications_yn','physician_notified_yn','physician_notified_date',
  'medication_changes_yn','response_to_medication','treatments_yn','treatments_type',
  'response_to_treatment','therapy_yn','therapy_pt','therapy_ot','therapy_st',
  'adl_level','ambulation','continent_urine_yn','continent_stool_yn',
  'incontinent_urine_yn','incontinent_stool_yn','timed_toileting_yn','diapers_yn',
  'bm_type','skin_intact_yn','wound_type','wound_location','wound_treatment',
  'wound_response','pain_yn','pain_location','pain_intensity','pain_cause',
  'pain_treatment','pain_response','mental_descriptors','impaired_communication_other',
  'describe_changes','date_md_notified','actions','changes_in_condition_yn',
  'illness_yn','injury_yn','date_physician_notified','describe_type_actions_taken',
  'plan_of_care','signature','signature_title','signature_date',
]

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const caller = await resolveCallerFromToken(req.headers.authorization)

    // -------------------------------------------------------------------------
    // GET — fetch summary by patient_id + month_year, or latest weight_unit
    // -------------------------------------------------------------------------
    if (req.method === 'GET') {
      const { patient_id, month_year, latest_weight_unit } = req.query as Record<string, string>

      if (!patient_id) return res.status(400).json({ error: 'patient_id is required' })

      const { rows: patients } = await rdsQuery(
        'SELECT hospital_id FROM patients WHERE id = $1',
        [patient_id],
      )
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      if (latest_weight_unit === 'true') {
        const { rows } = await rdsQuery(
          `SELECT weight_unit FROM progress_note_monthly_summaries
           WHERE patient_id = $1 ORDER BY month_year DESC LIMIT 1`,
          [patient_id],
        )
        return res.status(200).json(rows[0] ?? null)
      }

      if (month_year) {
        const { rows } = await rdsQuery(
          `SELECT * FROM progress_note_monthly_summaries
           WHERE patient_id = $1 AND month_year = $2`,
          [patient_id, month_year],
        )
        return res.status(200).json(rows[0] ?? null)
      }

      const { rows } = await rdsQuery(
        `SELECT * FROM progress_note_monthly_summaries
         WHERE patient_id = $1 ORDER BY month_year DESC`,
        [patient_id],
      )
      return res.status(200).json(rows)
    }

    // -------------------------------------------------------------------------
    // POST — insert or upsert a summary (on conflict: update all fields)
    // -------------------------------------------------------------------------
    if (req.method === 'POST') {
      const body = req.body as Record<string, any>
      const { patient_id, created_by } = body

      if (!patient_id || !created_by) {
        return res.status(400).json({ error: 'patient_id and created_by are required' })
      }

      const { rows: patients } = await rdsQuery(
        'SELECT hospital_id FROM patients WHERE id = $1',
        [patient_id],
      )
      if (!patients[0]) return res.status(404).json({ error: 'Patient not found' })
      if (!callerCanAccessHospital(caller, patients[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const fields = ['patient_id', 'created_by', ...ALLOWED_FIELDS.filter((f) => f in body)]
      const values = fields.map((f) => (f === 'patient_id' ? patient_id : f === 'created_by' ? created_by : body[f]))
      const placeholders = fields.map((_, i) => `$${i + 1}`)

      const updateCols = ALLOWED_FIELDS.filter((f) => f in body)
      const updateClause = updateCols.map((f) => `${f} = EXCLUDED.${f}`).join(', ')

      const sql = `
        INSERT INTO progress_note_monthly_summaries (${fields.join(', ')})
        VALUES (${placeholders.join(', ')})
        ON CONFLICT (patient_id, month_year)
        DO UPDATE SET ${updateClause}, updated_at = NOW()
        RETURNING *
      `
      const { rows } = await rdsQuery(sql, values)
      return res.status(201).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/progress-note-summaries]', err)
    return res
      .status(err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
