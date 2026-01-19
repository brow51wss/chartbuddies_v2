import { useState, useEffect } from 'react'

interface TimeInputProps {
  value: string // Expected format: "HH:MM" (24-hour) or "H:MM AM/PM" (12-hour)
  onChange: (value: string) => void
  required?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  compact?: boolean // For smaller inline use
}

// Helper to parse various time formats into { hour12, minute, period }
const parseTimeValue = (value: string): { hour12: number; minute: number; period: 'AM' | 'PM' } => {
  if (!value || value.trim() === '') {
    return { hour12: 12, minute: 0, period: 'AM' }
  }

  // Clean up the value - trim whitespace and remove timezone suffix
  let cleanValue = value.trim()
  // Remove timezone suffix if present (e.g., "+00", "+00:00", "-05:00")
  cleanValue = cleanValue.replace(/[+-]\d{2}(:\d{2})?$/, '')

  // Try to parse 12-hour format first (e.g., "9:00 AM", "12:30 PM", "9:00AM")
  const match12 = cleanValue.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i)
  if (match12) {
    let hour = parseInt(match12[1], 10)
    const minute = parseInt(match12[2], 10)
    const period = match12[3].toUpperCase() as 'AM' | 'PM'
    // Normalize hour to 1-12 range
    if (hour === 0) hour = 12
    if (hour > 12) hour = hour - 12
    return { hour12: hour, minute, period }
  }

  // Try to parse 24-hour format (e.g., "09:00", "13:30", "00:00", "09:00:00")
  // Also handles formats with optional seconds
  const match24 = cleanValue.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (match24) {
    const hour24 = parseInt(match24[1], 10)
    const minute = parseInt(match24[2], 10)
    
    let hour12: number
    let period: 'AM' | 'PM'
    
    if (hour24 === 0) {
      hour12 = 12
      period = 'AM'
    } else if (hour24 === 12) {
      hour12 = 12
      period = 'PM'
    } else if (hour24 > 12) {
      hour12 = hour24 - 12
      period = 'PM'
    } else {
      hour12 = hour24
      period = 'AM'
    }
    
    return { hour12, minute, period }
  }

  // Try to parse just hour (e.g., "9", "14", "09")
  const matchHourOnly = cleanValue.match(/^(\d{1,2})$/)
  if (matchHourOnly) {
    const hour24 = parseInt(matchHourOnly[1], 10)
    
    let hour12: number
    let period: 'AM' | 'PM'
    
    if (hour24 === 0) {
      hour12 = 12
      period = 'AM'
    } else if (hour24 === 12) {
      hour12 = 12
      period = 'PM'
    } else if (hour24 > 12) {
      hour12 = hour24 - 12
      period = 'PM'
    } else {
      hour12 = hour24
      period = 'AM'
    }
    
    return { hour12, minute: 0, period }
  }

  // Try more flexible parsing - extract any numbers that look like time
  const flexMatch = cleanValue.match(/(\d{1,2})\s*[:\s]\s*(\d{2})/)
  if (flexMatch) {
    const hour24 = parseInt(flexMatch[1], 10)
    const minute = parseInt(flexMatch[2], 10)
    
    // Check if there's AM/PM anywhere in the string
    const hasAM = /am/i.test(cleanValue)
    const hasPM = /pm/i.test(cleanValue)
    
    let hour12: number
    let period: 'AM' | 'PM'
    
    if (hasAM || hasPM) {
      // 12-hour format with AM/PM indicator
      hour12 = hour24 > 12 ? hour24 - 12 : (hour24 === 0 ? 12 : hour24)
      period = hasPM ? 'PM' : 'AM'
    } else {
      // Assume 24-hour format
      if (hour24 === 0) {
        hour12 = 12
        period = 'AM'
      } else if (hour24 === 12) {
        hour12 = 12
        period = 'PM'
      } else if (hour24 > 12) {
        hour12 = hour24 - 12
        period = 'PM'
      } else {
        hour12 = hour24
        period = 'AM'
      }
    }
    
    return { hour12, minute, period }
  }

  // Default fallback
  return { hour12: 12, minute: 0, period: 'AM' }
}

// Format to 12-hour string (e.g., "9:00 AM")
const formatTime12 = (hour12: number, minute: number, period: 'AM' | 'PM'): string => {
  const paddedMinute = minute.toString().padStart(2, '0')
  return `${hour12}:${paddedMinute} ${period}`
}

