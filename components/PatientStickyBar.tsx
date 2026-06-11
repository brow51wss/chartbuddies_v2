import { useEffect, useState } from 'react'
import { formatCalendarDate } from '../lib/calendarDate'
import { parsePatientNameParts, computeAgeFromISODate } from '../lib/patientName'
import { rdsGetPatient } from '../lib/rdsApi'
import type { Patient } from '../types/auth'

const TOGGLE_PATIENT_STICKY_BAR_EVENT = 'lasso:toggle-patient-sticky-bar'

export function togglePatientStickyBar() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(TOGGLE_PATIENT_STICKY_BAR_EVENT))
}

interface PatientStickyBarProps {
  patientId?: string | null
  patientName?: string | null
  dateOfBirth?: string | null
  sex?: string | null
  recordNumber?: string | null
  allergies?: string | null
  className?: string
  /** When set, shows a control that opens the host page’s edit-patient flow (e.g. MAR “Edit Patient Details” modal). */
  onEditPatient?: () => void
  editPatientLabel?: string
}

function displayValue(value?: string | null) {
  const trimmed = String(value ?? '').trim()
  return trimmed || '—'
}

function InfoCard({
  label,
  value,
  className = '',
}: {
  label: string
  value?: string | null
  className?: string
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-4 ${className}`.trim()}>
      <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-lasso-blue/90">{label}</dt>
      <dd className="whitespace-pre-wrap break-words font-medium text-white">{displayValue(value)}</dd>
    </div>
  )
}

/**
 * Shared patient information drawer used across modules.
 * Keep styling/behavior centralized here so updates apply everywhere.
 */
export default function PatientStickyBar({
  patientId,
  patientName,
  dateOfBirth,
  sex,
  recordNumber,
  allergies,
  className = '',
  onEditPatient,
  editPatientLabel = 'Edit Patient Details',
}: PatientStickyBarProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [patientDetails, setPatientDetails] = useState<Patient | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  const resolvedPatientName = patientDetails?.patient_name ?? patientName ?? null
  const resolvedDateOfBirth = patientDetails?.date_of_birth ?? dateOfBirth ?? null
  const resolvedSex = patientDetails?.sex ?? sex ?? null
  const resolvedRecordNumber = patientDetails?.record_number ?? recordNumber ?? null
  const resolvedAllergies = patientDetails?.allergies ?? allergies ?? null
  const nameParts = parsePatientNameParts(resolvedPatientName || '')
  const formattedDob = resolvedDateOfBirth ? formatCalendarDate(resolvedDateOfBirth) : '—'
  const formattedAdmissionDate = patientDetails?.admission_date ? formatCalendarDate(patientDetails.admission_date) : '—'
  const ageDisplay = resolvedDateOfBirth ? computeAgeFromISODate(resolvedDateOfBirth.slice(0, 10)) : ''
  const normalizedAllergies = (resolvedAllergies ?? '').trim() || 'None'

  useEffect(() => {
    const handleToggle = () => {
      setIsVisible((current) => !current)
    }
    window.addEventListener(TOGGLE_PATIENT_STICKY_BAR_EVENT, handleToggle)
    return () => window.removeEventListener(TOGGLE_PATIENT_STICKY_BAR_EVENT, handleToggle)
  }, [])

  useEffect(() => {
    if (!isVisible || !patientId) return

    let cancelled = false
    setLoadingDetails(true)
    setDetailsError('')

    void (async () => {
      try {
        const data = await rdsGetPatient(patientId)
        if (!cancelled) setPatientDetails((data as Patient) ?? null)
      } catch (err) {
        if (!cancelled) {
          setDetailsError(err instanceof Error ? err.message : 'Failed to load full patient details.')
        }
      } finally {
        if (!cancelled) setLoadingDetails(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isVisible, patientId])

  const closePanel = () => {
    setIsVisible(false)
  }

  return (
    <>
      <aside
        className={`no-print fixed right-[2.5vw] top-[2.5vh] z-[2147483647] h-[95vh] w-[85vw] max-w-[800px] overflow-hidden rounded-2xl border border-gray-700 bg-gray-800 text-white shadow-2xl transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-[calc(100%+5vw)] pointer-events-none'
        } ${className}`.trim()}
        aria-hidden={!isVisible}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-4 sm:px-5">
            <button
              type="button"
              onClick={closePanel}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close patient info"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {onEditPatient && (
              <button
                type="button"
                onClick={() => {
                  closePanel()
                  onEditPatient()
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lasso-teal/60 bg-lasso-teal/10 px-3 py-1.5 text-sm font-medium text-lasso-teal transition-colors hover:bg-lasso-teal hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {editPatientLabel}
              </button>
            )}
          </div>

          <div className="patient-info-drawer-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            {loadingDetails && (
              <div className="mb-4 rounded-lg border border-lasso-blue/30 bg-lasso-blue/10 px-4 py-3 text-sm font-medium text-lasso-blue">
                Loading full patient information...
              </div>
            )}
            {detailsError && (
              <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200">
                Could not load the full patient record. Showing available patient information.
              </div>
            )}

            <div className="mb-5 flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center">
              {patientDetails?.patient_photo ? (
                <img
                  src={
                    patientDetails.patient_photo.startsWith('s3:')
                      ? `/api/signature-image?key=${encodeURIComponent(patientDetails.patient_photo.slice(3))}`
                      : patientDetails.patient_photo
                  }
                  alt={`${resolvedPatientName || 'Patient'} photo`}
                  className="h-24 w-24 shrink-0 rounded-full border border-white/20 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/60">
                  <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0ZM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7Z" />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-lasso-blue/90">Full Name</p>
                <p className="break-words text-2xl font-semibold text-white">{resolvedPatientName || 'Unknown Patient'}</p>
                <p className="mt-1 text-sm font-medium text-white/70">
                  Record No. {displayValue(resolvedRecordNumber)}
                </p>
              </div>
            </div>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Basic Information</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <InfoCard label="First name" value={nameParts.firstName} />
                <InfoCard label="Middle name" value={nameParts.middleName} />
                <InfoCard label="Last name" value={nameParts.lastName} />
                <InfoCard label="Date of birth" value={formattedDob} />
                <InfoCard label="Age" value={ageDisplay} />
                <InfoCard label="Sex" value={resolvedSex} />
                <InfoCard label="Date of admission" value={formattedAdmissionDate} />
                <InfoCard label="Record No." value={resolvedRecordNumber} />
              </dl>
            </section>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Contact Information</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <InfoCard label="Street address" value={patientDetails?.street_address} className="sm:col-span-2" />
                <InfoCard label="City" value={patientDetails?.city} />
                <InfoCard label="State" value={patientDetails?.state} />
                <InfoCard label="ZIP code" value={patientDetails?.zip_code} />
                <InfoCard label="Home phone" value={patientDetails?.home_phone} />
                <InfoCard label="Email" value={patientDetails?.email} className="sm:col-span-2" />
              </dl>
            </section>

            <section className="mb-6">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Clinical Information</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <InfoCard label="Diagnosis" value={patientDetails?.diagnosis} />
                <InfoCard label="Diet" value={patientDetails?.diet} />
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
                  <dt className="mb-1 text-xs font-semibold uppercase tracking-wide text-lasso-blue/90">Allergies</dt>
                  <dd className="flex min-w-0 flex-wrap items-center gap-2 whitespace-pre-wrap break-words font-medium text-white">
                    <span>{normalizedAllergies}</span>
                  </dd>
                </div>
              </dl>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/70">Physician & Facility</h3>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <InfoCard label="Physician" value={patientDetails?.physician_name} />
                <InfoCard label="Physician phone" value={patientDetails?.physician_phone} />
                <InfoCard label="Facility" value={patientDetails?.facility_name} className="sm:col-span-2" />
              </dl>
            </section>
          </div>
        </div>
      </aside>

      <style jsx>{`
        .patient-info-drawer-scroll {
          scrollbar-color: #ffffff #1f2937;
        }

        .patient-info-drawer-scroll::-webkit-scrollbar {
          width: 12px;
        }

        .patient-info-drawer-scroll::-webkit-scrollbar-track {
          background: #1f2937;
        }

        .patient-info-drawer-scroll::-webkit-scrollbar-thumb {
          background: #ffffff;
          border-radius: 9999px;
          border: 3px solid #1f2937;
        }
      `}</style>
    </>
  )
}
