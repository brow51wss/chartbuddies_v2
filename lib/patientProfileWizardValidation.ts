import type { PatientProfileFormValues } from '../components/PatientProfileFormFields'

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

/** Contact fields that must be valid before a patient can be added or edited. */
export function validatePatientContactFields(v: PatientProfileFormValues): PatientProfileFieldErrors {
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

  if (v.physicianPhone.trim() && digitCount(v.physicianPhone) !== 10) {
    errors.physicianPhone = 'Physician phone must contain 10 digits, or leave it blank.'
  }

  if (v.zipCode.trim()) {
    const zipDigits = digitCount(v.zipCode)
    if (zipDigits !== 5 && zipDigits !== 9) {
      errors.zipCode = 'ZIP code must contain 5 or 9 digits, or leave it blank.'
    }
  }

  return errors
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

  return { ...errors, ...validatePatientContactFields(v) }
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
