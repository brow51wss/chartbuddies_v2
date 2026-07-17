import React from 'react'
import type { Patient } from '../types/auth'
import { formatCalendarDate } from '../lib/calendarDate'

/** Public URL when `patient_photo` is empty (sync with `public/images/`). */
export const PATIENT_SUMMARY_PHOTO_PLACEHOLDER = '/images/patient-photo-placeholder.png'

export type PatientSummaryCardPatient = Pick<
  Patient,
  'patient_name' | 'date_of_birth' | 'created_at' | 'diagnosis'
> & {
  patient_photo?: string | null
  sex?: 'Male' | 'Female' | 'Other' | null
  home_phone?: string | null
}

type Props = {
  patient: PatientSummaryCardPatient
  /** When false, the name line is omitted (e.g. binder where the page title already shows the name). */
  showPatientName?: boolean
  /** Use `h2` under a page `h1` (e.g. binder); `h3` in dashboard card grid. Ignored when `showPatientName` is false. */
  nameHeading?: 'h2' | 'h3'
  /** Show the "Date added" row. Defaults to true. */
  showDateAdded?: boolean
  /** Show the "Diagnosis" row. Defaults to true. */
  showDiagnosis?: boolean
  /** Show the "DOB" row. Defaults to true. */
  showDob?: boolean
  /** Show the "Sex" row. Defaults to false. */
  showSex?: boolean
  /** Show the "Phone" row. Defaults to false. */
  showPhone?: boolean
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
  showDateAdded = true,
  showDiagnosis = true,
  showDob = true,
  showSex = false,
  showPhone = false,
  footer,
  as: Root = 'div',
  'aria-label': ariaLabel,
  className = '',
}: Props) {
  const rawPhoto = patient.patient_photo?.trim()
  const photoSrc = rawPhoto
    ? rawPhoto.startsWith('s3:')
      ? `/api/signature-image?key=${encodeURIComponent(rawPhoto.slice(3))}`
      : rawPhoto
    : PATIENT_SUMMARY_PHOTO_PLACEHOLDER

  const nameParts = patient.patient_name.trim().split(/\s+/)
  const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0]
  const lastName  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

  const nameClass =
    'mt-3 w-full text-center text-xl font-normal leading-snug text-gray-900 dark:text-white'

  const nameContent = (
    <>
      <span className="block">{firstName}</span>
      {lastName && <span className="block">{lastName}</span>}
    </>
  )

  const inner = (
    <>
      <div className="flex w-full flex-col items-center">
        <img
          src={photoSrc}
          alt={showPatientName ? '' : patient.patient_name}
          className="h-[100px] w-[100px] shrink-0 rounded-full object-cover border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-700"
        />
        {showPatientName &&
          (nameHeading === 'h2' ? (
            <h2 className={nameClass}>{nameContent}</h2>
          ) : (
            <h3 className={nameClass}>{nameContent}</h3>
          ))}
      </div>
      <dl className={`w-full divide-y divide-gray-100 dark:divide-gray-700 text-sm ${footer != null ? 'flex-1' : ''} ${showPatientName ? 'mt-4' : 'mt-3'}`}>
        {showDob && (
          <div className="flex items-center justify-between py-2">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              {/* Calendar / DOB icon */}
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              DOB
            </dt>
            <dd className="text-gray-800 dark:text-gray-200">{formatCalendarDate(patient.date_of_birth)}</dd>
          </div>
        )}
        {showSex && (
          <div className="flex items-center justify-between py-2">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              {/* Gender / person icon */}
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Sex
            </dt>
            <dd className="text-gray-800 dark:text-gray-200">
              {patient.sex || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
            </dd>
          </div>
        )}
        {showPhone && (
          <div className="flex items-center justify-between py-2">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
              {/* Phone icon */}
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Phone
            </dt>
            <dd className="text-gray-800 dark:text-gray-200">
              {patient.home_phone || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
            </dd>
          </div>
        )}
        {showDateAdded && (
          <div className="flex items-center justify-between py-2">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">Date added</dt>
            <dd className="text-gray-800 dark:text-gray-200">{formatCalendarDate(patient.created_at)}</dd>
          </div>
        )}
        {showDiagnosis && (
          <div className="flex items-start justify-between gap-4 py-2">
            <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Diagnosis</dt>
            <dd className="text-right break-words text-gray-800 dark:text-gray-200">
              {patient.diagnosis || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
            </dd>
          </div>
        )}
      </dl>
      {footer != null && (
        <div className="mt-4 flex justify-center border-t border-gray-100 pt-3 dark:border-gray-700">{footer}</div>
      )}
    </>
  )

  const rootClass = `flex flex-col items-center rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/90 ${className}`.trim()

  if (Root === 'section') {
    return (
      <section aria-label={ariaLabel} className={rootClass}>
        {inner}
      </section>
    )
  }
  return <div className={rootClass}>{inner}</div>
}
