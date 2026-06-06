import React, { useCallback, useEffect, useRef, useState } from 'react'
import { rdsGetPatient } from '../lib/rdsApi'
import { computeAgeFromISODate } from '../lib/patientName'
import type { Patient } from '../types/auth'
import {
  PATIENT_PROFILE_FIELD_IDS,
  PATIENT_PROFILE_FIELD_STEPS,
  PatientProfileFieldErrorChips,
  PatientProfileFormFields,
  type PatientProfileFormValues,
} from './PatientProfileFormFields'
import { PatientPhotoCaptureField } from './PatientPhotoCaptureField'
import {
  DEFAULT_PATIENT_STATE,
  formatPatientPhoneInput,
  formatPatientZipInput,
  patientProfileFieldErrorMessages,
  patientToProfileFormValues,
  validatePatientProfileForSave,
  validatePatientProfileWizardStep1Fields,
  type PatientProfileFieldErrors,
} from '../lib/patientProfileWizardValidation'
import { localTodayYMD } from '../lib/calendarDate'

export type PatientProfileUpdatePayload = {
  patient_name: string
  date_of_birth: string
  sex: Patient['sex']
  diagnosis: string | null
  diet: string | null
  allergies: string
  physician_name: string
  physician_phone: string | null
  facility_name: string | null
  street_address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  home_phone: string | null
  email: string | null
  admission_date: string | null
  patient_photo: string | null
}

export type EditPatientInfoSaveArgs = {
  patientId: string | null
  payload: PatientProfileUpdatePayload
  form: PatientProfileFormValues
  patientName: string
}

type Props = {
  isOpen: boolean
  patientId: string | null | undefined
  mode?: 'edit' | 'create'
  title?: string
  facilityDisplayName?: string | null
  recordNumber?: string | null
  readOnly?: boolean
  onClose: () => void
  onSave: (args: EditPatientInfoSaveArgs) => Promise<Patient>
  onSaved?: (updatedPatient: Patient) => void
  loadingText?: string
  errorTitleId?: string
}

function emptyPatientFormValues(): PatientProfileFormValues {
  return {
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '',
    dateOfAdmission: localTodayYMD(),
    streetAddress: '',
    city: '',
    state: DEFAULT_PATIENT_STATE,
    zipCode: '',
    homePhone: '',
    email: '',
    diagnosis: '',
    diet: '',
    allergies: '',
    physicianName: '',
    physicianPhone: '',
  }
}

function buildPatientProfileUpdatePayload(
  form: PatientProfileFormValues,
  patientName: string,
  facilityDisplayName: string | null | undefined,
  patientPhoto: string | null
): PatientProfileUpdatePayload {
  return {
    patient_name: patientName,
    date_of_birth: form.dateOfBirth,
    sex: form.sex as Patient['sex'],
    diagnosis: form.diagnosis.trim() || null,
    diet: form.diet.trim() || null,
    allergies: form.allergies.trim() || 'None',
    physician_name: form.physicianName.trim() || 'TBD',
    physician_phone: form.physicianPhone.trim() || null,
    facility_name: facilityDisplayName?.trim() || null,
    street_address: form.streetAddress.trim() || null,
    city: form.city.trim() || null,
    state: form.state.trim().toUpperCase() || null,
    zip_code: form.zipCode.trim() || null,
    home_phone: form.homePhone.trim() || null,
    email: form.email.trim() || null,
    admission_date: form.dateOfAdmission || null,
    patient_photo: patientPhoto,
  }
}

