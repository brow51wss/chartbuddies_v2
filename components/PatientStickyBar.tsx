import { useState } from 'react'

interface PatientStickyBarProps {
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

/**
 * Shared sticky patient identity bar used across modules.
 * Keep styling/behavior centralized here so updates apply everywhere.
 */
export default function PatientStickyBar({
  patientName,
  dateOfBirth,
  sex,
  recordNumber,
  allergies,
  className = '',
  onEditPatient,
  editPatientLabel = 'Edit patient',
}: PatientStickyBarProps) {
  const formattedDob = dateOfBirth ? new Date(dateOfBirth).toLocaleDateString() : '—'
  const [showAllergiesModal, setShowAllergiesModal] = useState(false)
  const normalizedAllergies = (allergies ?? '').trim() || 'None'
  const ALLERGY_PREVIEW_LIMIT = 38
  const shouldTruncateAllergies = normalizedAllergies.length > ALLERGY_PREVIEW_LIMIT
  const allergiesPreview = shouldTruncateAllergies
    ? `${normalizedAllergies.slice(0, ALLERGY_PREVIEW_LIMIT)}...`
    : normalizedAllergies

  return (
    <>
      <div className={`no-print sticky top-0 z-[99999] w-full bg-lasso-navy text-white border-b border-lasso-blue/30 ${className}`.trim()}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
            <span>
              <span className="uppercase tracking-wide text-lasso-blue/90 mr-2">Name</span>
              <span>{patientName || 'Unknown Patient'}</span>
            </span>
            <span>
              <span className="uppercase tracking-wide text-lasso-blue/90 mr-2">DOB</span>
              <span>{formattedDob}</span>
            </span>
            <span>
              <span className="uppercase tracking-wide text-lasso-blue/90 mr-2">Sex</span>
              <span>{sex || '—'}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 min-w-0 max-w-[360px]">
              <span className="uppercase tracking-wide text-lasso-blue/90 mr-0.5 shrink-0">Allergies</span>
              <span className="truncate">{allergiesPreview}</span>
              {shouldTruncateAllergies && (
                <button
                  type="button"
                  onClick={() => setShowAllergiesModal(true)}
                  className="text-lasso-blue/90 hover:text-lasso-blue underline underline-offset-2 shrink-0"
                >
                  MORE
                </button>
              )}
            </span>
          </div>
          <div className="text-xs font-semibold flex items-center gap-3 sm:gap-4 shrink-0">
            {onEditPatient && (
              <button
                type="button"
                onClick={onEditPatient}
                className="text-lasso-blue/90 hover:text-lasso-blue underline underline-offset-2 whitespace-nowrap"
              >
                {editPatientLabel}
              </button>
            )}
            <div className="h-4 w-px bg-white/25 hidden sm:block" aria-hidden />
            <span>
              <span className="uppercase tracking-wide text-lasso-blue/90 mr-2">Record No.</span>
              <span>{recordNumber || '—'}</span>
            </span>
          </div>
        </div>
      </div>

      {showAllergiesModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Patient Allergies</h3>
              <button
                type="button"
                onClick={() => setShowAllergiesModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close allergies modal"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {normalizedAllergies}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAllergiesModal(false)}
                className="rounded-lg bg-lasso-navy px-4 py-2 text-sm font-medium text-white hover:bg-lasso-teal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
