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
  /** Read-only; shown in Section 1 when set (e.g. dashboard edit). */
  recordNumber?: string
  /** Shown in Section 3; not an input. */
  facilityDisplayName?: string | null
}

export function PatientProfileFormFields({
  values: v,
  onChange,
  ageDisplay,
  mode,
  recordNumber,
  facilityDisplayName,
}: Props) {
  const showBasicContact = mode.type === 'full' || mode.step === 1
  const showClinical = mode.type === 'full' || mode.step === 2

  return (
    <div className="space-y-10">
      {showBasicContact && (
        <>
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Section 1: Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-3">
                <label htmlFor="pp-firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  id="pp-firstName"
                  name="firstName"
                  value={v.firstName}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                  placeholder="First Name"
                  autoComplete="given-name"
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="pp-middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Middle Name
                </label>
                <input
                  id="pp-middleName"
                  name="middleName"
                  value={v.middleName}
                  onChange={onChange}
                  className={patientProfileInputClass}
                  placeholder="Middle Name"
                  autoComplete="additional-name"
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="pp-dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date of Birth (DOB)<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  id="pp-dateOfBirth"
                  name="dateOfBirth"
                  value={v.dateOfBirth}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="pp-age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Age
                </label>
                <input
                  id="pp-age"
                  name="age"
                  value={ageDisplay}
                  readOnly
                  className={`${patientProfileInputClass} bg-gray-50 dark:bg-gray-600 cursor-not-allowed opacity-90`}
                  placeholder="Auto-calculated"
                />
              </div>

              <div className="md:col-span-6">
                <label htmlFor="pp-lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  id="pp-lastName"
                  name="lastName"
                  value={v.lastName}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                  placeholder="Last Name"
                  autoComplete="family-name"
                />
              </div>
              <div className="md:col-span-3">
                <label htmlFor="pp-sex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sex<span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  id="pp-sex"
                  name="sex"
                  value={v.sex}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                >
                  <option value="">Legal Sex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label htmlFor="pp-dateOfAdmission" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date of Admission<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="date"
                  id="pp-dateOfAdmission"
                  name="dateOfAdmission"
                  value={v.dateOfAdmission}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                />
              </div>

              {recordNumber != null && recordNumber !== '' && (
                <div className="md:col-span-12">
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
                <input
                  id="pp-streetAddress"
                  name="streetAddress"
                  value={v.streetAddress}
                  onChange={onChange}
                  className={patientProfileInputClass}
                  placeholder="Street Address"
                  autoComplete="street-address"
                />
              </div>
              <div className="md:col-span-5">
                <label htmlFor="pp-city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <input
                  id="pp-city"
                  name="city"
                  value={v.city}
                  onChange={onChange}
                  className={patientProfileInputClass}
                  placeholder="City"
                  autoComplete="address-level2"
                />
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  id="pp-state"
                  name="state"
                  value={v.state}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                  placeholder="State"
                  autoComplete="address-level1"
                />
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-homePhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Home Phone<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="tel"
                  id="pp-homePhone"
                  name="homePhone"
                  value={v.homePhone}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                  placeholder="(555) 555-5555"
                  autoComplete="tel"
                />
              </div>
              <div className="md:col-span-4">
                <label htmlFor="pp-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email<span className="text-red-500 ml-0.5">*</span>
                </label>
                <input
                  type="email"
                  id="pp-email"
                  name="email"
                  value={v.email}
                  onChange={onChange}
                  required={mode.type === 'full'}
                  className={patientProfileInputClass}
                  placeholder="Email"
                  autoComplete="email"
                />
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
              <input
                id="pp-diagnosis"
                name="diagnosis"
                value={v.diagnosis}
                onChange={onChange}
                className={patientProfileInputClass}
                placeholder="Diagnosis"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-diet" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Diet
              </label>
              <input
                id="pp-diet"
                name="diet"
                value={v.diet}
                onChange={onChange}
                className={patientProfileInputClass}
                placeholder="Diet"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-12">
              <label htmlFor="pp-allergies" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Allergies
              </label>
              <input
                id="pp-allergies"
                name="allergies"
                value={v.allergies}
                onChange={onChange}
                className={patientProfileInputClass}
                placeholder="None"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-physicianName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Physician / APRN or Clinic
              </label>
              <input
                id="pp-physicianName"
                name="physicianName"
                value={v.physicianName}
                onChange={onChange}
                className={patientProfileInputClass}
                placeholder="TBD"
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-6">
              <label htmlFor="pp-physicianPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Physician phone
              </label>
              <input
                type="tel"
                id="pp-physicianPhone"
                name="physicianPhone"
                value={v.physicianPhone}
                onChange={onChange}
                className={patientProfileInputClass}
                placeholder="(555) 555-5555"
                autoComplete="tel"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
