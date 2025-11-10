export interface MARForm {
  id: string
  patient_id: string
  hospital_id: string
  month_year: string
  created_by: string
  status: 'draft' | 'submitted' | 'archived'
  patient_name: string
  record_number: string
  date_of_birth: string
  sex: 'Male' | 'Female' | 'Other'
  diagnosis: string | null
  diet: string | null
  allergies: string
  physician_name: string
  physician_phone: string | null
  facility_name: string | null
  vital_signs_instructions: string | null // Custom instructions for vital signs (e.g., "BP (sprinkle salt on food if BP low <80/60)")
  created_at: string
  updated_at: string
}

export interface MARMedication {
  id: string
  mar_form_id: string
  medication_name: string
  dosage: string
  start_date: string
  stop_date: string | null
  hour: string // Time format
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MARAdministration {
  id: string
  mar_medication_id: string
  day_number: number // 1-31
  status: 'Given' | 'Not Given' | 'PRN'
  initials: string | null
  notes: string | null
  administered_at: string | null
  created_at: string
  updated_at: string
}

export interface MARPRNRecord {
  id: string
  mar_form_id: string
  date: string
  hour: string
  initials: string
  medication: string
  reason: string
  result: string | null
  staff_signature: string
  entry_number: number | null
  created_at: string
  updated_at: string
}

export interface MARVitalSigns {
  id: string
  mar_form_id: string
  day_number: number
  temperature: number | null
  pulse: number | null
  respiration: number | null
  weight: number | null
  systolic_bp: number | null // Systolic blood pressure
  diastolic_bp: number | null // Diastolic blood pressure
  bowel_movement: string | null // Bowel movement tracking (Yes/No/Loose/Formed/etc.)
  created_at: string
  updated_at: string
}

export interface MARFormData extends MARForm {
  medications: MARMedication[]
  administrations: MARAdministration[]
  prn_records: MARPRNRecord[]
  vital_signs: MARVitalSigns[]
}

