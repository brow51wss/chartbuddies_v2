/**
 * Postgres `DATE` and `<input type="date">` values are calendar strings `YYYY-MM-DD`.
 * `new Date("YYYY-MM-DD")` parses as UTC midnight, which shifts the local calendar day
 * in timezones west of UTC. Use these helpers for display, defaults, and comparisons.
 */

export function ymdFromDateInput(raw: string | null | undefined): string {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  return s.includes('T') ? s.slice(0, 10) : s.slice(0, 10)
}

/**
 * Interprets `YYYY-MM-DD` as that calendar day in the runtime's local timezone
 * (anchored at local noon to avoid DST midnight edge cases).
 */
export function parseLocalDateFromYMD(raw: string | null | undefined): Date | null {
  const s = ymdFromDateInput(raw)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [ys, ms, ds] = s.split('-')
  const y = parseInt(ys, 10)
  const m = parseInt(ms, 10)
  const d = parseInt(ds, 10)
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

/** Today's calendar date in the runtime's local timezone (`YYYY-MM-DD`). */
export function localTodayYMD(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}

export function formatCalendarDate(
  raw: string | null | undefined,
  locales?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  const dt = parseLocalDateFromYMD(raw)
  if (!dt) {
    const t = raw != null ? String(raw).trim() : ''
    return t || '—'
  }
  return dt.toLocaleDateString(locales, options)
}
