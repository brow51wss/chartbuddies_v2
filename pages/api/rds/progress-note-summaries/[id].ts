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
    const { id } = req.query as { id: string }

    // -------------------------------------------------------------------------
    // PATCH — update an existing summary
    // -------------------------------------------------------------------------
    if (req.method === 'PATCH') {
      const { rows: existing } = await rdsQuery(
        `SELECT s.*, p.hospital_id FROM progress_note_monthly_summaries s
         JOIN patients p ON p.id = s.patient_id WHERE s.id = $1`,
        [id],
      )
      if (!existing[0]) return res.status(404).json({ error: 'Not found' })
      if (!callerCanAccessHospital(caller, existing[0].hospital_id)) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const body = req.body as Record<string, any>
      const sets: string[] = []
      const params: any[] = []
      let idx = 1
      for (const field of ALLOWED_FIELDS) {
        if (field in body) {
          sets.push(`${field} = $${idx++}`)
          params.push(body[field])
        }
      }
      if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
      params.push(id)
      const { rows } = await rdsQuery(
        `UPDATE progress_note_monthly_summaries SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${idx} RETURNING *`,
        params,
      )
      return res.status(200).json(rows[0])
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[/api/rds/progress-note-summaries/[id]]', err)
    return res
      .status(err.message?.includes('token') ? 401 : 500)
      .json({ error: err.message ?? 'Internal server error' })
  }
}
