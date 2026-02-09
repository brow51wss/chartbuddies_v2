export interface ProgressNoteEntry {
  id: string
  patient_id: string
  note_date: string
  notes: string
  signature: string | null
  physician_name: string | null
  is_addendum: boolean
  created_by: string
  created_at: string
  updated_at: string
}

/** Progress Notes Page 2: Monthly Summary / Assessment */
export interface ProgressNoteMonthlySummary {
  id: string
  patient_id: string
  month_year: string
  bp: string | null
  pulse: string | null
  resp: string | null
  temp: string | null
  wt: string | null
  weight_unit: string | null
  wt_change_yn: string | null
  response_to_diet: string | null
  medication_available_yn: string | null
  medication_secured_yn: string | null
  taking_medications_yn: string | null
  physician_notified_yn: string | null
  physician_notified_date: string | null
  medication_changes_yn: string | null
  response_to_medication: string | null
  treatments_yn: string | null
  treatments_type: string | null
  response_to_treatment: string | null
  therapy_yn: string | null
  therapy_pt: string | null
  therapy_ot: string | null
  therapy_st: string | null
  adl_level: string | null
  ambulation: string | null
  continent_urine_yn: string | null
  continent_stool_yn: string | null
  incontinent_urine_yn: string | null
  incontinent_stool_yn: string | null
  timed_toileting_yn: string | null
  diapers_yn: string | null
  bm_type: string | null
  skin_intact_yn: string | null
  wound_type: string | null
  wound_location: string | null
  wound_treatment: string | null
  wound_response: string | null
  pain_yn: string | null
  pain_location: string | null
  pain_intensity: string | null
  pain_cause: string | null
  pain_treatment: string | null
  pain_response: string | null
  mental_descriptors: string | null
  impaired_communication_other: string | null
  describe_changes: string | null
  date_md_notified: string | null
  actions: string | null
  changes_in_condition_yn: string | null
  illness_yn: string | null
  injury_yn: string | null
  date_physician_notified: string | null
  describe_type_actions_taken: string | null
  plan_of_care: string | null
  signature: string | null
  signature_title: string | null
  signature_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}
