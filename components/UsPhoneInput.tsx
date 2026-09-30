import type { KeyboardEvent } from 'react'
import { formatPatientPhoneInput } from '../lib/patientProfileWizardValidation'

function isAllowedPhoneKey(e: KeyboardEvent<HTMLInputElement>): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (e.key.length !== 1) return true
  return /^\d$/.test(e.key)
}

type Props = {
  id?: string
  name?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
  className?: string
  placeholder?: string
  autoComplete?: string
}

export default function UsPhoneInput({
  id,
  name,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  placeholder = '(555) 555-5555',
  autoComplete = 'tel',
}: Props) {
  return (
    <input
      type="tel"
      id={id}
      name={name}
      value={formatPatientPhoneInput(value)}
      onChange={(e) => onChange(formatPatientPhoneInput(e.target.value))}
      onKeyDown={(e) => {
        if (!isAllowedPhoneKey(e)) e.preventDefault()
      }}
      onPaste={(e) => {
        e.preventDefault()
        onChange(formatPatientPhoneInput(e.clipboardData.getData('text')))
      }}
      disabled={disabled}
      required={required}
      inputMode="numeric"
      autoComplete={autoComplete}
      maxLength={14}
      placeholder={placeholder}
      className={className}
    />
  )
}
