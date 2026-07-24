import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import AppHeader from '../../../../components/AppHeader'
import PatientStickyBar from '../../../../components/PatientStickyBar'
import EditPatientInfoModal, { type EditPatientInfoSaveArgs } from '../../../../components/EditPatientInfoModal'
import { supabase } from '../../../../lib/supabase'
import {
  rdsGetPatient,
  rdsListPatients,
  rdsPatchPatient,
  rdsListMarForms,
  rdsGetMarForm,
  rdsListProgressNotes,
  rdsCreateProgressNote,
  rdsPatchProgressNote,
  rdsDeleteProgressNote,
  rdsUpsertAdministration,
  rdsGetProgressNoteSummary,
  rdsGetLatestProgressNoteSummaryWeightUnit,
  rdsUpsertProgressNoteSummary,
  rdsPatchProgressNoteSummary,
} from '../../../../lib/rdsApi'
import { formatCalendarDate, localTodayYMD } from '../../../../lib/calendarDate'
import { getCurrentUserProfile } from '../../../../lib/auth'
import {
  isPatientRecordStep1Complete,
  PHYSICIAN_SELECTION_BLOCKED_HINT,
} from '../../../../lib/patientProfileWizardValidation'
import { useReadOnly } from '../../../../contexts/ReadOnlyContext'
import type { UserProfile, Patient } from '../../../../types/auth'
import type { ProgressNoteEntry, ProgressNoteMonthlySummary } from '../../../../types/progress-notes'

const SIGNATURE_FONTS_LINK_ID = 'progress-notes-signature-fonts'
function ensureSignatureFontsLoaded(font: string) {
  if (typeof document === 'undefined' || !font) return
  if (document.getElementById(SIGNATURE_FONTS_LINK_ID)) return
  const link = document.createElement('link')
  link.id = SIGNATURE_FONTS_LINK_ID
  link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Sacramento&display=swap'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
}

function InitialsOrSignatureDisplay({
  value,
  variant = 'initials',
  userProfile = null
}: {
  value: string | null
  variant?: 'initials' | 'signature'
  userProfile?: UserProfile | null
}) {
  if (!value) return <span>—</span>
  const font = userProfile?.staff_signature_font || 'Dancing Script'
  const initialsMatchProfile =
    !!userProfile?.staff_initials_text &&
    (value === userProfile?.staff_initials ||
      value?.trim().toUpperCase() === userProfile?.staff_initials_text?.trim().toUpperCase())
  const signatureMatchProfile =
    !!userProfile?.staff_signature_text &&
    (value === userProfile?.staff_signature ||
      value?.trim().toUpperCase() === userProfile?.staff_signature_text?.trim().toUpperCase())
  const showAsTextWithFont =
    variant === 'initials' ? initialsMatchProfile : signatureMatchProfile
  const displayText = variant === 'initials' ? userProfile?.staff_initials_text : userProfile?.staff_signature_text
  if (showAsTextWithFont && displayText) {
    ensureSignatureFontsLoaded(font)
    return (
      <span
        className={`lasso-signature-mark lasso-signature-mark--text lasso-signature-mark--${variant}`}
        style={{
          fontFamily: `"${font}", cursive`,
          fontSize: variant === 'initials' ? '1.1em' : '1.75em',
          verticalAlign: 'middle'
        }}
      >
        {displayText}
      </span>
    )
  }
  const imgSrc = value.startsWith('s3:')
    ? `/api/signature-image?key=${encodeURIComponent(value.slice(3))}`
    : value.startsWith('data:image') ? value : null
  if (imgSrc) {
    return (
      <>
        <img
          src={imgSrc}
          alt={variant === 'initials' ? 'Initials' : 'Signature'}
          className={`lasso-signature-mark lasso-signature-mark--image lasso-signature-mark--${variant}`}
          style={{ maxHeight: variant === 'initials' ? '1.25em' : '2.5em', maxWidth: variant === 'initials' ? '3em' : '12em', verticalAlign: 'middle', display: 'inline-block' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            const fb = e.currentTarget.nextSibling as HTMLElement
            if (fb) fb.style.removeProperty('display')
          }}
        />
        <span style={{ display: 'none' }} className="text-xs italic text-gray-400">—</span>
      </>
    )
  }
  return <span className={`lasso-signature-mark lasso-signature-mark--plain lasso-signature-mark--${variant}`}>{value}</span>
}

function parsePatientName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return {
    firstName: parts[0],
    lastName: parts[parts.length - 1]
  }
}

/** Parse query month string (e.g. "November 2025", "2025-11") to YYYY-MM. */
function parseMonthQuery(monthFromQuery: string | null): string | null {
  if (!monthFromQuery || !monthFromQuery.trim()) return null
  const raw = monthFromQuery.trim().replace(/\//g, '-')
  const parts = raw.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
  let y = parts[0], m = parts[1]
  if (parts.length >= 2 && m > 12) [y, m] = [m, y]
  if (y && m) return `${y}-${String(m).padStart(2, '0')}`
  const months: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }
  const lower = raw.toLowerCase()
  for (const [name, num] of Object.entries(months)) {
    if (lower.includes(name)) {
      const match = raw.match(/\b(19|20)\d{2}\b/)
      const year = match ? parseInt(match[0], 10) : new Date().getFullYear()
      return `${year}-${String(num).padStart(2, '0')}`
    }
  }
  return null
}

function getLastDayOfMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

