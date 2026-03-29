interface PatientStickyBarProps {
  patientName?: string | null
  dateOfBirth?: string | null
  sex?: string | null
  recordNumber?: string | null
  className?: string
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
  className = '',
}: PatientStickyBarProps) {
  const formattedDob = dateOfBirth ? new Date(dateOfBirth).toLocaleDateString() : '—'

  return (
    <div className={`no-print sticky top-0 z-40 w-full bg-lasso-navy text-white border-b border-lasso-blue/30 ${className}`.trim()}>
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
        </div>
        <div className="text-xs font-semibold">
          <span className="uppercase tracking-wide text-lasso-blue/90 mr-2">Record No.</span>
          <span>{recordNumber || '—'}</span>
        </div>
      </div>
    </div>
  )
}
