import React from 'react'
import {
  PHYSICIAN_SELECTION_BLOCKED_HINT,
  canEditPhysicianFields,
} from '../lib/patientProfileWizardValidation'

export const patientProfileInputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white'

export type PatientProfileFormValues = {
  firstName: string
  middleName: string
  lastName: string
  dateOfBirth: string
  sex: string
  dateOfAdmission: string
  streetAddress: string
  city: string
  state: string
  zipCode: string
  homePhone: string
  email: string
  diagnosis: string
  diet: string
  allergies: string
  physicianName: string
  physicianPhone: string
}

export const PATIENT_PROFILE_FIELD_IDS: Record<keyof PatientProfileFormValues, string> = {
  firstName: 'pp-firstName',
  middleName: 'pp-middleName',
  lastName: 'pp-lastName',
  dateOfBirth: 'pp-dateOfBirth',
  sex: 'pp-sex',
  dateOfAdmission: 'pp-dateOfAdmission',
  streetAddress: 'pp-streetAddress',
  city: 'pp-city',
  state: 'pp-state',
  zipCode: 'pp-zipCode',
  homePhone: 'pp-homePhone',
  email: 'pp-email',
  diagnosis: 'pp-diagnosis',
  diet: 'pp-diet',
  allergies: 'pp-allergies',
  physicianName: 'pp-physicianName',
  physicianPhone: 'pp-physicianPhone',
}

export const PATIENT_PROFILE_FIELD_STEPS: Partial<Record<keyof PatientProfileFormValues, 1 | 2>> = {
  firstName: 1,
  middleName: 1,
  lastName: 1,
  dateOfBirth: 1,
  sex: 1,
  dateOfAdmission: 1,
  streetAddress: 1,
  city: 1,
  state: 1,
  zipCode: 1,
  homePhone: 1,
  email: 1,
  diagnosis: 2,
  diet: 2,
  allergies: 2,
  physicianName: 2,
  physicianPhone: 2,
}

const PATIENT_PROFILE_FIELD_LABELS: Record<keyof PatientProfileFormValues, string> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  dateOfBirth: 'Date of birth',
  sex: 'Sex',
  dateOfAdmission: 'Date of admission',
  streetAddress: 'Street address',
  city: 'City',
  state: 'State',
  zipCode: 'ZIP code',
  homePhone: 'Home phone',
  email: 'Email',
  diagnosis: 'Diagnosis',
  diet: 'Diet',
  allergies: 'Allergies',
  physicianName: 'Physician',
  physicianPhone: 'Physician phone',
}

const PATIENT_PROFILE_FIELD_ORDER: (keyof PatientProfileFormValues)[] = [
  'firstName',
  'lastName',
  'dateOfBirth',
  'sex',
  'dateOfAdmission',
  'state',
  'zipCode',
  'homePhone',
  'email',
  'physicianPhone',
]

const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC',
]

const US_STATE_CODE_SET = new Set(US_STATE_CODES)

export function PatientProfileFieldErrorChips({
  fieldErrors,
  onFieldClick,
}: {
  fieldErrors: Partial<Record<keyof PatientProfileFormValues, string>>
  onFieldClick: (field: keyof PatientProfileFormValues) => void
}) {
  const fields = PATIENT_PROFILE_FIELD_ORDER.filter((field) => Boolean(fieldErrors[field]))
  if (!fields.length) return null

  return (
    <div className="flex flex-wrap gap-2" aria-label="Fields that need attention">
      {fields.map((field) => (
        <button
          key={field}
          type="button"
          onClick={() => onFieldClick(field)}
          className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-900/40"
          title={fieldErrors[field]}
        >
          {PATIENT_PROFILE_FIELD_LABELS[field]}
        </button>
      ))}
    </div>
  )
}

type Mode = { type: 'wizard'; step: 1 | 2 } | { type: 'full' }

type Props = {
  values: PatientProfileFormValues
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
  ageDisplay: string
  mode: Mode
  /** Disable all editable controls while saving. */
  disabled?: boolean
  /** Show green check indicator when required fields are completed. */
  showCompletionChecks?: boolean
  /**
   * Optional touched/edited map. When provided, checkmarks are shown only for fields
   * the user changed in this form session.
   */
  editedFields?: Partial<Record<keyof PatientProfileFormValues, boolean>>
  /** Read-only; shown in Section 1 when set (e.g. dashboard edit). */
  recordNumber?: string
  /** Shown in Section 3; not an input. */
  facilityDisplayName?: string | null
  /** Field-level validation messages shown directly below inputs. */
  fieldErrors?: Partial<Record<keyof PatientProfileFormValues, string>>
  /** Temporary field highlight used after clicking an error chip. */
  highlightedField?: keyof PatientProfileFormValues | null
}

