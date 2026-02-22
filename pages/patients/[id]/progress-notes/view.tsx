import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import AppHeader from '../../../../components/AppHeader'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile } from '../../../../lib/auth'
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
        style={{
          fontFamily: `"${font}", cursive`,
          fontSize: variant === 'initials' ? '1.1em' : '1.4em',
          verticalAlign: 'middle'
        }}
      >
        {displayText}
      </span>
    )
  }
  if (value.startsWith('data:image')) {
    return (
      <img
        src={value}
        alt={variant === 'initials' ? 'Initials' : 'Signature'}
        style={{ maxHeight: variant === 'initials' ? '1.25em' : '1.75em', maxWidth: variant === 'initials' ? '3em' : '8em', verticalAlign: 'middle', display: 'inline-block' }}
      />
    )
  }
  return <span>{value}</span>
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
  const [selectedPhysician, setSelectedPhysician] = useState<string>('')
  const [customPhysician, setCustomPhysician] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // New entry being added (unsaved row)
  const [newDate, setNewDate] = useState<string>(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })
  const [newNotes, setNewNotes] = useState('')
  // User must explicitly sign to confirm the note (saved signature is applied on "Sign")
  const [newNoteSigned, setNewNoteSigned] = useState(false)
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
  const readOnly = isReadOnly

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
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()
      if (patientError || !patientData) {
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

      const { data: physData } = await supabase
        .from('patients')
        .select('physician_name')
        .eq('hospital_id', patientData.hospital_id)
        .not('physician_name', 'is', null)
      const distinct = Array.from(new Set((physData || []).map((p: any) => p.physician_name?.trim()).filter(Boolean))).sort() as string[]
      setPhysicians(distinct)
      if (patientData.physician_name && distinct.includes(patientData.physician_name)) {
        setSelectedPhysician(patientData.physician_name)
      }

      const { data: entriesData, error: entriesError } = await supabase
        .from('progress_note_entries')
        .select('*')
        .eq('patient_id', patientId)
        .order('note_date', { ascending: false })
      const entriesList = entriesError ? [] : ((entriesData || []) as ProgressNoteEntry[]).map(e => ({ ...e, is_addendum: e.is_addendum ?? false }))
      setEntries(entriesList)

      // Pre-fill Physician/APRN: localStorage (most reliable) > last note > patient record
      const storageKey = `progress-notes-physician-${patientId}`
      const stored = (typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null)?.trim() || ''
      const lastPhysician = entriesList.find(e => e.physician_name?.trim())?.physician_name?.trim()
      const patientPhysician = patientData.physician_name?.trim() || ''
      const physicianToUse = (stored && stored !== 'TBD') ? stored : (lastPhysician || (patientPhysician !== 'TBD' ? patientPhysician : ''))
      if (physicianToUse) {
        if (distinct.includes(physicianToUse)) {
          setSelectedPhysician(physicianToUse)
          setCustomPhysician('')
        } else {
          setSelectedPhysician('')
          setCustomPhysician(physicianToUse)
        }
      } else if (patientData.physician_name && distinct.includes(patientData.physician_name)) {
        setSelectedPhysician(patientData.physician_name)
      }

      setLoading(false)
    }
    load()
  }, [patientId, router])

  // Debounced save of Physician/APRN to patient record so typed value persists
  useEffect(() => {
    const physician = (selectedPhysician || customPhysician.trim() || '').trim()
    if (!patientId || typeof patientId !== 'string' || !physician) return
    const currentPatientPhysician = patient?.physician_name?.trim() || ''
    if (physician === currentPatientPhysician) return
    if (savePhysicianTimeoutRef.current) clearTimeout(savePhysicianTimeoutRef.current)
    savePhysicianTimeoutRef.current = setTimeout(async () => {
      savePhysicianTimeoutRef.current = null
      const storageKey = `progress-notes-physician-${patientId}`
      if (typeof window !== 'undefined') localStorage.setItem(storageKey, physician || 'TBD')
      const { error: updateErr } = await supabase
        .from('patients')
        .update({ physician_name: physician || 'TBD', updated_at: new Date().toISOString() })
        .eq('id', patientId)
      if (!updateErr) {
        setPatient(prev => prev ? { ...prev, physician_name: physician } : null)
      }
      setMessage('Saved')
      setTimeout(() => setMessage(''), 2000)
    }, 600)
    return () => { if (savePhysicianTimeoutRef.current) clearTimeout(savePhysicianTimeoutRef.current) }
  }, [patientId, patient, selectedPhysician, customPhysician])

  const refetchEntries = async () => {
    if (!patientId || typeof patientId !== 'string') return
    const { data: entriesData, error: entriesError } = await supabase
      .from('progress_note_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('note_date', { ascending: false })
    if (!entriesError) setEntries((entriesData || []).map((e: ProgressNoteEntry) => ({ ...e, is_addendum: e.is_addendum ?? false })))
  }

  const handleAddEntry = async () => {
    if (!userProfile || !patientId || !newNotes.trim()) {
      setError('Please enter notes.')
      return
    }
    if (!newNoteSigned) {
      setError('Please sign to confirm this note.')
      return
    }
    setSaving(true)
    setError('')
    const physician = selectedPhysician || customPhysician.trim() || null
    const { error: insertError } = await supabase
      .from('progress_note_entries')
      .insert({
        patient_id: patientId,
        note_date: newDate,
        notes: newNotes.trim(),
        signature: userProfile.staff_signature || null,
        physician_name: physician,
        is_addendum: false,
        created_by: userProfile.id
      })
    if (insertError) {
      setError(insertError.message)
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
        return key ? `${key}-01` : new Date().toISOString().slice(0, 10)
      })()
    )
    setNewNoteSigned(false)
    const { data: entriesData } = await supabase
      .from('progress_note_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('note_date', { ascending: false })
    setEntries(entriesData || [])
    setSaving(false)
  }

  /** Sync Progress Note Page 1 → MAR: set all MAR administration notes for this patient+date to the given notes. */
  const syncProgressNoteToMAR = async (patientId: string, noteDate: string, notes: string) => {
    const dateStr = noteDate.includes('T') ? noteDate.slice(0, 10) : noteDate
    const monthYear = dateStr.slice(0, 7)
    const day = parseInt(dateStr.slice(8, 10), 10)
    if (!monthYear || Number.isNaN(day)) return
    const { data: forms } = await supabase.from('mar_forms').select('id').eq('patient_id', patientId).eq('month_year', monthYear)
    if (!forms?.length) return
    const formIds = forms.map((f: { id: string }) => f.id)
    const { data: meds } = await supabase.from('mar_medications').select('id').in('mar_form_id', formIds)
    if (!meds?.length) return
    const medIds = meds.map((m: { id: string }) => m.id)
    const { data: admins } = await supabase.from('mar_administrations').select('id').in('mar_medication_id', medIds).eq('day_number', day)
    if (!admins?.length) return
    const adminIds = admins.map((a: { id: string }) => a.id)
    await supabase.from('mar_administrations').update({ notes: notes || null, updated_at: new Date().toISOString() }).in('id', adminIds)
  }

  const PAGE1_ENTRY_DEBOUNCE_MS = 600
  const page1SaveMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const entryNotesRef = useRef<Record<string, string>>({})
  const entrySaveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const handleUpdateEntry = async (entryId: string, notes: string, noteDate: string) => {
    if (page1SaveMessageTimeoutRef.current) clearTimeout(page1SaveMessageTimeoutRef.current)
    setMessage('Saving...')
    const { error: updateError } = await supabase
      .from('progress_note_entries')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', entryId)
    if (!updateError) {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, notes } : e))
      if (patientId && typeof patientId === 'string' && noteDate) {
        await syncProgressNoteToMAR(patientId, noteDate, notes)
      }
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

  const handleSignEntry = async (entryId: string) => {
    if (!userProfile?.staff_signature) return
    if (page1SaveMessageTimeoutRef.current) clearTimeout(page1SaveMessageTimeoutRef.current)
    setMessage('Saving...')
    const { error } = await supabase
      .from('progress_note_entries')
      .update({ signature: userProfile.staff_signature, updated_at: new Date().toISOString() })
      .eq('id', entryId)
    if (!error) {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, signature: userProfile!.staff_signature } : e))
    }
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
      supabase.from('progress_note_monthly_summaries').select('*').eq('patient_id', patientId).eq('month_year', summaryMonthYear).maybeSingle(),
      supabase.from('progress_note_monthly_summaries').select('*').eq('patient_id', patientId).eq('month_year', prevMonth).maybeSingle(),
      supabase.from('progress_note_monthly_summaries').select('weight_unit').eq('patient_id', patientId).order('month_year', { ascending: false }).limit(1).maybeSingle()
    ]).then(([currentRes, previousRes, latestRes]) => {
      setSummaryLoading(false)
      const data = currentRes.data as ProgressNoteMonthlySummary | null
      const previous = previousRes.data as ProgressNoteMonthlySummary | null
      const latest = latestRes.data as { weight_unit?: string } | null
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
    const { id: _id, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = form
    const payload = {
      patient_id: patientId,
      month_year: summaryMonthYear,
      ...rest,
      updated_at: new Date().toISOString()
    }
    if (existing?.id) {
      const { data, error: updateError } = await supabase
        .from('progress_note_monthly_summaries')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single()
      if (!updateError && data) {
        setSummary(data as ProgressNoteMonthlySummary)
        summaryRef.current = data as ProgressNoteMonthlySummary
      }
      if (updateError) setError(updateError.message)
    } else {
      const { data, error: insertError } = await supabase
        .from('progress_note_monthly_summaries')
        .insert({ ...payload, created_by: userProfile.id })
        .select()
        .single()
      if (!insertError && data) {
        setSummary(data as ProgressNoteMonthlySummary)
        summaryRef.current = data as ProgressNoteMonthlySummary
      }
      if (insertError) setError(insertError.message)
    }
    setSummarySaving(false)
    setMessage('Saved')
    setTimeout(() => setMessage(''), 2000)
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

  return (<ProtectedRoute>
      <Head>
        <title>Progress Notes - {patient.patient_name}</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader
          patientId={typeof router.query.id === 'string' ? router.query.id : Array.isArray(router.query.id) ? router.query.id[0] : undefined}
          patientName={patient?.patient_name}
        />

        <main className="max-w-5xl mx-auto px-4 py-6">
          <Link
            href={router.query.id ? `/patients/${router.query.id}/progress-notes` : '/dashboard'}
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-2"
          >
            ← Back to Progress Notes
          </Link>
          <div className="mb-2">
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Progress Notes</h1>
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
              Page 1 – Notes & Addendum
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('page2')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'page2' ? 'bg-lasso-teal text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
            >
              Page 2 – Monthly Summary
            </button>
          </div>

          {activeTab === 'page1' && (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 className="text-center font-bold text-gray-900 dark:text-white mb-4">PROGRESS NOTES</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name of ARCH</label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-600 pb-1">
                    {facilityName || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Primary Care Giver</label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-600 pb-1">
                    {userProfile?.full_name ?? '—'}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resident Last Name</label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2">
                    {lastName || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Resident&apos;s First Name</label>
                  <div className="text-sm font-medium text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded px-3 py-2">
                    {firstName || '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Physician/APRN or Clinic</label>
                  <div className="flex gap-2">
                    <select
                      value={selectedPhysician}
                      onChange={(e) => {
                        setSelectedPhysician(e.target.value)
                        if (e.target.value) setCustomPhysician('')
                      }}
                      disabled={readOnly}
                      className={`flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal ${readOnly ? 'cursor-not-allowed opacity-90' : ''}`}
                    >
                      <option value="">Select or type below</option>
                      {physicians.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {!readOnly && (
                      <input
                        type="text"
                        placeholder="Or type custom"
                        value={customPhysician}
                        onChange={(e) => {
                          setCustomPhysician(e.target.value)
                          if (e.target.value) setSelectedPhysician('')
                        }}
                        className="flex-1 min-w-0 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 w-28">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">Notes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 w-32">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {!readOnly && (
                  <tr className="border-t border-gray-200 dark:border-gray-600 bg-lasso-teal/5">
                    <td className="px-4 py-2 align-top">
                      <input
                        type="date"
                        min={monthFilterKey ? `${monthFilterKey}-01` : undefined}
                        max={monthFilterKey ? `${monthFilterKey}-${String(getLastDayOfMonth(monthFilterKey)).padStart(2, '0')}` : undefined}
                        value={monthFilterKey && newDate && !newDate.startsWith(monthFilterKey)
                          ? `${monthFilterKey}-01`
                          : newDate
                        }
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      <textarea
                        value={newNotes}
                        onChange={(e) => setNewNotes(e.target.value)}
                        placeholder="Enter progress note..."
                        rows={3}
                        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                      />
                    </td>
                    <td className="px-4 py-2 align-top">
                      {newNoteSigned && userProfile?.staff_signature ? (
                        <div className="flex flex-col gap-1">
                          <InitialsOrSignatureDisplay
                            value={userProfile.staff_signature}
                            variant="signature"
                            userProfile={userProfile}
                          />
                          <button
                            type="button"
                            onClick={() => setNewNoteSigned(false)}
                            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                          >
                            Clear signature
                          </button>
                        </div>
                      ) : userProfile?.staff_signature ? (
                        <button
                          type="button"
                          onClick={() => { setNewNoteSigned(true); setError(''); }}
                          className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                        >
                          Sign
                        </button>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 text-sm">Set signature in Profile first</span>
                      )}
                    </td>
                  </tr>
                  )}
                  {!readOnly && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2">
                      <button
                        type="button"
                        onClick={handleAddEntry}
                        disabled={saving || !newNotes.trim() || !newNoteSigned}
                        className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {saving ? 'Saving...' : 'Add Note'}
                      </button>
                    </td>
                  </tr>
                  )}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                    <td colSpan={3} className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Existing notes</h3>
                        <button
                          type="button"
                          onClick={() => refetchEntries()}
                          className="text-xs px-2 py-1 text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10"
                        >
                          Refresh
                        </button>
                      </div>
                    </td>
                  </tr>
                  {mainEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="px-4 py-2 align-top text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {new Date(entry.note_date).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {readOnly ? (
                          <div className="w-full text-sm text-gray-900 dark:text-white whitespace-pre-wrap py-2">
                            {entry.notes}
                          </div>
                        ) : (
                          <textarea
                            value={entry.notes}
                            onChange={(e) => {
                              const v = e.target.value
                              entryNotesRef.current[entry.id] = v
                              setEntries(prev => prev.map(ex => ex.id === entry.id ? { ...ex, notes: v } : ex))
                              schedulePage1EntrySave(entry.id, entry.note_date)
                            }}
                            rows={Math.max(2, entry.notes.split('\n').length)}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2 align-top">
                        {entry.signature ? (
                          <div className="flex flex-col gap-1">
                            <InitialsOrSignatureDisplay
                              value={entry.signature}
                              variant="signature"
                              userProfile={userProfile}
                            />
                          </div>
                        ) : userProfile?.staff_signature && !readOnly ? (
                          <button
                            type="button"
                            onClick={() => handleSignEntry(entry.id)}
                            className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                          >
                            Sign
                          </button>
                        ) : !userProfile?.staff_signature ? (
                          <span className="text-amber-600 dark:text-amber-400 text-sm">Set signature in Profile first</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
          )}

          {activeTab === 'page2' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 space-y-6">
              <h2 className="text-center font-bold text-gray-900 dark:text-white">PROGRESS NOTES – Page 2 (Monthly Summary)</h2>

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
              </div>

              {/* Monthly Summary */}
              {(() => {
                const currentWtNum = summaryForm.wt != null && summaryForm.wt.trim() !== '' ? parseFloat(summaryForm.wt) : NaN
                const previousWtNum = previousSummary?.wt != null && previousSummary.wt.trim() !== '' ? parseFloat(previousSummary.wt) : NaN
                const hasWeightChange = !Number.isNaN(currentWtNum) && !Number.isNaN(previousWtNum)
                const weightDiff = hasWeightChange ? currentWtNum - previousWtNum : null
                const weightUnit = (summaryForm.weight_unit === 'kg' || summaryForm.weight_unit === 'lbs') ? summaryForm.weight_unit : 'lbs'
                return (
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Plan of Care</h3>
                <textarea value={summaryForm.plan_of_care ?? ''} onChange={(e) => updateSummaryField('plan_of_care', e.target.value)} disabled={readOnly} rows={4} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
              </section>

              {/* Signature / Title / Date */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
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
                  {summaryForm.signature && userProfile ? (
                    <div className="flex flex-col gap-1">
                      <InitialsOrSignatureDisplay value={summaryForm.signature} variant="signature" userProfile={userProfile} />
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
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}
