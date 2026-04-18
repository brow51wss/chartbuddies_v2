import type { MARMedication, MARAdministration } from '../types/mar'
import { parseLocalDateFromYMD } from './calendarDate'

/**
 * True when this MAR row’s start/stop range includes the calendar day for the given MAR month column.
 * Matches MAR grid logic; applies to both routine meds and vitals rows.
 */
export function isMarRowActiveOnDayColumn(
  med: MARMedication,
  day: number,
  formYear: number,
  formMonth1Based: number
): boolean {
  const formMonthIndex = formMonth1Based - 1
  const medStartDate = parseLocalDateFromYMD(med.start_date)
  const medStopDate = med.stop_date ? parseLocalDateFromYMD(med.stop_date) : null
  if (!medStartDate) return false
  const startDayOfMonth = medStartDate.getDate()
  const isStartInFormMonth =
    medStartDate.getMonth() === formMonthIndex && medStartDate.getFullYear() === formYear
  const isStartBeforeFormMonth =
    medStartDate.getFullYear() < formYear ||
    (medStartDate.getFullYear() === formYear && medStartDate.getMonth() < formMonthIndex)
  const currentDayDate = new Date(formYear, formMonthIndex, day)
  if (currentDayDate.getDate() !== day || currentDayDate.getMonth() !== formMonthIndex) return false
  if (isStartInFormMonth) {
    return day >= startDayOfMonth && (!medStopDate || currentDayDate <= medStopDate)
  }
  if (isStartBeforeFormMonth) {
    return !medStopDate || currentDayDate <= medStopDate
  }
  return false
}

export function getMarDiscontinuedBeforeDayInfo(
  medAdmin: { [day: number]: MARAdministration | undefined },
  day: number,
  isVitalsEntry: boolean
): { isDiscontinued: boolean; dcDay: number | null } {
  if (isVitalsEntry) return { isDiscontinued: false, dcDay: null }
  for (let checkDay = 1; checkDay < day; checkDay++) {
    const checkAdmin = medAdmin[checkDay]
    const checkRaw = checkAdmin?.initials ?? ''
    if (!checkRaw.startsWith('data:image') && checkRaw.trim().toUpperCase() === 'DC') {
      return { isDiscontinued: true, dcDay: checkDay }
    }
  }
  return { isDiscontinued: false, dcDay: null }
}

export function isDiscontinuedBeforeMedDay(
  medAdmin: { [day: number]: MARAdministration | undefined },
  day: number,
  isVitalsEntry: boolean
): boolean {
  return getMarDiscontinuedBeforeDayInfo(medAdmin, day, isVitalsEntry).isDiscontinued
}

/**
 * Cell is “empty” (shows —) and should be documented: active day, not post-DC, no DC/R/H/PRN/Given value yet.
 * Drawn initials/signatures are stored as `data:image/...` — those must count as documented (not empty).
 */
export function isMarAdminCellDocumentationMissing(
  admin: MARAdministration | undefined,
  isMedActive: boolean,
  isDiscontinued: boolean
): boolean {
  if (!isMedActive || isDiscontinued) return false
  const status = admin?.status || 'Not Given'
  const rawInitials = admin?.initials ?? ''
  if (rawInitials.startsWith('data:image') && rawInitials.length > 0) return false
  const initialsForLogic = rawInitials.trim()
  const isNotGiven = status === 'Not Given'
  const isGiven = status === 'Given'
  const isDC = initialsForLogic.toUpperCase() === 'DC'
  if (isDC) return false
  if (isNotGiven && !initialsForLogic) return true
  if (isGiven && !initialsForLogic) return true
  return false
}

/** Parse med `hour` string into a local Date on the given calendar day (MAR column). */
export function parseMarHourToLocalDate(
  formYear: number,
  formMonth1Based: number,
  day: number,
  hourStr: string | null | undefined
): Date | null {
  if (!hourStr?.trim()) return null
  const s = hourStr.trim().replace(/[+-]\d{2}(:\d{2})?$/, '')
  const m12 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)\s*$/i)
  if (m12) {
    let h = parseInt(m12[1], 10)
    const min = parseInt(m12[2], 10)
    const ap = m12[3].toUpperCase()
    if (ap === 'PM' && h !== 12) h += 12
    if (ap === 'AM' && h === 12) h = 0
    return new Date(formYear, formMonth1Based - 1, day, h, min, 0, 0)
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m24) {
    const h = parseInt(m24[1], 10)
    const min = parseInt(m24[2], 10)
    return new Date(formYear, formMonth1Based - 1, day, h, min, 0, 0)
  }
  return null
}

