import React from 'react'

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
  homePhone: string
  email: string
  diagnosis: string
  diet: string
  allergies: string
  physicianName: string
  physicianPhone: string
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
}: Props) {
  const showBasicContact = mode.type === 'full' || mode.step === 1
  const showClinical = mode.type === 'full' || mode.step === 2
  const hasValue = (value: string) => value.trim().length > 0
  const digitCount = (value: string) => value.replace(/\D/g, '').length
  const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
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
        return minLen(value, 2)
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
                        id="pp-firstName"
                        name="firstName"
                        value={v.firstName}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                        placeholder="First Name"
                        autoComplete="given-name"
                      />
                      <FieldCompleteCheck show={shouldShowCheck('firstName')} />
                    </div>
                  </div>
                  <div className="md:col-span-4">
                    <label htmlFor="pp-middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Middle Name
                    </label>
                    <div className="relative">
                      <input
                        id="pp-middleName"
                        name="middleName"
                        value={v.middleName}
                        onChange={onChange}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
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
                        id="pp-lastName"
                        name="lastName"
                        value={v.lastName}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                        placeholder="Last Name"
                        autoComplete="family-name"
                      />
                      <FieldCompleteCheck show={shouldShowCheck('lastName')} />
                    </div>
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
                        id="pp-dateOfBirth"
                        name="dateOfBirth"
                        value={v.dateOfBirth}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full pr-8`}
                      />
                      <FieldCompleteCheck show={shouldShowCheck('dateOfBirth')} />
                    </div>
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
                        id="pp-sex"
                        name="sex"
                        value={v.sex}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full ${showCompletionChecks ? 'pr-10' : ''}`}
                      >
                        <option value="">Legal Sex</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                      <FieldCompleteCheck show={shouldShowCheck('sex')} rightClassName="right-8" />
                    </div>
                  </div>
                  <div className="min-w-0 w-full md:w-[175px] md:max-w-[175px]">
                    <label htmlFor="pp-dateOfAdmission" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Date of Admission<span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative min-w-0 w-full overflow-x-clip">
                      <input
                        type="date"
                        id="pp-dateOfAdmission"
                        name="dateOfAdmission"
                        value={v.dateOfAdmission}
                        onChange={onChange}
                        required={mode.type === 'full'}
                        className={`${patientProfileInputClass} min-w-0 w-full pr-8`}
                      />
                      <FieldCompleteCheck show={shouldShowCheck('dateOfAdmission')} />
                    </div>
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
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    id="pp-state"
                    name="state"
                    value={v.state}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                    placeholder="State"
                    autoComplete="address-level1"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('state')} />
                </div>
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-homePhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Home Phone<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    id="pp-homePhone"
                    name="homePhone"
                    value={v.homePhone}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                    placeholder="(555) 555-5555"
                    autoComplete="tel"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('homePhone')} />
                </div>
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <input
                    type="email"
                    id="pp-email"
                    name="email"
                    value={v.email}
                    onChange={onChange}
                    required={mode.type === 'full'}
                    className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                    placeholder="Email"
                    autoComplete="email"
                  />
                  <FieldCompleteCheck show={shouldShowCheck('email')} />
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
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
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
                  id="pp-physicianPhone"
                  name="physicianPhone"
                  value={v.physicianPhone}
                  onChange={onChange}
                  className={`${patientProfileInputClass} ${showCompletionChecks ? 'pr-10' : ''}`}
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
                <FieldCompleteCheck show={shouldShowCheck('physicianPhone')} />
              </div>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  )
}
