/** Split stored `patient_name` into parts for forms. */
export function parsePatientNameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] }
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1],
  }
}

export function computeAgeFromISODate(dobIso: string): string {
  if (!dobIso) return ''
  const birthDate = new Date(dobIso)
  if (Number.isNaN(birthDate.getTime())) return ''
  const today = new Date()
  let calculatedAge = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    calculatedAge--
  }
  return String(calculatedAge)
}
