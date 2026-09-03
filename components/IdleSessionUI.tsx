function formatClock(remainingMs: number): string {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000))
  const m = Math.floor(sec / 60)
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}

export function IdleSessionChip({ remainingMs }: { remainingMs: number }) {
  const urgent = remainingMs <= 60 * 1000
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${
        urgent
          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
      }`}
      title="Your session will expire due to inactivity"
    >
      Session {formatClock(remainingMs)}
    </span>
  )
}

export function IdleSessionModal({
  displayName,
  remainingMs,
  onStay,
}: {
  displayName: string
  remainingMs: number
  onStay: () => void
}) {
  const sec = Math.max(0, Math.ceil(remainingMs / 1000))
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <h2 id="idle-warning-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Session expiring
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          <span className="font-bold text-gray-900 dark:text-white">{displayName}</span>
          , your session will expire in{' '}
          <span className="font-bold text-red-600 tabular-nums">{sec}s</span>
          {' '}due to inactivity.
        </p>
        <button
          type="button"
          onClick={onStay}
          className="w-full px-4 py-2 bg-lasso-teal text-white rounded-lg hover:bg-lasso-navy font-medium"
        >
          Stay logged in
        </button>
      </div>
    </div>
  )
}
