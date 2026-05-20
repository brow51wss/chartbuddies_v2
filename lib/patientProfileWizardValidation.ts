import type { PatientProfileFormValues } from '../components/PatientProfileFormFields'
import { parsePatientNameParts } from './patientName'
import type { Patient } from '../types/auth'

export const PHYSICIAN_SELECTION_BLOCKED_HINT =
  'Complete the patient’s name, date of birth, sex, admission date, state, home phone, and email before choosing a physician.'

export type PatientProfileFieldErrors = Partial<Record<keyof PatientProfileFormValues, string>>

const PATIENT_PROFILE_ERROR_FIELD_ORDER: (keyof PatientProfileFormValues)[] = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'sex',
  'dateOfAdmission',
  'streetAddress',
  'city',
  'state',
  'zipCode',
  'homePhone',
  'email',
  'physicianName',
  'physicianPhone',
]

function digitCount(value: string): number {
  return value.replace(/\D/g, '').length
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

const US_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
])

export const DEFAULT_PATIENT_STATE = 'HI'

export function formatPatientPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export function formatPatientZipInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length <= 5) return digits
  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

/** Step-1 contact fields (home phone, email, optional ZIP). */
export function validatePatientStep1ContactFields(v: PatientProfileFormValues): PatientProfileFieldErrors {
  const errors: PatientProfileFieldErrors = {}

  if (!v.homePhone.trim()) {
    errors.homePhone = 'Home phone is required.'
  } else if (digitCount(v.homePhone) !== 10) {
    errors.homePhone = 'Home phone must contain 10 digits.'
  }

  if (!v.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!isEmailLike(v.email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (v.zipCode.trim()) {
    const zipDigits = digitCount(v.zipCode)
    if (zipDigits !== 5 && zipDigits !== 9) {
      errors.zipCode = 'ZIP code must contain 5 or 9 digits, or leave it blank.'
    }
  }

  return errors
}

/** Optional physician phone on step 2 (validated on save, not for step-1 gating). */
export function validatePhysicianPhoneField(v: PatientProfileFormValues): PatientProfileFieldErrors {
  const errors: PatientProfileFieldErrors = {}
  if (v.physicianPhone.trim() && digitCount(v.physicianPhone) !== 10) {
    errors.physicianPhone = 'Physician phone must contain 10 digits, or leave it blank.'
  }
  return errors
}

/** Contact fields that must be valid before a patient can be added or edited. */
export function validatePatientContactFields(v: PatientProfileFormValues): PatientProfileFieldErrors {
  return { ...validatePatientStep1ContactFields(v), ...validatePhysicianPhoneField(v) }
}

/** Required + contact-format errors for Step 1 of the patient add/edit wizard. */
export function validatePatientProfileWizardStep1Fields(v: PatientProfileFormValues): PatientProfileFieldErrors {
  const errors: PatientProfileFieldErrors = {}

  if (!v.firstName.trim()) errors.firstName = 'First name is required.'
  if (!v.lastName.trim()) errors.lastName = 'Last name is required.'
  if (!v.dateOfBirth) errors.dateOfBirth = 'Date of birth is required.'
  if (!v.sex) errors.sex = 'Sex is required.'
  if (!v.dateOfAdmission) errors.dateOfAdmission = 'Date of admission is required.'
  const state = v.state.trim().toUpperCase()
  if (!state) {
    errors.state = 'State is required.'
  } else if (!/^[A-Z]{2}$/.test(state) || !US_STATE_CODES.has(state)) {
    errors.state = 'State must be a valid 2-letter US state code.'
  }

  return { ...errors, ...validatePatientStep1ContactFields(v) }
}

/** Step 1 + optional physician phone — use when submitting the full patient form. */
export function validatePatientProfileForSave(v: PatientProfileFormValues): PatientProfileFieldErrors {
  return { ...validatePatientProfileWizardStep1Fields(v), ...validatePhysicianPhoneField(v) }
}

export function patientProfileFieldErrorMessages(errors: PatientProfileFieldErrors): string[] {
  return PATIENT_PROFILE_ERROR_FIELD_ORDER
    .map((field) => errors[field])
    .filter((message): message is string => Boolean(message))
}

export function patientProfileWizardStep1Messages(
  missingFields: string[],
  fieldErrors: PatientProfileFieldErrors
): string[] {
  const missingMessages = missingFields
    .filter((field) => {
      if (field === 'Home phone' && fieldErrors.homePhone) return false
      if (field === 'Email' && fieldErrors.email) return false
      return true
    })
    .map((field) => `${field} is required.`)

  return [...missingMessages, ...patientProfileFieldErrorMessages(fieldErrors)]
}

/** Fields required before advancing from step 1 to step 2 (matches admissions). */
export function missingFieldsForPatientProfileWizardStep1(v: PatientProfileFormValues): string[] {
  const missing: string[] = []
  if (!v.firstName.trim()) missing.push('First name')
  if (!v.lastName.trim()) missing.push('Last name')
  if (!v.dateOfBirth) missing.push('Date of birth')
  if (!v.sex) missing.push('Sex')
  if (!v.dateOfAdmission) missing.push('Date of admission')
  if (!v.state.trim()) missing.push('State')
  if (!v.homePhone.trim()) missing.push('Home phone')
  if (!v.email.trim()) missing.push('Email')
  return missing
}

export function patientToProfileFormValues(patient: Patient): PatientProfileFormValues {
  const nameParts = parsePatientNameParts(patient.patient_name)
  return {
    firstName: nameParts.firstName,
    middleName: nameParts.middleName,
    lastName: nameParts.lastName,
    dateOfBirth: patient.date_of_birth?.slice(0, 10) || '',
    sex: patient.sex || '',
    dateOfAdmission: patient.admission_date?.slice(0, 10) || patient.date_of_birth?.slice(0, 10) || '',
    streetAddress: patient.street_address || '',
    city: patient.city || '',
    state: patient.state || DEFAULT_PATIENT_STATE,
    zipCode: patient.zip_code || '',
    homePhone: patient.home_phone || '',
    email: patient.email || '',
    diagnosis: patient.diagnosis || '',
    diet: patient.diet || '',
    allergies: patient.allergies || '',
    physicianName: patient.physician_name || '',
    physicianPhone: patient.physician_phone || '',
  }
}

/** True when step-1 patient identity/contact fields pass wizard validation. */
export function isPatientProfileStep1Complete(v: PatientProfileFormValues): boolean {
  return patientProfileFieldErrorMessages(validatePatientProfileWizardStep1Fields(v)).length === 0
}

export function isPatientRecordStep1Complete(patient: Patient): boolean {
  return isPatientProfileStep1Complete(patientToProfileFormValues(patient))
}

/** Step-1 fields must be complete before physician name/phone can be edited. */
export function canEditPhysicianFields(v: PatientProfileFormValues): boolean {
  return isPatientProfileStep1Complete(v)
}
