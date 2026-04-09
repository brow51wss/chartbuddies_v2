import type { PatientProfileFormValues } from '../components/PatientProfileFormFields'

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
