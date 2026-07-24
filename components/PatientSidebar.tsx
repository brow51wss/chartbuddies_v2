import React from 'react'
import Link from 'next/link'
import { PatientSummaryCard, type PatientSummaryCardPatient } from './PatientSummaryCard'

export type PatientSidebarModule = 'mar' | 'progress-notes'

type Props = {
  patient: PatientSummaryCardPatient
  activeModule: PatientSidebarModule
  /** Direct href for the MAR button (e.g. /patients/[id]/mar/[marId]) */
  marHref?: string
  /** Direct href for the Progress Notes button (e.g. /patients/[id]/progress-notes/view?month=...) */
  progressNotesHref?: string
}

const NAV_ITEMS: { id: PatientSidebarModule; label: string; emoji: string }[] = [
  { id: 'mar',             label: 'MAR',             emoji: '💊' },
  { id: 'progress-notes',  label: 'Progress Notes',  emoji: '📝' },
]

/**
 * PatientSidebar — sticky left-column panel used inside module pages.
 *
 * Contains the Patient Card and the Module Nav.
 * Positioning (sticky, width, gap) is owned by the parent grid column.
 *
 * Used on: MAR, Progress Notes (and any future module page that follows this pattern).
 */
export function PatientSidebar({ patient, activeModule, marHref, progressNotesHref }: Props) {
  const hrefs: Record<PatientSidebarModule, string | undefined> = {
    mar: marHref,
    'progress-notes': progressNotesHref,
  }

  return (
    <div className="flex flex-col gap-3">
      <PatientSummaryCard
        patient={patient}
        showPatientName
        showSex
        showDateAdded={false}
        nameHeading="h2"
      />

      {/* Module Nav */}
      <nav className="flex flex-col gap-1.5">
        {NAV_ITEMS.map(({ id, label, emoji }) => {
          const isActive = id === activeModule
          const href = hrefs[id]

          const baseClass =
            'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors'
          const activeClass = 'font-semibold bg-lasso-navy text-white shadow-sm'
          const inactiveClass =
            'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'

          if (isActive) {
            return (
              <button
                key={id}
                type="button"
                aria-current="page"
                className={`${baseClass} ${activeClass}`}
              >
                {emoji} {label}
              </button>
            )
          }

          return (
            <Link
              key={id}
              href={href ?? '#'}
              className={`${baseClass} ${inactiveClass}`}
            >
              {emoji} {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
