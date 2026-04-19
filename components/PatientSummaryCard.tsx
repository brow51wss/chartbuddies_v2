import React from 'react'
import type { Patient } from '../types/auth'
import { formatCalendarDate } from '../lib/calendarDate'

/** Public URL when `patient_photo` is empty (sync with `public/images/`). */
export const PATIENT_SUMMARY_PHOTO_PLACEHOLDER = '/images/patient-photo-placeholder.png'

export type PatientSummaryCardPatient = Pick<
  Patient,
  'patient_name' | 'patient_photo' | 'date_of_birth' | 'created_at' | 'diagnosis'
>

type Props = {
  patient: PatientSummaryCardPatient
  /** When false, the name line is omitted (e.g. binder where the page title already shows the name). */
  showPatientName?: boolean
  /** Use `h2` under a page `h1` (e.g. binder); `h3` in dashboard card grid. Ignored when `showPatientName` is false. */
  nameHeading?: 'h2' | 'h3'
  /** Optional footer row (e.g. Open / edit / delete on dashboard). */
  footer?: React.ReactNode
  /** Root element for semantics (binder uses `section`). */
  as?: 'div' | 'section'
  'aria-label'?: string
  className?: string
}

export function PatientSummaryCard({
  patient,
  showPatientName = true,
  nameHeading = 'h3',
  footer,
  as: Root = 'div',
  'aria-label': ariaLabel,
  className = '',
}: Props) {
  const photoSrc =
    patient.patient_photo && patient.patient_photo.trim().length > 0
      ? patient.patient_photo
      : PATIENT_SUMMARY_PHOTO_PLACEHOLDER

  const nameClass =
    'mt-3 w-full text-center text-base font-semibold leading-snug text-gray-900 dark:text-white'

  const inner = (
    <>
      <div className="flex w-full flex-col items-center">
        <img
          src={photoSrc}
          alt={showPatientName ? '' : patient.patient_name}
          className="h-16 w-16 shrink-0 rounded-full object-cover border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
        />
        {showPatientName &&
          (nameHeading === 'h2' ? (
            <h2 className={nameClass}>{patient.patient_name}</h2>
          ) : (
            <h3 className={nameClass}>{patient.patient_name}</h3>
          ))}
      </div>
      <dl className={`w-full flex-1 space-y-5 text-center text-sm ${showPatientName ? 'mt-4' : 'mt-3'}`}>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Date of birth
          </dt>
          <dd className="mt-1 text-gray-800 dark:text-gray-200">{formatCalendarDate(patient.date_of_birth)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Date added</dt>
          <dd className="mt-1 text-gray-800 dark:text-gray-200">{formatCalendarDate(patient.created_at)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Diagnosis</dt>
          <dd className="mt-1 break-words text-gray-800 dark:text-gray-200">
            {patient.diagnosis || (
              <span className="text-gray-400 dark:text-gray-500 italic">N/A</span>
            )}
          </dd>
        </div>
      </dl>
      {footer != null && (
        <div className="mt-4 flex justify-center border-t border-gray-100 pt-3 dark:border-gray-700">{footer}</div>
      )}
    </>
  )

  const rootClass = `flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800/90 ${className}`.trim()

  if (Root === 'section') {
    return (
      <section aria-label={ariaLabel} className={rootClass}>
        {inner}
      </section>
    )
  }
  return <div className={rootClass}>{inner}</div>
}
