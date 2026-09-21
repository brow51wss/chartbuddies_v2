import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import {
  parseLocalDateFromYMD,
  sanitizeFourDigitYearDate,
  ymdFromDateInput,
} from '../lib/calendarDate'

function digitsOnly(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, '').slice(0, maxLen)
}

function pad2(raw: string): string {
  if (!raw) return ''
  return raw.length === 1 ? raw.padStart(2, '0') : raw.slice(0, 2)
}

function partsFromYmd(value: string): { month: string; day: string; year: string } {
  const ymd = ymdFromDateInput(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { month: '', day: '', year: '' }
  const [year, month, day] = ymd.split('-')
  return { month, day, year }
}

function composeYmd(month: string, day: string, year: string): string | null {
  if (!month && !day && !year) return ''
  if (month.length !== 2 || day.length !== 2 || year.length !== 4) return null
  return `${year}-${month}-${day}`
}

const segmentCls =
  'bg-transparent border-0 p-0 text-sm text-gray-900 dark:text-white text-center tabular-nums focus:outline-none'

type Props = {
  id?: string
  value: string
  onChange: (ymd: string) => void
  min?: string
  max?: string
  disabled?: boolean
  className?: string
}

export default function NumericDateInput({
  id,
  value,
  onChange,
  min,
  max,
  disabled = false,
  className = '',
}: Props) {
  const monthRef = useRef<HTMLInputElement>(null)
  const dayRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const focusedRef = useRef(false)
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')

  useEffect(() => {
    if (focusedRef.current) return
    const next = partsFromYmd(value)
    setMonth(next.month)
    setDay(next.day)
    setYear(next.year)
  }, [value])

  function emitIfComplete(nextMonth: string, nextDay: string, nextYear: string) {
    const composed = composeYmd(nextMonth, nextDay, nextYear)
    if (composed === null) return
    if (composed === '') {
      onChange('')
      return
    }
    const valid = sanitizeFourDigitYearDate(composed, { min, max })
    if (valid === null) return
    onChange(valid)
  }

  function applyMonth(raw: string) {
    let next = digitsOnly(raw, 2)
    if (next.length === 2) {
      const n = parseInt(next, 10)
      if (n < 1) next = '01'
      if (n > 12) next = '12'
    }
    setMonth(next)
    emitIfComplete(next, day, year)
    if (next.length === 2) dayRef.current?.focus()
  }

  function applyDay(raw: string) {
    let next = digitsOnly(raw, 2)
    if (next.length === 2) {
      const n = parseInt(next, 10)
      if (n < 1) next = '01'
      if (n > 31) next = '31'
    }
    setDay(next)
    emitIfComplete(month, next, year)
    if (next.length === 2) yearRef.current?.focus()
  }

  function applyYear(raw: string) {
    const next = digitsOnly(raw, 4)
    setYear(next)
    emitIfComplete(month, day, next)
  }

  function handleGroupBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    focusedRef.current = false
    const nextMonth = pad2(month)
    const nextDay = pad2(day)
    setMonth(nextMonth)
    setDay(nextDay)
    if (year.length !== 4) {
      const fallback = partsFromYmd(value)
      setYear(fallback.year)
      setMonth(fallback.month || nextMonth)
      setDay(fallback.day || nextDay)
      return
    }
    const composed = composeYmd(nextMonth, nextDay, year)
    if (composed === null) return
    const valid = sanitizeFourDigitYearDate(composed, { min, max })
    if (valid === null) {
      const fallback = partsFromYmd(value)
      setMonth(fallback.month)
      setDay(fallback.day)
      setYear(fallback.year)
      return
    }
    const parsed = parseLocalDateFromYMD(valid)
    if (!parsed) {
      const fallback = partsFromYmd(value)
      setMonth(fallback.month)
      setDay(fallback.day)
      setYear(fallback.year)
      return
    }
    onChange(valid)
  }

  function blockNonDigits(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
    }
  }

  function onSegmentFocus() {
    focusedRef.current = true
  }

  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      onFocus={onSegmentFocus}
      onBlur={handleGroupBlur}
    >
      <input
        ref={monthRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        disabled={disabled}
        aria-label="Month"
        placeholder="MM"
        value={month}
        onKeyDown={blockNonDigits}
        onChange={e => applyMonth(e.target.value)}
        className={`${segmentCls} w-[2.25ch]`}
      />
      <span className="text-gray-400 select-none">/</span>
      <input
        ref={dayRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={2}
        disabled={disabled}
        aria-label="Day"
        placeholder="DD"
        value={day}
        onKeyDown={blockNonDigits}
        onChange={e => applyDay(e.target.value)}
        className={`${segmentCls} w-[2.25ch]`}
      />
      <span className="text-gray-400 select-none">/</span>
      <input
        ref={yearRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        disabled={disabled}
        aria-label="Year"
        placeholder="YYYY"
        value={year}
        onKeyDown={blockNonDigits}
        onChange={e => applyYear(e.target.value)}
        className={`${segmentCls} w-[4.5ch]`}
      />
      <button
        type="button"
        disabled={disabled}
        aria-label="Open calendar"
        onClick={() => pickerRef.current?.showPicker?.() ?? pickerRef.current?.click()}
        className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 disabled:opacity-40"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z" />
        </svg>
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        min={min}
        max={max}
        value={ymdFromDateInput(value)}
        onChange={e => {
          const next = sanitizeFourDigitYearDate(e.target.value, { min, max })
          if (next === null) return
          const parts = partsFromYmd(next)
          setMonth(parts.month)
          setDay(parts.day)
          setYear(parts.year)
          onChange(next)
        }}
        className="sr-only"
      />
    </div>
  )
}