export default function EditPatientInfoModal({
  isOpen,
  patientId,
  mode = 'edit',
  title = 'Edit Patient Details',
  facilityDisplayName = null,
  recordNumber = null,
  readOnly = false,
  onClose,
  onSave,
  onSaved,
  loadingText = 'Loading patient details...',
  errorTitleId = 'edit-patient-info-title',
}: Props) {
  const [form, setForm] = useState<PatientProfileFormValues | null>(null)
  const [ageDisplay, setAgeDisplay] = useState('')
  const [patientPhoto, setPatientPhoto] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<PatientProfileFieldErrors>({})
  const [highlightedField, setHighlightedField] = useState<keyof PatientProfileFormValues | null>(null)
  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof PatientProfileFormValues, boolean>>>({})
  const saveInFlightRef = useRef(false)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetState = useCallback(() => {
    setForm(null)
    setAgeDisplay('')
    setPatientPhoto(null)
    setStep(1)
    setLoading(false)
    setSaving(false)
    setModalError('')
    setFieldErrors({})
    setHighlightedField(null)
    setTouchedFields({})
    saveInFlightRef.current = false
  }, [])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      resetState()
      return
    }

    if (mode === 'create') {
      setLoading(false)
      setModalError('')
      setForm(emptyPatientFormValues())
      setAgeDisplay('')
      setPatientPhoto(null)
      setStep(1)
      setFieldErrors({})
      setHighlightedField(null)
      setTouchedFields({})
      return
    }

    if (!patientId) {
      resetState()
      setModalError('This view is not linked to a patient record.')
      return
    }

    let cancelled = false
    setLoading(true)
    setModalError('')
    setForm(null)
    setAgeDisplay('')
    setPatientPhoto(null)
    setStep(1)
    setFieldErrors({})
    setHighlightedField(null)
    setTouchedFields({})

    void (async () => {
      try {
        const data = await rdsGetPatient(patientId)
        if (!data) throw new Error('Patient not found')
        if (cancelled) return

        const patient = data as Patient
        setForm(patientToProfileFormValues(patient))
        setPatientPhoto(patient.patient_photo ?? null)
        setAgeDisplay(computeAgeFromISODate(patient.date_of_birth?.slice(0, 10) || ''))
      } catch (err: unknown) {
        if (cancelled) return
        setModalError(err instanceof Error ? err.message : 'Failed to load patient')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, patientId, resetState, mode])

  if (!isOpen) return null

  const close = () => {
    if (saving) return
    onClose()
  }

  const scrollToFieldError = (field: keyof PatientProfileFormValues) => {
    const targetStep = PATIENT_PROFILE_FIELD_STEPS[field]
    if (targetStep) setStep(targetStep)
    setHighlightedField(field)

    window.setTimeout(() => {
      const el = document.getElementById(PATIENT_PROFILE_FIELD_IDS[field])
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      if (el instanceof HTMLElement) el.focus({ preventScroll: true })
    }, 80)

    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    highlightTimeoutRef.current = setTimeout(() => setHighlightedField(null), 1800)
  }

  const handleFieldChange = (field: keyof PatientProfileFormValues, value: string) => {
    const nextValue = field === 'homePhone' || field === 'physicianPhone'
      ? formatPatientPhoneInput(value)
      : field === 'zipCode'
        ? formatPatientZipInput(value)
        : value

    setForm((prev) => {
      if (!prev) return prev
      const next = { ...prev, [field]: nextValue }
      if (field === 'dateOfBirth') setAgeDisplay(computeAgeFromISODate(nextValue))
      return next
    })
    setTouchedFields((prev) => ({ ...prev, [field]: true }))
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      if (Object.keys(next).length === 0) setModalError('')
      return next
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    handleFieldChange(name as keyof PatientProfileFormValues, value)
  }

  const goToStep2 = () => {
    if (!form) return
    setModalError('')
    const step1Errors = validatePatientProfileWizardStep1Fields(form)
    const messages = patientProfileFieldErrorMessages(step1Errors)
    setFieldErrors(step1Errors)
    if (messages.length) {
      setModalError(messages.join(' '))
      return
    }
    setStep(2)
  }

  const handleSave = async () => {
    if (!form || saveInFlightRef.current) return
    if (mode === 'edit' && !patientId) return

    const firstName = form.firstName.trim()
    const middleName = form.middleName.trim()
    const lastName = form.lastName.trim()
    const patientName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()

    if (!firstName || !lastName || !patientName) {
      setFieldErrors((prev) => ({
        ...prev,
        ...(!firstName ? { firstName: 'First name is required.' } : {}),
        ...(!lastName ? { lastName: 'Last name is required.' } : {}),
      }))
      setModalError('First name and last name are required.')
      setStep(1)
      return
    }

    const saveErrors = validatePatientProfileForSave(form)
    const messages = patientProfileFieldErrorMessages(saveErrors)
    setFieldErrors(saveErrors)
    if (messages.length) {
      setModalError(messages.join(' '))
      if (Object.keys(validatePatientProfileWizardStep1Fields(form)).length > 0) {
        setStep(1)
      }
      return
    }

    const payload = buildPatientProfileUpdatePayload(form, patientName, facilityDisplayName, patientPhoto)
    saveInFlightRef.current = true
    setSaving(true)
    setModalError('')

    try {
      const updatedPatient = await onSave({ patientId: patientId ?? null, payload, form, patientName })
      onSaved?.(updatedPatient)
      onClose()
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to save patient information')
    } finally {
      setSaving(false)
      saveInFlightRef.current = false
    }
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={errorTitleId}
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h2 id={errorTitleId} className="shrink-0 text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400" aria-live="polite">
              Step {step} of 2
            </p>
            <div
              className="flex w-full shrink-0 gap-1.5 sm:w-44"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={2}
              aria-valuenow={step}
              aria-label="Patient information progress"
            >
              <div className={`h-2.5 flex-1 rounded-sm transition-colors ${step >= 1 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`} />
              <div className={`h-2.5 flex-1 rounded-sm transition-colors ${step >= 2 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`} />
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="shrink-0 text-gray-500 hover:text-gray-700 disabled:opacity-50 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close patient details modal"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="max-h-[80vh] overflow-y-auto px-6 py-5">
          {modalError && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {patientProfileFieldErrorMessages(fieldErrors).length ? (
                <PatientProfileFieldErrorChips fieldErrors={fieldErrors} onFieldClick={scrollToFieldError} />
              ) : (
                modalError
              )}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">{loadingText}</p>
          ) : form ? (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
              {mode === 'edit' && patientId && (
                <aside className="mx-auto shrink-0 lg:mx-0 lg:pt-1">
                  <PatientPhotoCaptureField
                    patientId={patientId}
                    value={patientPhoto}
                    onChange={setPatientPhoto}
                    disabled={saving}
                    readOnly={readOnly}
                  />
                </aside>
              )}
              <div className="min-w-0 flex-1">
                <PatientProfileFormFields
                  values={form}
                  onChange={handleInputChange}
                  ageDisplay={ageDisplay}
                  mode={{ type: 'wizard', step }}
                  disabled={saving}
                  recordNumber={recordNumber || ''}
                  facilityDisplayName={facilityDisplayName}
                  showCompletionChecks
                  editedFields={touchedFields}
                  fieldErrors={fieldErrors}
                  highlightedField={highlightedField}
                />
              </div>
            </div>
          ) : !modalError ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">Patient details could not be loaded.</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          {step === 2 && !loading && form && (
            <button
              type="button"
              onClick={() => {
                setModalError('')
                setStep(1)
              }}
              disabled={saving}
              className="mr-auto rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 sm:mr-0"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {!loading && form ? (
            step === 1 ? (
              <button
                type="button"
                onClick={goToStep2}
                disabled={saving}
                className="rounded-lg bg-lasso-navy px-4 py-2 text-white hover:bg-lasso-teal disabled:opacity-50"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-lasso-navy px-4 py-2 text-white hover:bg-lasso-teal disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving...' : mode === 'create' ? 'Add patient' : 'Save changes'}
              </button>
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}