function FieldCompleteCheck({ show, rightClassName = 'right-3' }: { show: boolean; rightClassName?: string }) {
  if (!show) return null
  return (
    <span
      className={`pointer-events-none absolute inset-y-0 ${rightClassName} flex items-center text-green-600 dark:text-green-400`}
      aria-hidden="true"
    >
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M16.704 5.29a1 1 0 010 1.42l-7.01 7.01a1 1 0 01-1.414 0L3.296 8.736a1 1 0 111.414-1.414l4.277 4.277 6.303-6.303a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  )
}

export function PatientProfileFormFields({
  values: v,
  onChange,
  ageDisplay,
  mode,
  disabled = false,
  showCompletionChecks = false,
  editedFields,
  recordNumber,
  facilityDisplayName,
  fieldErrors,
  highlightedField,
}: Props) {
  const showBasicContact = mode.type === 'full' || mode.step === 1
  const showClinical = mode.type === 'full' || mode.step === 2
  const physicianFieldsLocked = showClinical && !canEditPhysicianFields(v)
  const hasValue = (value: string) => value.trim().length > 0
  const digitCount = (value: string) => value.replace(/\D/g, '').length
  const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  const isZipLike = (value: string) => {
    const digits = value.replace(/\D/g, '')
    return digits.length === 5 || digits.length === 9
  }
  const minLen = (value: string, n: number) => value.trim().length >= n
  const isComplete = (field: keyof PatientProfileFormValues) => {
    const value = v[field] ?? ''
    switch (field) {
      case 'firstName':
      case 'lastName':
      case 'city':
      case 'streetAddress':
      case 'diagnosis':
      case 'diet':
      case 'allergies':
      case 'physicianName':
        return minLen(value, 2)
      case 'state':
        return US_STATE_CODE_SET.has(value.trim().toUpperCase())
      case 'zipCode':
        return isZipLike(value)
      case 'middleName':
        return minLen(value, 1)
      case 'sex':
      case 'dateOfBirth':
      case 'dateOfAdmission':
        return hasValue(value)
      case 'homePhone':
      case 'physicianPhone':
        return digitCount(value) >= 10
      case 'email':
        return isEmailLike(value)
      default:
        return hasValue(value)
    }
  }
  const shouldShowCheck = (field: keyof PatientProfileFormValues) =>
    showCompletionChecks && isComplete(field) && (editedFields == null || !!editedFields[field])
  const fieldError = (field: keyof PatientProfileFormValues) => fieldErrors?.[field]
  const errorTextClass = 'mt-1 text-xs font-medium text-red-600 dark:text-red-400'
  const highlightClass = (field: keyof PatientProfileFormValues) =>
    highlightedField === field
      ? 'border-red-400 ring-2 ring-red-500/70 shadow-[0_0_0_4px_rgba(239,68,68,0.20)] transition-[box-shadow,border-color] duration-500'
      : 'transition-[box-shadow,border-color] duration-500'

  return (
    <fieldset disabled={disabled} className={`space-y-10 ${disabled ? 'opacity-75' : ''}`}>
      {showBasicContact && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Section 1: Basic Information
            </h2>
            <div className="space-y-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-4">
                    <label htmlFor="pp-firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      First Name<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id={PATIENT_PROFILE_FIELD_IDS.firstName}
                        name="firstName"
                        value={v.firstName}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('firstName')}`}
                        placeholder="First Name"
                        autoComplete="given-name"
                      />
                      <FieldCompleteCheck show={shouldShowCheck('firstName')} />
                    </div>
                    {fieldError('firstName') && <p className={errorTextClass}>{fieldError('firstName')}</p>}
                  </div>
                  <div className="md:col-span-4">
                    <label htmlFor="pp-middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Middle Name
                    </label>
                    <div className="relative">
                      <input
                        id={PATIENT_PROFILE_FIELD_IDS.middleName}
                        name="middleName"
                        value={v.middleName}
                        onChange={onChange}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('middleName')}`}
                        placeholder="Middle Name"
                        autoComplete="additional-name"
                      />
                      <FieldCompleteCheck show={shouldShowCheck('middleName')} />
                    </div>
                  </div>
                  <div className="md:col-span-4">
                    <label htmlFor="pp-lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Last Name<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id={PATIENT_PROFILE_FIELD_IDS.lastName}
                        name="lastName"
                        value={v.lastName}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('lastName')}`}
                        placeholder="Last Name"
                        autoComplete="family-name"
                      />
                      <FieldCompleteCheck show={shouldShowCheck('lastName')} />
                    </div>
                    {fieldError('lastName') && <p className={errorTextClass}>{fieldError('lastName')}</p>}
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="grid grid-cols-1 gap-x-0 gap-y-4 md:grid-cols-[175px_minmax(10px,max-content)_150px_175px] md:items-start md:gap-x-[10px] md:gap-y-0">
                  <div className="min-w-0 w-full md:w-[175px] md:max-w-[175px]">
                    <label htmlFor="pp-dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date of Birth (DOB)<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative min-w-0 w-full overflow-x-clip">
                      <input
                        type="date"
                        id={PATIENT_PROFILE_FIELD_IDS.dateOfBirth}
                        name="dateOfBirth"
                        value={v.dateOfBirth}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full pr-8 ${highlightClass('dateOfBirth')}`}
                      />
                      <FieldCompleteCheck show={shouldShowCheck('dateOfBirth')} />
                    </div>
                    {fieldError('dateOfBirth') && <p className={errorTextClass}>{fieldError('dateOfBirth')}</p>}
                  </div>
                  <div className="min-w-0 w-full">
                    <label htmlFor="pp-age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Age
                    </label>
                    <input
                      id="pp-age"
                      name="age"
                      value={ageDisplay}
                      readOnly
                      title="Auto-calculated from date of birth"
                      className={`${patientProfileInputClass} block w-full min-w-[3.5ch] max-w-[3.75rem] bg-gray-50 text-center dark:bg-gray-600 cursor-not-allowed opacity-90`}
                      placeholder="—"
                    />
                  </div>
                  <div className="min-w-0 w-full md:w-[150px] md:max-w-[150px]">
                    <label htmlFor="pp-sex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sex<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id={PATIENT_PROFILE_FIELD_IDS.sex}
                        name="sex"
                        value={v.sex}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('sex')}`}
                      >
                        <option value="">Legal Sex</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <FieldCompleteCheck show={shouldShowCheck('sex')} rightClassName="right-8" />
                    </div>
                    {fieldError('sex') && <p className={errorTextClass}>{fieldError('sex')}</p>}
                  </div>
                  <div className="min-w-0 w-full md:w-[175px] md:max-w-[175px]">
                    <label htmlFor="pp-dateOfAdmission" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date of Admission<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative min-w-0 w-full overflow-x-clip">
                      <input
                        type="date"
                        id={PATIENT_PROFILE_FIELD_IDS.dateOfAdmission}
                        name="dateOfAdmission"
                        value={v.dateOfAdmission}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full pr-8 ${highlightClass('dateOfAdmission')}`}
                      />
                      <FieldCompleteCheck show={shouldShowCheck('dateOfAdmission')} />
                    </div>
                    {fieldError('dateOfAdmission') && <p className={errorTextClass}>{fieldError('dateOfAdmission')}</p>}
                  </div>
                </div>
              </div>

              {recordNumber != null && recordNumber !== '' && (
                <div>
                  <label htmlFor="pp-recordNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Record number
                  </label>
                  <input
                    id="pp-recordNumber"
                    value={recordNumber}
                    readOnly
                    className={`${patientProfileInputClass} bg-gray-50 dark:bg-gray-600 cursor-not-allowed opacity-90`}
                  />
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Section 2: Contact Information
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7">
                <label htmlFor="pp-streetAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Street Address
                </label>
                <div className="relative">
                  <input
                    id="pp-streetAddress"
                    name="streetAddress"
                    value={v.streetAddress}
                    onChange={onChange}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                    placeholder="Street Address"
                    autoComplete="street-address"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('streetAddress')} />
                </div>
                {fieldError('streetAddress') && <p className={errorTextClass}>{fieldError('streetAddress')}</p>}
              </div>
              <div className="md:col-span-5">
                <label htmlFor="pp-city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <div className="relative">
                  <input
                    id="pp-city"
                    name="city"
                    value={v.city}
                    onChange={onChange}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                    placeholder="City"
                    autoComplete="address-level2"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('city')} />
                </div>
                {fieldError('city') && <p className={errorTextClass}>{fieldError('city')}</p>}
              </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[4.25rem_5.75rem_11.5rem_minmax(12rem,1fr)] md:gap-3 ">
              <div className="min-w-0 w-[90px]">
                <label htmlFor="pp-state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <select
                    id={PATIENT_PROFILE_FIELD_IDS.state}
                    name="state"
                    value={v.state}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    className={`${patientProfileInputClass} appearance-none ${showCompletionChecks ? 'pr-8' : ''} ${highlightClass('state')}`}
                    autoComplete="address-level1"
                  >
                    {US_STATE_CODES.map((stateCode) => (
                      <option key={stateCode} value={stateCode}>
                        {stateCode}
                      </option>
                    ))}
                  </select>
                  <FieldCompleteCheck show={shouldShowCheck('state')} />
                </div>
                {fieldError('state') && <p className={errorTextClass}>{fieldError('state')}</p>}
              </div>
              <div className="min-w-0 ml-[15px] w-[155px]">
                <label htmlFor="pp-zipCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ZIP code
                </label>
                <div className="relative">
                  <input
                    id={PATIENT_PROFILE_FIELD_IDS.zipCode}
                    name="zipCode"
                    value={v.zipCode}
                    onChange={onChange}
                    inputMode="numeric"
                    maxLength={10}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('zipCode')}`}
                    placeholder="96813"
                    autoComplete="postal-code"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('zipCode')} />
                </div>
                {fieldError('zipCode') && <p className={errorTextClass}>{fieldError('zipCode')}</p>}
              </div>
              <div className="min-w-0 ml-[73px] w-[180px]">
                <label htmlFor="pp-homePhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Home Phone<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    id={PATIENT_PROFILE_FIELD_IDS.homePhone}
                    name="homePhone"
                    value={v.homePhone}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    inputMode="numeric"
                    maxLength={14}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('homePhone')}`}
                    placeholder="(555) 555-5555"
                    autoComplete="tel"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('homePhone')} />
                </div>
                {fieldError('homePhone') && <p className={errorTextClass}>{fieldError('homePhone')}</p>}
              </div>
              <div className="min-w-0 ml-[63px]">
                <label htmlFor="pp-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id={PATIENT_PROFILE_FIELD_IDS.email}
                    name="email"
                    value={v.email}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('email')}`}
                    placeholder="Email"
                    autoComplete="email"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('email')} />
                </div>
                {fieldError('email') && <p className={errorTextClass}>{fieldError('email')}</p>}
              </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showClinical && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
            Section 3: Clinical information
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Facility is set from your account
            {facilityDisplayName ? (
              <>
                : <span className="font-medium text-gray-800 dark:text-gray-200">{facilityDisplayName}</span>
              </>
            ) : (
              <> (no facility linked—assign a hospital on your profile if this looks wrong).</>
            )}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label htmlFor="pp-diagnosis" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Diagnosis
              </label>
              <div className="relative">
                <input
                  id="pp-diagnosis"
                  name="diagnosis"
                  value={v.diagnosis}
                  onChange={onChange}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                  placeholder="Diagnosis"
                  autoComplete="off"
                />
                <FieldCompleteCheck show={shouldShowCheck('diagnosis')} />
              </div>
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-diet" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Diet
              </label>
              <div className="relative">
                <input
                  id="pp-diet"
                  name="diet"
                  value={v.diet}
                  onChange={onChange}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                  placeholder="Diet"
                  autoComplete="off"
                />
                <FieldCompleteCheck show={shouldShowCheck('diet')} />
              </div>
            </div>
            <div className="md:col-span-12">
              <label htmlFor="pp-allergies" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allergies
              </label>
              <div className="relative">
                <input
                  id="pp-allergies"
                  name="allergies"
                  value={v.allergies}
                  onChange={onChange}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                  placeholder="None"
                  autoComplete="off"
                />
                <FieldCompleteCheck show={shouldShowCheck('allergies')} />
              </div>
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-physicianName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Physician / APRN or Clinic
              </label>
              <div className="relative">
                <input
                  id="pp-physicianName"
                  name="physicianName"
                  value={v.physicianName}
                  onChange={onChange}
                  disabled={disabled || physicianFieldsLocked}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${physicianFieldsLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                  placeholder="TBD"
                  autoComplete="off"
                />
                <FieldCompleteCheck show={shouldShowCheck('physicianName')} />
              </div>
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-physicianPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Physician phone
              </label>
              <div className="relative">
                <input
                  type="tel"
                  id={PATIENT_PROFILE_FIELD_IDS.physicianPhone}
                  name="physicianPhone"
                  value={v.physicianPhone}
                  onChange={onChange}
                  disabled={disabled || physicianFieldsLocked}
                  inputMode="numeric"
                  maxLength={14}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''} ${highlightClass('physicianPhone')} ${physicianFieldsLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
                <FieldCompleteCheck show={shouldShowCheck('physicianPhone')} />
              </div>
              {fieldError('physicianPhone') && <p className={errorTextClass}>{fieldError('physicianPhone')}</p>}
            </div>
            {physicianFieldsLocked && (
              <p className="md:col-span-12 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                {PHYSICIAN_SELECTION_BLOCKED_HINT}
              </p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  )
}