/**
 * True if this administration slot can be “late” yet: any day before today in the MAR month, any past MAR month,
 * or today after the scheduled row time (local). Future days are false.
 */
export function isMarAdministrationSlotPastDue(
  formYear: number,
  formMonth1Based: number,
  day: number,
  hourStr: string | null | undefined,
  now: Date = new Date()
): boolean {
  const ty = now.getFullYear()
  const tm = now.getMonth() + 1
  const td = now.getDate()

  if (formYear > ty || (formYear === ty && formMonth1Based > tm)) return false
  if (formYear === ty && formMonth1Based === tm && day > td) return false

  if (formYear === ty && formMonth1Based === tm && day < td) return true

  const slotMidnight = new Date(formYear, formMonth1Based - 1, day)
  slotMidnight.setHours(0, 0, 0, 0)
  const todayMidnight = new Date(ty, tm - 1, td)
  todayMidnight.setHours(0, 0, 0, 0)
  if (slotMidnight.getTime() < todayMidnight.getTime()) return true

  if (formYear === ty && formMonth1Based === tm && day === td) {
    const slot = parseMarHourToLocalDate(ty, tm, td, hourStr)
    if (!slot) {
      return now.getTime() >= new Date(ty, tm - 1, td, 23, 59, 59, 999).getTime()
    }
    return now.getTime() >= slot.getTime()
  }

  return false
}

/**
 * Past/current MAR months: all days in the grid can be checked.
 * Current calendar month: only day columns ≤ today.
 * Future MAR month: none (nothing “missed” yet).
 */
export function isMarDayColumnEligibleForMissedCheck(
  formYear: number,
  formMonth1Based: number,
  day: number,
  now: Date = new Date()
): boolean {
  const ty = now.getFullYear()
  const tm = now.getMonth() + 1
  const td = now.getDate()
  if (formYear > ty || (formYear === ty && formMonth1Based > tm)) return false
  if (formYear === ty && formMonth1Based === tm) {
    return day <= td
  }
  return true
}

export type MissedMarDocItem = {
  medId: string
  day: number
  rowLabel: string
  dateLabel: string
}

export function computeMissedMarDocumentation(
  meds: MARMedication[],
  administrations: { [medId: string]: { [day: number]: MARAdministration } },
  formYear: number,
  formMonth1Based: number,
  days: readonly number[],
  formatTime: (hour: string | null) => string,
  now: Date = new Date()
): MissedMarDocItem[] {
  const items: MissedMarDocItem[] = []
  for (const med of meds) {
    const medAdmin = administrations[med.id] || {}
    const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
    const baseLabel = isVitalsEntry
      ? `Vitals (${[med.dosage, med.notes].filter(Boolean).join(' · ') || 'entry'})`
      : med.medication_name
    const timePart = med.hour ? formatTime(med.hour) : ''
    const rowLabel = timePart ? `${baseLabel} · ${timePart}` : baseLabel

    for (const day of days) {
      if (!isMarDayColumnEligibleForMissedCheck(formYear, formMonth1Based, day, now)) continue
      if (!isMarAdministrationSlotPastDue(formYear, formMonth1Based, day, med.hour, now)) continue
      const isMedActive = isMarRowActiveOnDayColumn(med, day, formYear, formMonth1Based)
      const isDiscontinued = isDiscontinuedBeforeMedDay(medAdmin, day, isVitalsEntry)
      const admin = medAdmin[day]
      if (!isMarAdminCellDocumentationMissing(admin, isMedActive, isDiscontinued)) continue
      const dateLabel = new Date(formYear, formMonth1Based - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
      items.push({ medId: med.id, day, rowLabel, dateLabel })
    }
  }
  items.sort((a, b) => a.day - b.day || a.rowLabel.localeCompare(b.rowLabel))
  return items
}