function formatMonthYearDisplay(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** Sentinel `<select>` value: show custom physician field (extended backlog #2). */
const PHYSICIAN_SELECT_ADD_OTHER = '__ADD_OTHER__'

function isTbdOrEmptyPhysician(v: string | null | undefined): boolean {
  const t = (v || '').trim()
  return !t || t.toUpperCase() === 'TBD'
}

/** For table cells / print: hide TBD and empty (no placeholder words). */
function physicianDisplayText(raw: string | null | undefined): string {
  if (isTbdOrEmptyPhysician(raw)) return ''
  return (raw || '').trim()
}

/** Colored-circle text avatar for MAR-triggered progress note entries. */
function PrnAvatarBadge({ initials }: { initials: string }) {
  const palette = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-rose-500',
    'bg-amber-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
    'bg-orange-500', 'bg-lime-600',
  ]
  const idx = initials.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % palette.length
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${palette[idx]}`}
      title={initials}
    >
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}

/**
 * Derive short initials for a MAR-triggered progress note.
 * Priority: "MAR initials: XX" embedded in the note body → current user profile → "?".
 */
function getPrnEntryInitials(entry: { notes: string; created_by?: string | null }, userProfile: UserProfile | null): string {
  const match = (entry.notes || '').match(/^MAR initials:\s*(.+)$/m)
  if (match?.[1]?.trim()) return match[1].trim().slice(0, 3).toUpperCase()
  if (userProfile) {
    const si = userProfile.staff_initials
    if (si && !si.startsWith('data:image') && !si.startsWith('s3:') && si.trim()) {
      return si.trim().toUpperCase().slice(0, 3)
    }
    if (userProfile.full_name) {
      const names = userProfile.full_name.trim().split(/\s+/)
      if (names.length >= 2) return (names[0][0] + names[names.length - 1][0]).toUpperCase()
      if (names[0]) return names[0][0].toUpperCase()
    }
  }
  return '?'
}

/** PRN-synced bodies may still end with Initials/Documentation from older syncs; signature column covers that. */
function stripPrnProgressNoteRedundantTail(notes: string): string {
  if (!notes) return notes
  const lines = notes.split('\n')
  let end = lines.length
  while (end > 0) {
    const t = lines[end - 1].trim()
    if (/^Documentation:\s*Signed\s*$/i.test(t) || /^Initials:\s*/i.test(t)) {
      end--
    } else break
  }
  return lines.slice(0, end).join('\n')
}

/**
 * Strip raw "LEGEND:XX" and "VITAL:XX" markers that leaked into MAR-synced progress notes.
 * • `(from MAR, …) [MedName] LEGEND:T` → `(from MAR, …) [MedName]`
 * • `(from MAR, …) VITAL:55`           → removed entirely (Vitals should never appear here)
 * The user text on the following line(s) is preserved.
 */
function sanitizeMarMarkersInNotes(notes: string): string {
  // Remove lines that are solely a Vitals marker (the whole line starts with the prefix + VITAL:)
  const withoutVitals = notes
    .split('\n')
    .filter((line) => !/^\(from MAR[^)]*\)[^\n]*VITAL:\S*/i.test(line.trim()))
    .join('\n')
  // Strip LEGEND:XX that follows a "(from MAR…) [Med]" header on the same line
  return withoutVitals.replace(/(\(from MAR[^)]*\)[^\n]*) LEGEND:\S+/g, '$1').replace(/\n{3,}/g, '\n\n').trim()
}

function page1EntryNotesDisplay(entry: ProgressNoteEntry): string {
  const raw = entry.source_mar_prn_record_id
    ? stripPrnProgressNoteRedundantTail(entry.notes)
    : entry.notes
  return sanitizeMarMarkersInNotes(raw)
}

function effectivePhysicianName(selectedPhysician: string, customPhysician: string): string {
  let raw: string
  if (selectedPhysician === PHYSICIAN_SELECT_ADD_OTHER) raw = customPhysician.trim()
  else if (selectedPhysician.trim()) raw = selectedPhysician.trim()
  else raw = customPhysician.trim()
  if (isTbdOrEmptyPhysician(raw)) return ''
  return raw.trim()
}

/** Y/N radio group styled as a switch (pill with two segments) */
function YnSwitch({
  value,
  onChange,
  className = '',
  disabled = false
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  className?: string
  disabled?: boolean
}) {
  const v = value ?? ''
  return (
    <div
      role="radiogroup"
      aria-label="Yes or No"
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 ${disabled ? 'opacity-75 pointer-events-none' : ''} ${className}`}
    >
      <label className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={undefined}
          checked={v === 'N'}
          onChange={() => onChange('N')}
          disabled={disabled}
          className="sr-only"
        />
        <span
          className={`block px-3 py-1.5 text-center text-sm font-medium transition-colors ${
            v === 'N'
              ? 'bg-lasso-teal text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          N
        </span>
      </label>
      <label className={`flex-1 border-l border-gray-300 dark:border-gray-600 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="radio"
          name={undefined}
          checked={v === 'Y'}
          onChange={() => onChange('Y')}
          disabled={disabled}
          className="sr-only"
        />
        <span
          className={`block px-3 py-1.5 text-center text-sm font-medium transition-colors ${
            v === 'Y'
              ? 'bg-lasso-teal text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          Y
        </span>
      </label>
    </div>
  )
}

/** kg / lbs switch (same style as YnSwitch) */
function KgLbsSwitch({
  value,
  onChange,
  className = '',
  disabled = false
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  className?: string
  disabled?: boolean
}) {
  const v = (value ?? 'lbs') === 'kg' ? 'kg' : 'lbs'
  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 ${disabled ? 'opacity-75 pointer-events-none' : ''} ${className}`}
    >
      <label className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input type="radio" checked={v === 'lbs'} onChange={() => onChange('lbs')} disabled={disabled} className="sr-only" />
        <span className={`block px-2 py-1 text-center text-xs font-medium transition-colors ${v === 'lbs' ? 'bg-lasso-teal text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>lbs</span>
      </label>
      <label className={`flex-1 border-l border-gray-300 dark:border-gray-600 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input type="radio" checked={v === 'kg'} onChange={() => onChange('kg')} disabled={disabled} className="sr-only" />
        <span className={`block px-2 py-1 text-center text-xs font-medium transition-colors ${v === 'kg' ? 'bg-lasso-teal text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>kg</span>
      </label>
    </div>
  )
}

export default function ProgressNotesPage() {
  const router = useRouter()
  const { id: patientId } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [facilityName, setFacilityName] = useState<string>('')
  const [physicians, setPhysicians] = useState<string[]>([])
  const [entries, setEntries] = useState<ProgressNoteEntry[]>([])
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [showDeleteNoteModal, setShowDeleteNoteModal] = useState(false)
  const [deletingNoteSaving, setDeletingNoteSaving] = useState(false)
  const [showEditPatientInfoModal, setShowEditPatientInfoModal] = useState(false)
  const [selectedPhysician, setSelectedPhysician] = useState<string>('')
  const [customPhysician, setCustomPhysician] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editingEntry, setEditingEntry] = useState<ProgressNoteEntry | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [activeSummarySection, setActiveSummarySection] = useState('sum-vitals')

  // New entry being added (unsaved row)
  const [newDate, setNewDate] = useState<string>(() => localTodayYMD())
  const [newNotes, setNewNotes] = useState('')
  // User must explicitly sign to confirm the note (saved signature is applied on "Sign")
  // newNoteSigned removed — new entries are attributed via avatar (created_by) instead of a signature
  // Page 2: Monthly Summary
  const [activeTab, setActiveTab] = useState<'page1' | 'page2'>('page1')
  const [summaryMonthYear, setSummaryMonthYear] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [summary, setSummary] = useState<ProgressNoteMonthlySummary | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summarySaving, setSummarySaving] = useState(false)
  const [summaryForm, setSummaryForm] = useState<Partial<ProgressNoteMonthlySummary>>({})
  const [previousSummary, setPreviousSummary] = useState<ProgressNoteMonthlySummary | null>(null)
  const summaryFormRef = useRef<Partial<ProgressNoteMonthlySummary>>({})
  const summaryRef = useRef<ProgressNoteMonthlySummary | null>(null)
  const saveSummaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePhysicianTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isReadOnly } = useReadOnly()
  const readOnly = isReadOnly || userProfile?.designation === 'SCG'

  const monthFromQuery = typeof router.query.month === 'string' ? router.query.month.trim() : null
  const monthFilterKey = parseMonthQuery(monthFromQuery)

  useEffect(() => {
    if (!router.isReady || !monthFilterKey) return
    setSummaryMonthYear(monthFilterKey)
    const today = new Date()
    const [y, m] = monthFilterKey.split('-').map(Number)
    const todayInMonth = today.getFullYear() === y && today.getMonth() + 1 === m
    const day = todayInMonth ? today.getDate() : 1
    setNewDate(`${monthFilterKey}-${String(day).padStart(2, '0')}`)
  }, [router.isReady, monthFilterKey])

  useEffect(() => {
    if (!patientId || typeof patientId !== 'string') return
    const load = async () => {
      try {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      const patientData = await rdsGetPatient(patientId).catch((e: Error) => {
        if (e.message === 'Forbidden' || e.message?.includes('403')) {
          router.replace('/dashboard')
          return null
        }
        throw e
      })
      if (!patientData) {
        setError('Patient not found')
        setLoading(false)
        return
      }
      setPatient(patientData)

      if (profile.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        setFacilityName(hospital?.name ?? '')
      }

      const allPatients = await rdsListPatients().catch(() => [])
      const distinct = Array.from(
        new Set(allPatients.map((p: any) => p.physician_name?.trim()).filter(Boolean))
      )
        .filter((p) => !isTbdOrEmptyPhysician(p as string))
        .sort() as string[]
      setPhysicians(distinct)
      if (patientData.physician_name && distinct.includes(patientData.physician_name)) {
        setSelectedPhysician(patientData.physician_name)
      }

      const entriesRaw = await rdsListProgressNotes(patientId, true).catch(() => [])
      const entriesList = (entriesRaw as ProgressNoteEntry[]).map(e => ({ ...e, is_addendum: e.is_addendum ?? false }))
      setEntries(entriesList)

      const profileStep1Complete = isPatientRecordStep1Complete(patientData as Patient)
      if (profileStep1Complete) {
        // Pre-fill Physician/APRN: localStorage (most reliable) > last note > patient record
        const storageKey = `progress-notes-physician-${patientId}`
        const stored = (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null)?.trim() || ''
        const lastPhysician =
          entriesList.find((e) => !isTbdOrEmptyPhysician(e.physician_name))?.physician_name?.trim() || ''
        const patientPhysician = isTbdOrEmptyPhysician(patientData.physician_name)
          ? ''
          : patientData.physician_name!.trim()
        const physicianToUse = !isTbdOrEmptyPhysician(stored)
          ? stored
          : lastPhysician || patientPhysician
        if (physicianToUse) {
          if (distinct.includes(physicianToUse)) {
            setSelectedPhysician(physicianToUse)
            setCustomPhysician('')
          } else {
            setSelectedPhysician(PHYSICIAN_SELECT_ADD_OTHER)
            setCustomPhysician(physicianToUse)
          }
        } else if (patientData.physician_name && distinct.includes(patientData.physician_name)) {
          setSelectedPhysician(patientData.physician_name)
        }
      } else {
        setSelectedPhysician('')
        setCustomPhysician('')
      }

      setLoading(false)
      } catch (err: any) {
        if (err.message === 'Forbidden' || err.message?.includes('403')) {
          router.replace('/dashboard')
        } else {
          setError(err.message || 'Failed to load patient data')
          setLoading(false)
        }
      }
    }
    load()
  }, [patientId, router])

  // Debounced save of Physician/APRN to patient record so typed value persists
  useEffect(() => {
    if (!patientId || typeof patientId !== 'string' || !patient) return
    if (!isPatientRecordStep1Complete(patient)) return
    const physician = effectivePhysicianName(selectedPhysician, customPhysician)
    const prevRaw = patient.physician_name?.trim() || ''
    const prevNorm = isTbdOrEmptyPhysician(prevRaw) ? '' : prevRaw
    if (physician === prevNorm) return
    if (savePhysicianTimeoutRef.current) clearTimeout(savePhysicianTimeoutRef.current)
    savePhysicianTimeoutRef.current = setTimeout(async () => {
      savePhysicianTimeoutRef.current = null
      const storageKey = `progress-notes-physician-${patientId}`
      if (typeof window !== 'undefined') {
        if (physician) localStorage.setItem(storageKey, physician)
        else localStorage.removeItem(storageKey)
      }
      await rdsPatchPatient(patientId, { physician_name: physician || '' }).catch(console.error)
      setPatient((prev) => (prev ? { ...prev, physician_name: physician || '' } : null))
      setMessage('Saved')
      setTimeout(() => setMessage(''), 2000)
    }, 600)
    return () => { if (savePhysicianTimeoutRef.current) clearTimeout(savePhysicianTimeoutRef.current) }
  }, [patientId, patient, selectedPhysician, customPhysician])

  useEffect(() => {
    const onAfterPrint = () => {
      document.body.classList.remove('print-view-notes', 'print-view-page2')
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  const refetchEntries = async () => {
    if (!patientId || typeof patientId !== 'string') return
    const entriesRaw = await rdsListProgressNotes(patientId, true).catch(() => null)
    if (entriesRaw) setEntries((entriesRaw as ProgressNoteEntry[]).map((e) => ({ ...e, is_addendum: e.is_addendum ?? false })))
  }

  const closeEditPatientInfoModal = () => {
    setShowEditPatientInfoModal(false)
  }

  const openEditPatientModal = () => {
    if (!patientId || typeof patientId !== 'string') return
    setShowEditPatientInfoModal(true)
  }

  const handleSavePatientEdits = async ({ patientId: pid, payload }: EditPatientInfoSaveArgs): Promise<Patient> => {
    return rdsPatchPatient(pid!, { ...payload, sync_mar_forms: true }) as Promise<Patient>
  }

  const handleAddEntry = async () => {
    if (!userProfile || !patientId || !newNotes.trim()) {
      setError('Please enter notes.')
      return
    }
    setSaving(true)
    setError('')
    const physicianRaw = effectivePhysicianName(selectedPhysician, customPhysician)
    const physician = physicianRaw || null
    try {
      await rdsCreateProgressNote({
        patient_id: patientId,
        note_date: newDate,
        notes: newNotes.trim(),
        signature: null,
        physician_name: physician,
        is_addendum: false,
        created_by: userProfile.id,
      })
    } catch (e: any) {
      setError(e.message || 'Failed to add note')
      setSaving(false)
      return
    }
    setMessage('Note added.')
    setTimeout(() => setMessage(''), 3000)
    setNewNotes('')
    setNewDate(
      (() => {
        const q = typeof router.query.month === 'string' ? router.query.month.trim() : null
        const key = parseMonthQuery(q)
        return key ? `${key}-01` : localTodayYMD()
      })()
    )
    await refetchEntries()
    setSaving(false)
  }

  /** Sync Progress Note Page 1 → MAR: set all MAR administration notes for this patient+date to the given notes. */
  const syncProgressNoteToMAR = async (pid: string, noteDate: string, notes: string) => {
    try {
      const dateStr = noteDate.includes('T') ? noteDate.slice(0, 10) : noteDate
      const monthYear = dateStr.slice(0, 7)
      const day = parseInt(dateStr.slice(8, 10), 10)
      if (!monthYear || Number.isNaN(day)) return
      const forms = await rdsListMarForms(pid).catch(() => [])
      const matchingForms = forms.filter((f: any) => f.month_year === monthYear)
      if (!matchingForms.length) return
      await Promise.all(
        matchingForms.map(async (form: any) => {
          const full = await rdsGetMarForm(form.id).catch(() => null)
          if (!full) return
          const { medications = [], administrations = [] } = full
          const dayAdmins = administrations.filter((a: any) => {
            const dn = typeof a.day_number === 'number' ? a.day_number : Number(a.day_number)
            return dn === day
          })
          await Promise.all(
            dayAdmins.map((a: any) =>
              rdsUpsertAdministration({ ...a, notes: notes || null }).catch(console.error)
            )
          )
        })
      )
    } catch (e) {
      console.warn('[syncProgressNoteToMAR]', e)
    }
  }

  const PAGE1_ENTRY_DEBOUNCE_MS = 600
  const page1SaveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryNotesRef = useRef<Record<string, string>>({})
  const entrySaveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleUpdateEntry = async (entryId: string, notes: string, noteDate: string) => {
    if (page1SaveMessageTimeoutRef.current) clearTimeout(page1SaveMessageTimeoutRef.current)
    setMessage('Saving...')
    await rdsPatchProgressNote(entryId, { notes }).catch(console.error)
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, notes } : e))
    if (patientId && typeof patientId === 'string' && noteDate) {
      await syncProgressNoteToMAR(patientId, noteDate, notes)
    }
    setMessage('Saved')
    page1SaveMessageTimeoutRef.current = setTimeout(() => { setMessage(''); page1SaveMessageTimeoutRef.current = null }, 3000)
  }

  const schedulePage1EntrySave = (entryId: string, noteDate: string) => {
    if (entrySaveTimeoutsRef.current[entryId]) clearTimeout(entrySaveTimeoutsRef.current[entryId])
    entrySaveTimeoutsRef.current[entryId] = setTimeout(() => {
      const notes = entryNotesRef.current[entryId] ?? ''
      delete entrySaveTimeoutsRef.current[entryId]
      handleUpdateEntry(entryId, notes, noteDate)
    }, PAGE1_ENTRY_DEBOUNCE_MS)
  }

  const canDeleteNotes = userProfile?.role === 'superadmin' || userProfile?.role === 'head_nurse'

  const handleDeleteNote = async () => {
    if (!deletingNoteId) return
    try {
      setDeletingNoteSaving(true)
      await rdsDeleteProgressNote(deletingNoteId)
      setEntries(prev => prev.filter(e => e.id !== deletingNoteId))
      setShowDeleteNoteModal(false)
      setDeletingNoteId(null)
    } catch (err: any) {
      console.error('Error deleting progress note:', err)
    } finally {
      setDeletingNoteSaving(false)
    }
  }

  const handleSignEntry = async (entryId: string) => {
    if (!userProfile?.staff_signature) return
    if (page1SaveMessageTimeoutRef.current) clearTimeout(page1SaveMessageTimeoutRef.current)
    setMessage('Saving...')
    await rdsPatchProgressNote(entryId, { signature: userProfile.staff_signature }).catch(console.error)
    setEntries(prev => prev.map(e => e.id === entryId ? { ...e, signature: userProfile!.staff_signature } : e))
    setMessage('Saved')
    page1SaveMessageTimeoutRef.current = setTimeout(() => { setMessage(''); page1SaveMessageTimeoutRef.current = null }, 3000)
  }

  // Compute previous month (e.g. 2026-02 -> 2026-01)
  const getPreviousMonthYear = (monthYear: string) => {
    const [y, m] = monthYear.split('-').map(Number)
    if (m === 1) return `${y - 1}-12`
    return `${y}-${String(m - 1).padStart(2, '0')}`
  }

  // Load Page 2 summary + previous month (for weight diff) and default weight_unit
  useEffect(() => {
    if (activeTab !== 'page2' || !patientId || typeof patientId !== 'string') return
    setSummaryLoading(true)
    const prevMonth = getPreviousMonthYear(summaryMonthYear)
    Promise.all([
      rdsGetProgressNoteSummary(patientId, summaryMonthYear),
      rdsGetProgressNoteSummary(patientId, prevMonth),
      rdsGetLatestProgressNoteSummaryWeightUnit(patientId),
    ]).then(([data, previous, latest]) => {
      setSummaryLoading(false)
      const defaultWeightUnit = (latest?.weight_unit && (latest.weight_unit === 'kg' || latest.weight_unit === 'lbs')) ? latest.weight_unit : 'lbs'
      setSummary(data)
      summaryRef.current = data
      setPreviousSummary(previous)
      if (data) {
        const form: Partial<ProgressNoteMonthlySummary> = { ...data }
        const currentWt = data.wt != null && data.wt.trim() !== '' ? parseFloat(data.wt) : NaN
        const previousWt = previous?.wt != null && previous.wt.trim() !== '' ? parseFloat(previous.wt) : NaN
        if (!Number.isNaN(currentWt) && !Number.isNaN(previousWt)) {
          form.wt_change_yn = 'Y'
        }
        setSummaryForm(form)
        summaryFormRef.current = form
      } else {
        const initial = {
          month_year: summaryMonthYear,
          weight_unit: defaultWeightUnit,
          bp: '', pulse: '', resp: '', temp: '', wt: '', wt_change_yn: '',
          response_to_diet: '', medication_available_yn: '', medication_secured_yn: '', taking_medications_yn: '',
          physician_notified_yn: '', medication_changes_yn: '', response_to_medication: '',
          treatments_yn: '', treatments_type: '', response_to_treatment: '', therapy_yn: '', therapy_pt: '', therapy_ot: '', therapy_st: '',
          adl_level: '', ambulation: '', continent_urine_yn: '', continent_stool_yn: '', incontinent_urine_yn: '', incontinent_stool_yn: '',
          timed_toileting_yn: '', diapers_yn: '', bm_type: '',
          skin_intact_yn: '', wound_type: '', wound_location: '', wound_treatment: '', wound_response: '',
          pain_yn: '', pain_location: '', pain_intensity: '', pain_cause: '', pain_treatment: '', pain_response: '',
          mental_descriptors: '', impaired_communication_other: '',
          describe_changes: '', actions: '', changes_in_condition_yn: '', illness_yn: '', injury_yn: '', describe_type_actions_taken: '',
          plan_of_care: '', signature_title: ''
        }
        setSummaryForm(initial)
        summaryFormRef.current = initial
      }
    })
  }, [activeTab, patientId, summaryMonthYear])

  const saveSummaryToBackend = async () => {
    if (!userProfile || !patientId) return
    const form = summaryFormRef.current
    const existing = summaryRef.current
    setSummarySaving(true)
    setError('')
    try {
      const { id: _id, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = form
      const payload = {
        patient_id: patientId,
        month_year: summaryMonthYear,
        ...rest,
      }
      let saved: any
      if (existing?.id) {
        saved = await rdsPatchProgressNoteSummary(existing.id, payload)
      } else {
        saved = await rdsUpsertProgressNoteSummary({ ...payload, created_by: userProfile.id })
      }
      if (saved) {
        setSummary(saved as ProgressNoteMonthlySummary)
        summaryRef.current = saved as ProgressNoteMonthlySummary
      }
      setMessage('Saved')
      setTimeout(() => setMessage(''), 2000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save summary')
    } finally {
      setSummarySaving(false)
    }
  }

  const SUMMARY_DEBOUNCE_MS = 600

  function updateSummaryField<K extends keyof ProgressNoteMonthlySummary>(key: K, value: ProgressNoteMonthlySummary[K]) {
    setSummaryForm(prev => {
      const next = { ...prev, [key]: value }
      summaryFormRef.current = next
      return next
    })
    if (saveSummaryTimeoutRef.current) clearTimeout(saveSummaryTimeoutRef.current)
    saveSummaryTimeoutRef.current = setTimeout(() => {
      saveSummaryTimeoutRef.current = null
      saveSummaryToBackend()
    }, SUMMARY_DEBOUNCE_MS)
  }

  // Track which Monthly Summary section is in view for the left-nav highlight
  useEffect(() => {
    if (activeTab !== 'page2') return
    const ids = ['sum-vitals','sum-medication','sum-treatments','sum-adl','sum-skin','sum-pain','sum-mental','sum-changes','sum-plan','sum-signature']
    const observers: IntersectionObserver[] = []
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSummarySection(id) },
        { rootMargin: '-15% 0px -75% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [activeTab])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal"></div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!patient) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-600">{error || 'Patient not found'}</p>
          <Link href="/dashboard?module=progress" className="ml-4 text-lasso-teal">Back to Dashboard</Link>
        </div>
      </ProtectedRoute>
    )
  }

  const { firstName, lastName } = parsePatientName(patient.patient_name)
  const allMainEntries = entries.filter(e => !e.is_addendum)
  const mainEntries = monthFilterKey
    ? allMainEntries.filter((e) => {
        const d = e.note_date != null ? String(e.note_date).slice(0, 10) : ''
        return d.startsWith(monthFilterKey)
      })
    : allMainEntries
  const physicianSelectionLocked = !isPatientRecordStep1Complete(patient)
  const selectedPhysicianDisplay = physicianDisplayText(effectivePhysicianName(selectedPhysician, customPhysician))
  const showPhysicianColumn = Boolean(selectedPhysicianDisplay)
  const existingNotesColumnCount = 4
  const hasNewNoteText = newNotes.trim().length > 0

  const handlePrintAllNotes = async () => {
    document.body.classList.add('print-view-notes')
    await refetchEntries()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }

  const handlePrintPage2 = () => {
    document.body.classList.add('print-view-page2')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.print())
    })
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Progress Notes - {patient.patient_name}</title>
        {/* dangerouslySetInnerHTML is safe here: the CSS string is a hardcoded
            literal with no user-supplied input, so there is no XSS vector.
            It is used only to inject print-media styles into <head> because
            Next.js does not support <style> children inside <Head>. */}
        <style dangerouslySetInnerHTML={{
          __html: '.progress-notes-print-view,.progress-notes-page2-print-view{display:none}@media print{.no-print{display:none!important}body *{visibility:hidden}body.print-view-notes .progress-notes-print-view,body.print-view-notes .progress-notes-print-view *{visibility:visible}body.print-view-notes .progress-notes-print-view{position:absolute;left:0;top:0;width:100%;display:block!important}body.print-view-page2 .progress-notes-page2-print-view,body.print-view-page2 .progress-notes-page2-print-view *{visibility:visible}body.print-view-page2 .progress-notes-page2-print-view{position:absolute;left:0;top:0;width:100%;display:block!important}'
        }} />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="no-print">
          <AppHeader
            patientId={typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : undefined}
            patientName={patient?.patient_name}
          />
        </div>
        <PatientStickyBar
          patientId={typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : undefined}
          patientName={patient?.patient_name}
          dateOfBirth={patient?.date_of_birth}
          sex={patient?.sex}
          allergies={patient?.allergies}
          recordNumber={patient?.record_number}
          onEditPatient={readOnly ? undefined : () => void openEditPatientModal()}
          editPatientLabel="Patient Details"
        />

        <main className="no-print max-w-5xl mx-auto px-4 py-6">
          <Link
            href={router.query.id ? `/patients/${router.query.id}/progress-notes` : '/dashboard'}
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-2"
          >
            ← Back to Progress Notes
          </Link>
          <div className="mb-2">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span aria-hidden="true">📝</span>
              <span>Progress Notes</span>
            </h1>
            {monthFromQuery && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Showing: {monthFromQuery}</p>
            )}
          </div>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}
          {(message || (activeTab === 'page2' && summarySaving)) && (
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1100] px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-800 dark:text-green-200 text-sm shadow-lg">
              {activeTab === 'page2' && summarySaving ? 'Saving...' : message}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveTab('page1')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'page1' ? 'bg-lasso-teal text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              Notes & Addendum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page2')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'page2' ? 'bg-lasso-teal text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              Monthly Summary
            </button>
          </div>

          {activeTab === 'page1' && (
          <>
            {/* ── New entry input card ─────────────────────────────────── */}
            {!readOnly && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Enter progress note..."
                  rows={4}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal resize-none mb-3"
                />
                <div className="flex flex-wrap items-start gap-3 justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Date picker */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Date:</label>
                      <input
                        type="date"
                        min={monthFilterKey ? `${monthFilterKey}-01` : undefined}
                        max={monthFilterKey ? `${monthFilterKey}-${String(getLastDayOfMonth(monthFilterKey)).padStart(2, '0')}` : undefined}
                        value={monthFilterKey && newDate && !newDate.startsWith(monthFilterKey)
                          ? `${monthFilterKey}-01`
                          : newDate
                        }
                        onChange={(e) => setNewDate(e.target.value)}
                        className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    {/* Physician selector */}
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">Physician:</label>
                      <select
                        value={selectedPhysician}
                        onChange={(e) => {
                          const v = e.target.value
                          setSelectedPhysician(v)
                          if (!v || v !== PHYSICIAN_SELECT_ADD_OTHER) setCustomPhysician('')
                        }}
                        disabled={readOnly || physicianSelectionLocked}
                        className={`text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal ${readOnly || physicianSelectionLocked ? 'cursor-not-allowed opacity-60' : ''}`}
                      >
                        <option value="">Select</option>
                        {physicians.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        <option value={PHYSICIAN_SELECT_ADD_OTHER}>+ Add</option>
                      </select>
                      {!readOnly && !physicianSelectionLocked && selectedPhysician === PHYSICIAN_SELECT_ADD_OTHER && (
                        <input
                          type="text"
                          placeholder="Add new physician"
                          value={customPhysician}
                          onChange={(e) => setCustomPhysician(e.target.value)}
                          className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                        />
                      )}
                      {physicianSelectionLocked && !readOnly && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100">
                          <p>{PHYSICIAN_SELECTION_BLOCKED_HINT}</p>
                          <button type="button" onClick={openEditPatientModal} className="mt-1 font-medium text-lasso-teal hover:underline">
                            Complete patient details
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Avatar + Add Note button */}
                  <div className="flex items-center gap-2 ml-auto">
                    {userProfile && (
                      <PrnAvatarBadge initials={getPrnEntryInitials({ notes: '', created_by: userProfile.id }, userProfile)} />
                    )}
                    {hasNewNoteText && (
                      <button
                        type="button"
                        onClick={handleAddEntry}
                        disabled={saving}
                        className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Add Note'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Toolbar ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {mainEntries.length > 0 ? `${mainEntries.length} note${mainEntries.length === 1 ? '' : 's'}` : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintAllNotes}
                  className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700"
                >
                  Print all notes
                </button>
                <button
                  type="button"
                  onClick={() => refetchEntries()}
                  className="text-xs px-2 py-1 text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* ── Day cards ─────────────────────────────────────────────── */}
            {mainEntries.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
                No progress notes for this period.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {(() => {
                  const dateOrder: string[] = []
                  const byDate: Record<string, ProgressNoteEntry[]> = {}
                  mainEntries.forEach(e => {
                    const d = e.note_date ? String(e.note_date).slice(0, 10) : 'unknown'
                    if (!byDate[d]) { byDate[d] = []; dateOrder.push(d) }
                    byDate[d].push(e)
                  })
                  dateOrder.sort((a, b) => b.localeCompare(a))
                  return dateOrder.map((date) => {
                    const dayEntries = byDate[date]
                    return (
                      <div key={date} className="flex gap-3 items-start">
                        {/* Timeline dot + vertical connector */}
                        <div className="flex flex-col items-center pt-[18px] shrink-0 self-stretch">
                          <div className="w-2.5 h-2.5 rounded-full bg-lasso-navy dark:bg-lasso-teal shrink-0" />
                          <div className="flex-1 w-0.5 bg-gray-200 dark:bg-gray-700 mt-1" />
                        </div>
                        {/* Card */}
                        <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                          {/* Date header */}
                          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              {formatCalendarDate(date, 'en-US')}
                            </span>
                          </div>
                          {/* Entries within this day */}
                          {dayEntries.map((entry, idx) => (
                            <div
                              key={entry.id}
                              className={idx > 0 ? 'border-t border-gray-100 dark:border-gray-700' : ''}
                            >
                              <div
                                className={`px-4 pt-3 pb-2${!readOnly ? ' cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors' : ''}`}
                                onClick={() => {
                                  if (readOnly) return
                                  setEditingEntry(entry)
                                  setEditNotes(page1EntryNotesDisplay(entry))
                                }}
                              >
                                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                                  {page1EntryNotesDisplay(entry)}
                                </p>
                              </div>
                              <div className="px-4 pb-3 flex items-center justify-between">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {physicianDisplayText(entry.physician_name) || ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  <PrnAvatarBadge initials={getPrnEntryInitials(entry, userProfile)} />
                                  {canDeleteNotes && (
                                    <button
                                      type="button"
                                      onClick={(ev) => { ev.stopPropagation(); setDeletingNoteId(entry.id); setShowDeleteNoteModal(true) }}
                                      className="text-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                      title="Delete entry"
                                      aria-label="Delete progress note entry"
                                    >
                                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </>
          )}

          {activeTab === 'page2' && (
          <div className="flex gap-6 items-start">
            {/* ── Sticky left navigation ─────────────────────────────── */}
            <nav className="sticky top-44 w-44 shrink-0 hidden lg:block">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-3 px-2">Sections</p>
              <ul className="space-y-0.5">
                {[
                  { id: 'sum-vitals',     label: 'Monthly Summary' },
                  { id: 'sum-medication', label: 'Medication' },
                  { id: 'sum-treatments', label: 'Treatments' },
                  { id: 'sum-adl',        label: 'ADL / Ambulation' },
                  { id: 'sum-skin',       label: 'Skin Integrity' },
                  { id: 'sum-pain',       label: 'Pain' },
                  { id: 'sum-mental',     label: 'Mental' },
                  { id: 'sum-changes',    label: 'Changes & Actions' },
                  { id: 'sum-plan',       label: 'Plan of Care' },
                  { id: 'sum-signature',  label: 'Signature' },
                ].map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        activeSummarySection === s.id
                          ? 'bg-lasso-teal/10 text-lasso-teal font-semibold'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>

            {/* ── Form content ───────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
            <div className="px-6 py-4 space-y-6">
              <h2 className="text-center font-bold text-gray-900 dark:text-white">MONTHLY SUMMARY</h2>

              {/* Month/Year: when viewing a specific month (progress note selected), show read-only; otherwise editable */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month / Year:</label>
                {monthFilterKey ? (
                  <span className="text-sm font-medium text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 bg-gray-50 dark:bg-gray-700">
                    {formatMonthYearDisplay(monthFilterKey)}
                  </span>
                ) : (
                  <input
                    type="month"
                    value={summaryMonthYear}
                    onChange={(e) => setSummaryMonthYear(e.target.value)}
                    disabled={readOnly}
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                )}
                {summaryLoading && <span className="text-sm text-gray-500">Loading...</span>}
                <button
                  type="button"
                  onClick={handlePrintPage2}
                  className="ml-auto text-xs px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 no-print"
                >
                  Print
                </button>
              </div>

              {/* Monthly Summary */}
              {(() => {
                const currentWtNum = summaryForm.wt != null && summaryForm.wt.trim() !== '' ? parseFloat(summaryForm.wt) : NaN
                const previousWtNum = previousSummary?.wt != null && previousSummary.wt.trim() !== '' ? parseFloat(previousSummary.wt) : NaN
                const hasWeightChange = !Number.isNaN(currentWtNum) && !Number.isNaN(previousWtNum)
                const weightDiff = hasWeightChange ? currentWtNum - previousWtNum : null
                const weightUnit = (summaryForm.weight_unit === 'kg' || summaryForm.weight_unit === 'lbs') ? summaryForm.weight_unit : 'lbs'
                return (
              <section id="sum-vitals" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Monthly Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                  {(['bp', 'pulse', 'resp', 'temp'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">{f === 'bp' ? 'B.P.' : f === 'pulse' ? 'P.' : f === 'resp' ? 'R.' : 'Temp.'}</label>
                      <input type="text" value={summaryForm[f] ?? ''} onChange={(e) => updateSummaryField(f, e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wt.</label>
                    <div className="flex items-center gap-2">
                      <input type="text" value={summaryForm.wt ?? ''} onChange={(e) => updateSummaryField('wt', e.target.value)} disabled={readOnly} className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                      <KgLbsSwitch value={summaryForm.weight_unit ?? 'lbs'} onChange={(v) => updateSummaryField('weight_unit', v)} disabled={readOnly} className="shrink-0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wt. Change Y/N</label>
                    <YnSwitch value={summaryForm.wt_change_yn ?? ''} onChange={(v) => updateSummaryField('wt_change_yn', v)} disabled={readOnly} className="w-full" />
                    {weightDiff !== null && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                        {weightDiff > 0 ? `+${weightDiff}` : weightDiff < 0 ? `${weightDiff}` : '+0'} {weightUnit}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Diet</label>
                  <input type="text" value={summaryForm.response_to_diet ?? ''} onChange={(e) => updateSummaryField('response_to_diet', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>
                )
              })()}

              {/* Medication */}
              <section id="sum-medication" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Medication</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  {(['medication_available_yn', 'medication_secured_yn', 'taking_medications_yn'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{f.replace(/_yn$/, '').replace(/_/g, ' ')} Y/N</label>
                      <YnSwitch value={summaryForm[f] ?? ''} onChange={(v) => updateSummaryField(f, v)} disabled={readOnly} className="w-full" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Physician Notified Y/N</label>
                    <YnSwitch value={summaryForm.physician_notified_yn ?? ''} onChange={(v) => updateSummaryField('physician_notified_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Date</label>
                    <input type="date" value={summaryForm.physician_notified_date ?? ''} onChange={(e) => updateSummaryField('physician_notified_date', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Medication Changes Y/N</label>
                    <YnSwitch value={summaryForm.medication_changes_yn ?? ''} onChange={(v) => updateSummaryField('medication_changes_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Medication</label>
                  <input type="text" value={summaryForm.response_to_medication ?? ''} onChange={(e) => updateSummaryField('response_to_medication', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Treatments */}
              <section id="sum-treatments" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Treatments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Treatments Y/N</label>
                    <YnSwitch value={summaryForm.treatments_yn ?? ''} onChange={(v) => updateSummaryField('treatments_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Type</label>
                    <input type="text" value={summaryForm.treatments_type ?? ''} onChange={(e) => updateSummaryField('treatments_type', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Treatment</label>
                  <input type="text" value={summaryForm.response_to_treatment ?? ''} onChange={(e) => updateSummaryField('response_to_treatment', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Therapy Y/N</label>
                    <YnSwitch value={summaryForm.therapy_yn ?? ''} onChange={(v) => updateSummaryField('therapy_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['therapy_pt', 'therapy_ot', 'therapy_st'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">{f === 'therapy_pt' ? 'PT' : f === 'therapy_ot' ? 'OT' : 'ST'}</label>
                      <input type="text" value={summaryForm[f] ?? ''} onChange={(e) => updateSummaryField(f, e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  ))}
                </div>
              </section>

              {/* ADL */}
              <section id="sum-adl" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">ADL / Ambulation / Continence / BM</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">ADL</label>
                    <select value={summaryForm.adl_level ?? ''} onChange={(e) => updateSummaryField('adl_level', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option><option value="Independent">Independent</option><option value="Minimal">Minimal</option><option value="Moderate">Moderate</option><option value="Maximum">Maximum</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Ambulation</label>
                    <select value={summaryForm.ambulation ?? ''} onChange={(e) => updateSummaryField('ambulation', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option><option value="Independent">Independent</option><option value="Walker">Walker</option><option value="Cane">Cane</option><option value="W/C">W/C</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {(['continent_urine_yn', 'continent_stool_yn', 'incontinent_urine_yn', 'incontinent_stool_yn'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{f.replace(/_yn$/, '').replace(/_/g, ' ')} Y/N</label>
                      <YnSwitch value={summaryForm[f] ?? ''} onChange={(v) => updateSummaryField(f, v)} disabled={readOnly} className="w-full" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timed toileting Y/N</label>
                    <YnSwitch value={summaryForm.timed_toileting_yn ?? ''} onChange={(v) => updateSummaryField('timed_toileting_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Diapers Y/N</label>
                    <YnSwitch value={summaryForm.diapers_yn ?? ''} onChange={(v) => updateSummaryField('diapers_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">BM</label>
                    <select value={summaryForm.bm_type ?? ''} onChange={(e) => updateSummaryField('bm_type', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option><option value="Regular">Regular</option><option value="Enema/Supp">Enema/Supp</option><option value="Stool Softeners/Laxatives">Stool Softeners/Laxatives</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* Skin Integrity */}
              <section id="sum-skin" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Skin Integrity</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Intact Y/N</label>
                    <YnSwitch value={summaryForm.skin_intact_yn ?? ''} onChange={(v) => updateSummaryField('skin_intact_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Wound Type</label>
                    <input type="text" value={summaryForm.wound_type ?? ''} onChange={(e) => updateSummaryField('wound_type', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Location</label>
                    <input type="text" value={summaryForm.wound_location ?? ''} onChange={(e) => updateSummaryField('wound_location', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Treatment / Response to Treatment</label>
                  <input type="text" value={summaryForm.wound_treatment ?? ''} onChange={(e) => updateSummaryField('wound_treatment', e.target.value)} disabled={readOnly} placeholder="Treatment" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white mb-1" />
                  <input type="text" value={summaryForm.wound_response ?? ''} onChange={(e) => updateSummaryField('wound_response', e.target.value)} disabled={readOnly} placeholder="Response" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Pain */}
              <section id="sum-pain" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Pain</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pain Y/N</label>
                    <YnSwitch value={summaryForm.pain_yn ?? ''} onChange={(v) => updateSummaryField('pain_yn', v)} disabled={readOnly} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Location</label>
                    <input type="text" value={summaryForm.pain_location ?? ''} onChange={(e) => updateSummaryField('pain_location', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Intensity (0–10)</label>
                    <input type="text" value={summaryForm.pain_intensity ?? ''} onChange={(e) => updateSummaryField('pain_intensity', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Cause</label>
                    <input type="text" value={summaryForm.pain_cause ?? ''} onChange={(e) => updateSummaryField('pain_cause', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Treatment / Response to Treatment</label>
                  <input type="text" value={summaryForm.pain_treatment ?? ''} onChange={(e) => updateSummaryField('pain_treatment', e.target.value)} disabled={readOnly} placeholder="Treatment" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white mb-1" />
                  <input type="text" value={summaryForm.pain_response ?? ''} onChange={(e) => updateSummaryField('pain_response', e.target.value)} disabled={readOnly} placeholder="Response" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Mental Status */}
              <section id="sum-mental" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Mental</h3>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Select all that apply (comma-separated or type)</label>
                  <input type="text" value={summaryForm.mental_descriptors ?? ''} onChange={(e) => updateSummaryField('mental_descriptors', e.target.value)} disabled={readOnly} placeholder="e.g. Oriented, Pleasant, Forgetful" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Options: Oriented, Pleasant, Happy, Forgetful, Wanders, Disoriented, Depressed, Withdrawn, Angry, Agitated, Delusions, Hallucinations, Suicidal/Homicidal, Physical Hostile, Verbal Hostile, Destructive</p>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Impaired Communication Other</label>
                  <input type="text" value={summaryForm.impaired_communication_other ?? ''} onChange={(e) => updateSummaryField('impaired_communication_other', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Changes and Actions */}
              <section id="sum-changes" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Changes and Actions</h3>
                <div className="space-y-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Describe Changes</label>
                    <input type="text" value={summaryForm.describe_changes ?? ''} onChange={(e) => updateSummaryField('describe_changes', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Date MD Notified</label>
                      <input type="date" value={summaryForm.date_md_notified ?? ''} onChange={(e) => updateSummaryField('date_md_notified', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Actions</label>
                    <input type="text" value={summaryForm.actions ?? ''} onChange={(e) => updateSummaryField('actions', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Changes in Condition Y/N</label>
                      <YnSwitch value={summaryForm.changes_in_condition_yn ?? ''} onChange={(v) => updateSummaryField('changes_in_condition_yn', v)} disabled={readOnly} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Illness Y/N</label>
                      <YnSwitch value={summaryForm.illness_yn ?? ''} onChange={(v) => updateSummaryField('illness_yn', v)} disabled={readOnly} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Injury Y/N</label>
                      <YnSwitch value={summaryForm.injury_yn ?? ''} onChange={(v) => updateSummaryField('injury_yn', v)} disabled={readOnly} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Date Physician Notified</label>
                      <input type="date" value={summaryForm.date_physician_notified ?? ''} onChange={(e) => updateSummaryField('date_physician_notified', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Describe Type and Actions Taken</label>
                    <textarea value={summaryForm.describe_type_actions_taken ?? ''} onChange={(e) => updateSummaryField('describe_type_actions_taken', e.target.value)} disabled={readOnly} rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </section>

              {/* Plan of Care */}
              <section id="sum-plan" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Plan of Care</h3>
                <textarea value={summaryForm.plan_of_care ?? ''} onChange={(e) => updateSummaryField('plan_of_care', e.target.value)} disabled={readOnly} rows={4} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
              </section>

              {/* Signature / Title / Date */}
              <section id="sum-signature" className="scroll-mt-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Signature / Title / Date</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Title</label>
                    <input type="text" value={summaryForm.signature_title ?? ''} onChange={(e) => updateSummaryField('signature_title', e.target.value)} disabled={readOnly} placeholder="e.g. RN, LPN" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Date</label>
                    <input type="date" value={summaryForm.signature_date ?? ''} onChange={(e) => updateSummaryField('signature_date', e.target.value)} disabled={readOnly} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Signature</label>
                  {((summaryForm.signature || (summaryForm.created_by === userProfile?.id && userProfile?.staff_signature)) && userProfile) ? (
                    <div className="flex flex-col gap-1">
                      <InitialsOrSignatureDisplay value={summaryForm.created_by === userProfile?.id && userProfile?.staff_signature ? userProfile.staff_signature : (summaryForm.signature ?? '')} variant="signature" userProfile={userProfile} />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => updateSummaryField('signature', null)}
                          className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline w-fit"
                        >
                          Clear signature
                        </button>
                      )}
                    </div>
                  ) : !readOnly && userProfile?.staff_signature ? (
                    <button
                      type="button"
                      onClick={() => updateSummaryField('signature', userProfile.staff_signature)}
                      className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                    >
                      Sign
                    </button>
                  ) : !readOnly ? (
                    <span className="text-amber-600 dark:text-amber-400 text-sm">Set signature in Profile first</span>
                  ) : null}
                </div>
              </section>
            </div>
            </div>
          </div>
          )}
        </main>

        {/* Edit Progress Note Modal */}
        {editingEntry && !readOnly && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit Note</h2>
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                {formatCalendarDate(String(editingEntry.note_date || '').slice(0, 10), 'en-US')}
                {physicianDisplayText(editingEntry.physician_name) ? ` · ${physicianDisplayText(editingEntry.physician_name)}` : ''}
              </p>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={8}
                autoFocus
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  disabled={editSaving}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={editSaving || !editNotes.trim()}
                  onClick={async () => {
                    setEditSaving(true)
                    await handleUpdateEntry(
                      editingEntry.id,
                      editNotes,
                      String(editingEntry.note_date || '').slice(0, 10)
                    )
                    setEditSaving(false)
                    setEditingEntry(null)
                  }}
                  className="px-4 py-2 text-sm bg-lasso-teal text-white rounded-lg hover:bg-lasso-blue disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Progress Note Confirmation Modal */}
        {showDeleteNoteModal && deletingNoteId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
              <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-3">Delete Progress Note?</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will permanently remove this entry. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowDeleteNoteModal(false); setDeletingNoteId(null) }}
                  disabled={deletingNoteSaving}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  disabled={deletingNoteSaving}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingNoteSaving ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        <EditPatientInfoModal
          isOpen={showEditPatientInfoModal}
          patientId={typeof patientId === 'string' ? patientId : null}
          title="Edit Patient Details"
          facilityDisplayName={facilityName}
          recordNumber={patient?.record_number || ''}
          readOnly={readOnly}
          onClose={closeEditPatientInfoModal}
          onSave={handleSavePatientEdits}
          onSaved={(updatedPatient) => {
            setPatient(updatedPatient)
            setMessage('Patient information updated.')
            setTimeout(() => setMessage(''), 3000)
          }}
        />

        {/* Print view: Page 2 Monthly Summary. Hidden on screen, shown when printing with body.print-view-page2. */}
        <div className="progress-notes-page2-print-view p-6 text-sm text-gray-900" style={{ display: 'none' }}>
          <h1 className="text-lg font-bold mb-2">MONTHLY SUMMARY</h1>
          <p className="mb-4"><strong>Month / Year:</strong> {formatMonthYearDisplay(monthFilterKey || summaryMonthYear)}</p>
          <p className="mb-4"><strong>Resident:</strong> {patient?.patient_name ?? '—'} | <strong>ARCH:</strong> {facilityName || '—'} | <strong>Care Giver:</strong> {userProfile?.full_name ?? '—'}</p>
          {(() => {
            const s = summaryForm
            const currentWtNum = s.wt != null && s.wt.trim() !== '' ? parseFloat(s.wt) : NaN
            const previousWtNum = previousSummary?.wt != null && previousSummary.wt.trim() !== '' ? parseFloat(previousSummary.wt) : NaN
            const weightDiff = !Number.isNaN(currentWtNum) && !Number.isNaN(previousWtNum) ? currentWtNum - previousWtNum : null
            const weightUnit = (s.weight_unit === 'kg' || s.weight_unit === 'lbs') ? s.weight_unit : 'lbs'
            const v = (x: string | null | undefined) => (x ?? '—') as string
            return (
              <>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Monthly Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-2">
                    <div>B.P.: {v(s.bp)}</div>
                    <div>P.: {v(s.pulse)}</div>
                    <div>R.: {v(s.resp)}</div>
                    <div>Temp.: {v(s.temp)}</div>
                    <div>Wt.: {v(s.wt)} {s.weight_unit ?? 'lbs'}</div>
                    <div>Wt. Change Y/N: {v(s.wt_change_yn)}{weightDiff != null ? ` (${weightDiff > 0 ? '+' : ''}${weightDiff} ${weightUnit})` : ''}</div>
                  </div>
                  <div>Response to Diet: {v(s.response_to_diet)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Medication</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    <div>Medication available Y/N: {v(s.medication_available_yn)}</div>
                    <div>Medication secured Y/N: {v(s.medication_secured_yn)}</div>
                    <div>Taking medications Y/N: {v(s.taking_medications_yn)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Physician Notified Y/N: {v(s.physician_notified_yn)}</div>
                    <div>Date: {v(s.physician_notified_date)}</div>
                  </div>
                  <div className="mb-2">Medication Changes Y/N: {v(s.medication_changes_yn)}</div>
                  <div>Response to Medication: {v(s.response_to_medication)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Treatments</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Treatments Y/N: {v(s.treatments_yn)}</div>
                    <div>Type: {v(s.treatments_type)}</div>
                  </div>
                  <div className="mb-2">Response to Treatment: {v(s.response_to_treatment)}</div>
                  <div className="mb-2">Therapy Y/N: {v(s.therapy_yn)}</div>
                  <div className="grid grid-cols-3 gap-2">PT: {v(s.therapy_pt)} | OT: {v(s.therapy_ot)} | ST: {v(s.therapy_st)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">ADL / Ambulation / Continence / BM</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>ADL: {v(s.adl_level)}</div>
                    <div>Ambulation: {v(s.ambulation)}</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <div>Continent urine Y/N: {v(s.continent_urine_yn)}</div>
                    <div>Continent stool Y/N: {v(s.continent_stool_yn)}</div>
                    <div>Incontinent urine Y/N: {v(s.incontinent_urine_yn)}</div>
                    <div>Incontinent stool Y/N: {v(s.incontinent_stool_yn)}</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>Timed toileting Y/N: {v(s.timed_toileting_yn)}</div>
                    <div>Diapers Y/N: {v(s.diapers_yn)}</div>
                    <div>BM: {v(s.bm_type)}</div>
                  </div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Skin Integrity</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Intact Y/N: {v(s.skin_intact_yn)}</div>
                    <div>Wound Type: {v(s.wound_type)}</div>
                  </div>
                  <div className="mb-2">Location: {v(s.wound_location)}</div>
                  <div>Treatment / Response: {v(s.wound_treatment)} / {v(s.wound_response)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Pain</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Pain Y/N: {v(s.pain_yn)}</div>
                    <div>Location: {v(s.pain_location)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Intensity (0–10): {v(s.pain_intensity)}</div>
                    <div>Cause: {v(s.pain_cause)}</div>
                  </div>
                  <div>Treatment / Response: {v(s.pain_treatment)} / {v(s.pain_response)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Mental</h3>
                  <div className="mb-2">Descriptors: {v(s.mental_descriptors)}</div>
                  <div>Impaired Communication Other: {v(s.impaired_communication_other)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Changes and Actions</h3>
                  <div className="mb-2">Describe Changes: {v(s.describe_changes)}</div>
                  <div className="mb-2">Date MD Notified: {v(s.date_md_notified)}</div>
                  <div className="mb-2">Actions: {v(s.actions)}</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <div>Changes in Condition Y/N: {v(s.changes_in_condition_yn)}</div>
                    <div>Illness Y/N: {v(s.illness_yn)}</div>
                    <div>Injury Y/N: {v(s.injury_yn)}</div>
                    <div>Date Physician Notified: {v(s.date_physician_notified)}</div>
                  </div>
                  <div>Describe Type and Actions Taken: {v(s.describe_type_actions_taken)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Plan of Care</h3>
                  <div className="whitespace-pre-wrap">{v(s.plan_of_care)}</div>
                </section>
                <section className="mb-4 border border-gray-400 rounded p-3">
                  <h3 className="font-semibold mb-2">Signature / Title / Date</h3>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>Title: {v(s.signature_title)}</div>
                    <div>Date: {v(s.signature_date)}</div>
                  </div>
                  <div>
                    {((s.signature || (s.created_by === userProfile?.id && userProfile?.staff_signature)) && userProfile) ? (
                      <InitialsOrSignatureDisplay value={s.created_by === userProfile?.id && userProfile?.staff_signature ? userProfile.staff_signature! : (s.signature ?? '')} variant="signature" userProfile={userProfile} />
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </section>
              </>
            )
          })()}
        </div>

        {/* Print view: all progress notes (uses same entries state so new notes appear). Hidden on screen, shown when printing. */}
        <div className="progress-notes-print-view p-6 text-sm" style={{ display: 'none' }}>
          <h1 className="text-lg font-bold text-gray-900 mb-2">Progress Notes – All Notes</h1>
          <div className="mb-4 grid grid-cols-2 gap-2 text-gray-800">
            <div><strong>Name of ARCH:</strong> {facilityName || '—'}</div>
            <div><strong>Primary Care Giver:</strong> {userProfile?.full_name ?? '—'}</div>
            <div><strong>Resident:</strong> {patient?.patient_name ?? '—'}</div>
            {showPhysicianColumn && (
              <div>
                <strong>Physician/APRN or Clinic:</strong>{' '}
                {selectedPhysicianDisplay}
              </div>
            )}
          </div>
          <table className="w-full border border-gray-400" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Date</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Physician/APRN or Clinic</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-semibold">Notes</th>
                <th className="border border-gray-400 px-3 py-2 text-left font-semibold w-40">Signature</th>
              </tr>
            </thead>
            <tbody>
              {allMainEntries.length === 0 ? (
                <tr>
                  <td colSpan={existingNotesColumnCount} className="border border-gray-400 px-3 py-4 text-gray-500">No progress notes.</td>
                </tr>
              ) : (
                allMainEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border border-gray-400 px-3 py-2 whitespace-nowrap">{formatCalendarDate(entry.note_date, 'en-US')}</td>
                    <td className="border border-gray-400 px-3 py-2 whitespace-nowrap align-top">{physicianDisplayText(entry.physician_name) || 'n/a'}</td>
                    <td className="border border-gray-400 px-3 py-2 whitespace-pre-wrap align-top">{page1EntryNotesDisplay(entry)}</td>
                    <td className="border border-gray-400 px-3 py-2 align-top">
                      {(entry.signature || (entry.created_by === userProfile?.id && userProfile?.staff_signature)) ? (
                        <InitialsOrSignatureDisplay
                          value={entry.created_by === userProfile?.id && userProfile?.staff_signature ? userProfile.staff_signature : (entry.signature ?? '')}
                          variant="signature"
                          userProfile={userProfile}
                        />
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ProtectedRoute>
  )
}
