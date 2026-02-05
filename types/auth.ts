export type Role = 'superadmin' | 'head_nurse' | 'nurse'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  role: Role
  hospital_id: string | null
  staff_initials: string | null
  staff_initials_text: string | null
  staff_signature: string | null
  staff_signature_font: string | null
  staff_signature_text: string | null
  designation: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Hospital {
  id: string
  name: string
  facility_type: string
  invite_code: string
  address: string | null
  phone: string | null
  email: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  hospital_id: string
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
  created_by: string
  created_at: string
  updated_at: string
}