export default function TimeInput({
  value,
  onChange,
  required = false,
  placeholder = 'Select time',
  className = '',
  disabled = false,
  compact = false
}: TimeInputProps) {
  const parsed = parseTimeValue(value)
  const [hour, setHour] = useState(parsed.hour12.toString())
  const [minute, setMinute] = useState(parsed.minute.toString().padStart(2, '0'))
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period)

  // Update internal state when value prop changes
  useEffect(() => {
    const newParsed = parseTimeValue(value)
    setHour(newParsed.hour12.toString())
    setMinute(newParsed.minute.toString().padStart(2, '0'))
    setPeriod(newParsed.period)
  }, [value])

  // Select all text on focus for easy overwriting
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select()
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setHour(val)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, max 2 chars - DON'T pad or normalize here, do it on blur
    let val = e.target.value.replace(/\D/g, '').slice(0, 2)
    setMinute(val)
  }

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto-advance to minute field when 2 digits entered or on Tab/Enter
    if (e.key === 'Tab' || e.key === 'Enter' || e.key === ':') {
      e.preventDefault()
      const nextInput = e.currentTarget.nextElementSibling?.nextElementSibling as HTMLInputElement
      if (nextInput) {
        nextInput.focus()
        nextInput.select()
      }
    }
  }

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Auto-advance to AM/PM toggle on Tab/Enter
    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault()
      handleMinuteBlur()
      // Focus the AM/PM button
      const ampmBtn = e.currentTarget.parentElement?.nextElementSibling?.querySelector('button') as HTMLButtonElement
      if (ampmBtn) ampmBtn.focus()
    }
  }

  const handleHourBlur = () => {
    // Normalize hour on blur
    let h = parseInt(hour, 10) || 12
    if (h < 1) h = 1
    if (h > 12) h = 12
    setHour(h.toString())
    
    // Emit the formatted time
    const m = parseInt(minute, 10) || 0
    onChange(formatTime12(h, m < 0 ? 0 : m > 59 ? 59 : m, period))
  }

  const handleMinuteBlur = () => {
    // Normalize minute on blur - pad with zeros
    let m = parseInt(minute, 10) || 0
    if (m < 0) m = 0
    if (m > 59) m = 59
    setMinute(m.toString().padStart(2, '0'))
    
    // Emit the formatted time
    const h = parseInt(hour, 10) || 12
    onChange(formatTime12(h < 1 ? 1 : h > 12 ? 12 : h, m, period))
  }

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM'
    setPeriod(newPeriod)
    const h = parseInt(hour, 10) || 12
    const m = parseInt(minute, 10) || 0
    onChange(formatTime12(h, m, newPeriod))
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <input
          type="text"
          inputMode="numeric"
          value={hour}
          onChange={handleHourChange}
          onFocus={handleFocus}
          onBlur={handleHourBlur}
          onKeyDown={handleHourKeyDown}
          disabled={disabled}
          placeholder="12"
          maxLength={2}
          className="w-8 text-center text-xs border border-gray-300 rounded px-1 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal"
        />
        <span className="text-gray-500 dark:text-gray-400">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={handleMinuteChange}
          onFocus={handleFocus}
          onBlur={handleMinuteBlur}
          onKeyDown={handleMinuteKeyDown}
          disabled={disabled}
          placeholder="00"
          maxLength={2}
          className="w-8 text-center text-xs border border-gray-300 rounded px-1 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal"
        />
        <button
          type="button"
          onClick={togglePeriod}
          disabled={disabled}
          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
            period === 'AM'
              ? 'bg-lasso-blue text-white'
              : 'bg-lasso-navy text-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
        >
          {period}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-white dark:bg-gray-700 focus-within:ring-2 focus-within:ring-lasso-teal focus-within:border-lasso-teal">
        <input
          type="text"
          inputMode="numeric"
          value={hour}
          onChange={handleHourChange}
          onFocus={handleFocus}
          onBlur={handleHourBlur}
          onKeyDown={handleHourKeyDown}
          disabled={disabled}
          placeholder="12"
          maxLength={2}
          className="w-12 text-center py-2 border-0 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-white"
        />
        <span className="text-gray-500 dark:text-gray-400 font-medium">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={handleMinuteChange}
          onFocus={handleFocus}
          onBlur={handleMinuteBlur}
          onKeyDown={handleMinuteKeyDown}
          disabled={disabled}
          placeholder="00"
          maxLength={2}
          className="w-12 text-center py-2 border-0 focus:outline-none focus:ring-0 dark:bg-gray-700 dark:text-white"
        />
      </div>
      
      <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
        <button
          type="button"
          onClick={() => {
            if (period !== 'AM') {
              setPeriod('AM')
              const h = parseInt(hour, 10) || 12
              const m = parseInt(minute, 10) || 0
              onChange(formatTime12(h, m, 'AM'))
            }
          }}
          disabled={disabled}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            period === 'AM'
              ? 'bg-lasso-blue text-white'
              : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          AM
        </button>
        <button
          type="button"
          onClick={() => {
            if (period !== 'PM') {
              setPeriod('PM')
              const h = parseInt(hour, 10) || 12
              const m = parseInt(minute, 10) || 0
              onChange(formatTime12(h, m, 'PM'))
            }
          }}
          disabled={disabled}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            period === 'PM'
              ? 'bg-lasso-navy text-white'
              : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          PM
        </button>
      </div>
    </div>
  )
}

// Export helper function to format time for display
export const formatTimeDisplay = (timeString: string): string => {
  if (!timeString) return ''
  const parsed = parseTimeValue(timeString)
  return formatTime12(parsed.hour12, parsed.minute, parsed.period)
}
