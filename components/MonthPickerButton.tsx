import React, { useState, useCallback } from 'react'

export type MonthPickerItem = {
  id: string
  label: string
  isCurrent: boolean
  onClick: () => void
}

type Props = {
  /** Label shown on the trigger button, e.g. "July 2026" */
  currentLabel: string
  /**
   * Called once when the modal first opens.
   * Should return all available months for this patient/module.
   */
  loadMonths: () => Promise<MonthPickerItem[]>
  /** 'md' (default) matches MAR table header; 'sm' suits inline page headings */
  size?: 'sm' | 'md'
  /** Extra classes on the trigger button */
  className?: string
}

export function MonthPickerButton({ currentLabel, loadMonths, size = 'md', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [months, setMonths] = useState<MonthPickerItem[] | null>(null)

  const handleOpen = useCallback(async () => {
    setOpen(true)
    if (months !== null) return
    setLoading(true)
    try {
      const result = await loadMonths()
      setMonths(result)
    } finally {
      setLoading(false)
    }
  }, [months, loadMonths])

  const handleClose = () => setOpen(false)

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className={`flex items-center gap-1.5 font-medium text-gray-800 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
          size === 'sm'
            ? 'text-sm px-2.5 py-1'
            : 'text-lg px-3 py-1.5'
        } ${className}`}
      >
        {currentLabel}
        <svg
          className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200]"
          onClick={handleClose}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Go to Month</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Select a month to navigate to</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4">
              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lasso-teal" />
                </div>
              ) : !months || months.length === 0 ? (
                <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">No months found.</p>
              ) : (
                <div className="flex flex-wrap gap-2 justify-center">
                  {months.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={item.isCurrent}
                      onClick={() => {
                        handleClose()
                        item.onClick()
                      }}
                      className={`rounded border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-lasso-teal ${
                        item.isCurrent
                          ? 'border-lasso-teal/60 bg-lasso-teal/10 text-lasso-teal cursor-default'
                          : 'border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-400 dark:hover:border-gray-500 cursor-pointer'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
