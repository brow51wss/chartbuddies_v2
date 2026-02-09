import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth'
import type { UserProfile, Patient } from '../../../types/auth'
import type { ProgressNoteEntry, ProgressNoteMonthlySummary } from '../../../types/progress-notes'

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

/** Y/N radio group styled as a switch (pill with two segments) */
function YnSwitch({
  value,
  onChange,
  className = ''
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  className?: string
}) {
  const v = value ?? ''
  return (
    <div
      role="radiogroup"
      aria-label="Yes or No"
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`}
    >
      <label className="flex-1 cursor-pointer">
        <input
          type="radio"
          name={undefined}
          checked={v === 'N'}
          onChange={() => onChange('N')}
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
      <label className="flex-1 cursor-pointer border-l border-gray-300 dark:border-gray-600">
        <input
          type="radio"
          name={undefined}
          checked={v === 'Y'}
          onChange={() => onChange('Y')}
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
  className = ''
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  className?: string
}) {
  const v = (value ?? 'lbs') === 'kg' ? 'kg' : 'lbs'
  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
      className={`inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700 ${className}`}
    >
      <label className="flex-1 cursor-pointer">
        <input type="radio" checked={v === 'lbs'} onChange={() => onChange('lbs')} className="sr-only" />
        <span className={`block px-2 py-1 text-center text-xs font-medium transition-colors ${v === 'lbs' ? 'bg-lasso-teal text-white' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>lbs</span>
      </label>
      <label className="flex-1 cursor-pointer border-l border-gray-300 dark:border-gray-600">
        <input type="radio" checked={v === 'kg'} onChange={() => onChange('kg')} className="sr-only" />
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
  // Addendum row (additional progress notes / reverse side)
  const [newAddendumDate, setNewAddendumDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [newAddendumNotes, setNewAddendumNotes] = useState('')
  const [newAddendumSigned, setNewAddendumSigned] = useState(false)

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
      if (!entriesError) setEntries((entriesData || []).map((e: ProgressNoteEntry) => ({ ...e, is_addendum: e.is_addendum ?? false })))
      setLoading(false)
    }
    load()
  }, [patientId, router])

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
    setNewDate(new Date().toISOString().slice(0, 10))
    setNewNoteSigned(false)
    const { data: entriesData } = await supabase
      .from('progress_note_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('note_date', { ascending: false })
    setEntries(entriesData || [])
    setSaving(false)
  }

  const handleAddAddendumEntry = async () => {
    if (!userProfile || !patientId || !newAddendumNotes.trim()) {
      setError('Please enter addendum notes.')
      return
    }
    if (!newAddendumSigned) {
      setError('Please sign to confirm this addendum.')
      return
    }
    setSaving(true)
    setError('')
    const physician = selectedPhysician || customPhysician.trim() || null
    const { error: insertError } = await supabase
      .from('progress_note_entries')
      .insert({
        patient_id: patientId,
        note_date: newAddendumDate,
        notes: newAddendumNotes.trim(),
        signature: userProfile.staff_signature || null,
        physician_name: physician,
        is_addendum: true,
        created_by: userProfile.id
      })
    if (insertError) {
      setError(insertError.message)
      setSaving(false)
      return
    }
    setMessage('Addendum added.')
    setTimeout(() => setMessage(''), 3000)
    setNewAddendumNotes('')
    setNewAddendumDate(new Date().toISOString().slice(0, 10))
    setNewAddendumSigned(false)
    const { data: entriesData } = await supabase
      .from('progress_note_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('note_date', { ascending: false })
    setEntries((entriesData || []).map((e: ProgressNoteEntry) => ({ ...e, is_addendum: e.is_addendum ?? false })))
    setSaving(false)
  }

  const handleUpdateEntry = async (entryId: string, notes: string) => {
    const { error: updateError } = await supabase
      .from('progress_note_entries')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', entryId)
    if (!updateError) {
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, notes } : e))
    }
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
      setPreviousSummary(previous)
      if (data) {
        const form: Partial<ProgressNoteMonthlySummary> = { ...data }
        const currentWt = data.wt != null && data.wt.trim() !== '' ? parseFloat(data.wt) : NaN
        const previousWt = previous?.wt != null && previous.wt.trim() !== '' ? parseFloat(previous.wt) : NaN
        if (!Number.isNaN(currentWt) && !Number.isNaN(previousWt)) {
          form.wt_change_yn = 'Y'
        }
        setSummaryForm(form)
      } else {
        setSummaryForm({
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
        })
      }
    })
  }, [activeTab, patientId, summaryMonthYear])

  function updateSummaryField<K extends keyof ProgressNoteMonthlySummary>(key: K, value: ProgressNoteMonthlySummary[K]) {
    setSummaryForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSaveSummary = async () => {
    if (!userProfile || !patientId) return
    setSummarySaving(true)
    setError('')
    const { id: _id, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = summaryForm
    const payload = {
      patient_id: patientId,
      month_year: summaryMonthYear,
      ...rest,
      updated_at: new Date().toISOString()
    }
    if (summary?.id) {
      const { data, error: updateError } = await supabase
        .from('progress_note_monthly_summaries')
        .update(payload)
        .eq('id', summary.id)
        .select()
        .single()
      if (!updateError && data) setSummary(data as ProgressNoteMonthlySummary)
      if (updateError) setError(updateError.message)
    } else {
      const { data, error: insertError } = await supabase
        .from('progress_note_monthly_summaries')
        .insert({ ...payload, created_by: userProfile.id })
        .select()
        .single()
      if (!insertError && data) setSummary(data as ProgressNoteMonthlySummary)
      if (insertError) setError(insertError.message)
    }
    setSummarySaving(false)
    setMessage('Monthly summary saved.')
    setTimeout(() => setMessage(''), 3000)
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
  const mainEntries = entries.filter(e => !e.is_addendum)
  const addendumEntries = entries.filter(e => e.is_addendum)

  return (<ProtectedRoute>
      <Head>
        <title>Progress Notes - {patient.patient_name}</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard?module=progress"
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm font-medium"
              >
                ← Back to Progress Notes
              </Link>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Progress Notes</h1>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200 text-sm">
              {message}
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
                      className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                    >
                      <option value="">Select or type below</option>
                      {physicians.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
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
                  <tr className="border-t border-gray-200 dark:border-gray-600 bg-lasso-teal/5">
                    <td className="px-4 py-2 align-top">
                      <input
                        type="date"
                        value={newDate}
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
                  {mainEntries.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-600">
                      <td className="px-4 py-2 align-top text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {new Date(entry.note_date).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-4 py-2 align-top">
                        <textarea
                          defaultValue={entry.notes}
                          onBlur={(e) => {
                            const v = e.target.value
                            if (v !== entry.notes) handleUpdateEntry(entry.id, v)
                          }}
                          rows={Math.max(2, entry.notes.split('\n').length)}
                          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        {entry.signature ? (
                          <InitialsOrSignatureDisplay
                            value={entry.signature}
                            variant="signature"
                            userProfile={userProfile}
                          />
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Progress Notes / Addendum – own box below progress notes */}
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">Additional Progress Notes / Addendum</h3>
              <p className="text-sm italic text-gray-600 dark:text-gray-400 mb-4">
                Additional Progress Notes and/or Addendum are charted on the reverse side of page.
              </p>
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
                    <tr className="border-t border-gray-200 dark:border-gray-600 bg-lasso-teal/5">
                      <td className="px-4 py-2 align-top">
                        <input
                          type="date"
                          value={newAddendumDate}
                          onChange={(e) => setNewAddendumDate(e.target.value)}
                          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        <textarea
                          value={newAddendumNotes}
                          onChange={(e) => setNewAddendumNotes(e.target.value)}
                          placeholder="Enter addendum or additional note..."
                          rows={3}
                          className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                        />
                      </td>
                      <td className="px-4 py-2 align-top">
                        {newAddendumSigned && userProfile?.staff_signature ? (
                          <div className="flex flex-col gap-1">
                            <InitialsOrSignatureDisplay
                              value={userProfile.staff_signature}
                              variant="signature"
                              userProfile={userProfile}
                            />
                            <button
                              type="button"
                              onClick={() => setNewAddendumSigned(false)}
                              className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline"
                            >
                              Clear signature
                            </button>
                          </div>
                        ) : userProfile?.staff_signature ? (
                          <button
                            type="button"
                            onClick={() => { setNewAddendumSigned(true); setError(''); }}
                            className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                          >
                            Sign
                          </button>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 text-sm">Set signature in Profile first</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="px-4 py-2">
                        <button
                          type="button"
                          onClick={handleAddAddendumEntry}
                          disabled={saving || !newAddendumNotes.trim() || !newAddendumSigned}
                          className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {saving ? 'Saving...' : 'Add Addendum'}
                        </button>
                      </td>
                    </tr>
                    {addendumEntries.map((entry) => (
                      <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-600">
                        <td className="px-4 py-2 align-top text-sm text-gray-900 dark:text-white whitespace-nowrap">
                          {new Date(entry.note_date).toLocaleDateString('en-US')}
                        </td>
                        <td className="px-4 py-2 align-top">
                          <textarea
                            defaultValue={entry.notes}
                            onBlur={(e) => {
                              const v = e.target.value
                              if (v !== entry.notes) handleUpdateEntry(entry.id, v)
                            }}
                            rows={Math.max(2, entry.notes.split('\n').length)}
                            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-lasso-teal"
                          />
                        </td>
                        <td className="px-4 py-2 align-top">
                          {entry.signature ? (
                            <InitialsOrSignatureDisplay
                              value={entry.signature}
                              variant="signature"
                              userProfile={userProfile}
                            />
                          ) : (
                            <span className="text-gray-400 text-sm">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </>
          )}

          {activeTab === 'page2' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 space-y-6">
              <h2 className="text-center font-bold text-gray-900 dark:text-white">PROGRESS NOTES – Page 2 (Monthly Summary)</h2>

              {/* Month/Year selector */}
              <div className="flex flex-wrap items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Month / Year:</label>
                <input
                  type="month"
                  value={summaryMonthYear}
                  onChange={(e) => setSummaryMonthYear(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1.5 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {summaryLoading && <span className="text-sm text-gray-500">Loading...</span>}
                <button
                  type="button"
                  onClick={handleSaveSummary}
                  disabled={summaryLoading || summarySaving}
                  className="ml-auto px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue disabled:opacity-50"
                >
                  {summarySaving ? 'Saving...' : 'Save Summary'}
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
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Monthly Summary</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                  {(['bp', 'pulse', 'resp', 'temp'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">{f === 'bp' ? 'B.P.' : f === 'pulse' ? 'P.' : f === 'resp' ? 'R.' : 'Temp.'}</label>
                      <input type="text" value={summaryForm[f] ?? ''} onChange={(e) => updateSummaryField(f, e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wt.</label>
                    <div className="flex items-center gap-2">
                      <input type="text" value={summaryForm.wt ?? ''} onChange={(e) => updateSummaryField('wt', e.target.value)} className="flex-1 min-w-0 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                      <KgLbsSwitch value={summaryForm.weight_unit ?? 'lbs'} onChange={(v) => updateSummaryField('weight_unit', v)} className="shrink-0" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Wt. Change Y/N</label>
                    <YnSwitch value={summaryForm.wt_change_yn ?? ''} onChange={(v) => updateSummaryField('wt_change_yn', v)} className="w-full" />
                    {weightDiff !== null && (
                      <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                        {weightDiff > 0 ? `+${weightDiff}` : weightDiff < 0 ? `${weightDiff}` : '+0'} {weightUnit}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Diet</label>
                  <input type="text" value={summaryForm.response_to_diet ?? ''} onChange={(e) => updateSummaryField('response_to_diet', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
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
                      <YnSwitch value={summaryForm[f] ?? ''} onChange={(v) => updateSummaryField(f, v)} className="w-full" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Physician Notified Y/N</label>
                    <YnSwitch value={summaryForm.physician_notified_yn ?? ''} onChange={(v) => updateSummaryField('physician_notified_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Date</label>
                    <input type="date" value={summaryForm.physician_notified_date ?? ''} onChange={(e) => updateSummaryField('physician_notified_date', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Medication Changes Y/N</label>
                    <YnSwitch value={summaryForm.medication_changes_yn ?? ''} onChange={(v) => updateSummaryField('medication_changes_yn', v)} className="w-full" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Medication</label>
                  <input type="text" value={summaryForm.response_to_medication ?? ''} onChange={(e) => updateSummaryField('response_to_medication', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Treatments */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Treatments</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Treatments Y/N</label>
                    <YnSwitch value={summaryForm.treatments_yn ?? ''} onChange={(v) => updateSummaryField('treatments_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Type</label>
                    <input type="text" value={summaryForm.treatments_type ?? ''} onChange={(e) => updateSummaryField('treatments_type', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Response to Treatment</label>
                  <input type="text" value={summaryForm.response_to_treatment ?? ''} onChange={(e) => updateSummaryField('response_to_treatment', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Therapy Y/N</label>
                    <YnSwitch value={summaryForm.therapy_yn ?? ''} onChange={(v) => updateSummaryField('therapy_yn', v)} className="w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(['therapy_pt', 'therapy_ot', 'therapy_st'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">{f === 'therapy_pt' ? 'PT' : f === 'therapy_ot' ? 'OT' : 'ST'}</label>
                      <input type="text" value={summaryForm[f] ?? ''} onChange={(e) => updateSummaryField(f, e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
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
                    <select value={summaryForm.adl_level ?? ''} onChange={(e) => updateSummaryField('adl_level', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option><option value="Independent">Independent</option><option value="Minimal">Minimal</option><option value="Moderate">Moderate</option><option value="Maximum">Maximum</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Ambulation</label>
                    <select value={summaryForm.ambulation ?? ''} onChange={(e) => updateSummaryField('ambulation', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
                      <option value="">—</option><option value="Independent">Independent</option><option value="Walker">Walker</option><option value="Cane">Cane</option><option value="W/C">W/C</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  {(['continent_urine_yn', 'continent_stool_yn', 'incontinent_urine_yn', 'incontinent_stool_yn'] as const).map(f => (
                    <div key={f}>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{f.replace(/_yn$/, '').replace(/_/g, ' ')} Y/N</label>
                      <YnSwitch value={summaryForm[f] ?? ''} onChange={(v) => updateSummaryField(f, v)} className="w-full" />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Timed toileting Y/N</label>
                    <YnSwitch value={summaryForm.timed_toileting_yn ?? ''} onChange={(v) => updateSummaryField('timed_toileting_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Diapers Y/N</label>
                    <YnSwitch value={summaryForm.diapers_yn ?? ''} onChange={(v) => updateSummaryField('diapers_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">BM</label>
                    <select value={summaryForm.bm_type ?? ''} onChange={(e) => updateSummaryField('bm_type', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white">
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
                    <YnSwitch value={summaryForm.skin_intact_yn ?? ''} onChange={(v) => updateSummaryField('skin_intact_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Wound Type</label>
                    <input type="text" value={summaryForm.wound_type ?? ''} onChange={(e) => updateSummaryField('wound_type', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Location</label>
                    <input type="text" value={summaryForm.wound_location ?? ''} onChange={(e) => updateSummaryField('wound_location', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Treatment / Response to Treatment</label>
                  <input type="text" value={summaryForm.wound_treatment ?? ''} onChange={(e) => updateSummaryField('wound_treatment', e.target.value)} placeholder="Treatment" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white mb-1" />
                  <input type="text" value={summaryForm.wound_response ?? ''} onChange={(e) => updateSummaryField('wound_response', e.target.value)} placeholder="Response" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Pain */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Pain</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pain Y/N</label>
                    <YnSwitch value={summaryForm.pain_yn ?? ''} onChange={(v) => updateSummaryField('pain_yn', v)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Location</label>
                    <input type="text" value={summaryForm.pain_location ?? ''} onChange={(e) => updateSummaryField('pain_location', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Intensity (0–10)</label>
                    <input type="text" value={summaryForm.pain_intensity ?? ''} onChange={(e) => updateSummaryField('pain_intensity', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Cause</label>
                    <input type="text" value={summaryForm.pain_cause ?? ''} onChange={(e) => updateSummaryField('pain_cause', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Treatment / Response to Treatment</label>
                  <input type="text" value={summaryForm.pain_treatment ?? ''} onChange={(e) => updateSummaryField('pain_treatment', e.target.value)} placeholder="Treatment" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white mb-1" />
                  <input type="text" value={summaryForm.pain_response ?? ''} onChange={(e) => updateSummaryField('pain_response', e.target.value)} placeholder="Response" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Mental Status */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Mental</h3>
                <div className="mb-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Select all that apply (comma-separated or type)</label>
                  <input type="text" value={summaryForm.mental_descriptors ?? ''} onChange={(e) => updateSummaryField('mental_descriptors', e.target.value)} placeholder="e.g. Oriented, Pleasant, Forgetful" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Options: Oriented, Pleasant, Happy, Forgetful, Wanders, Disoriented, Depressed, Withdrawn, Angry, Agitated, Delusions, Hallucinations, Suicidal/Homicidal, Physical Hostile, Verbal Hostile, Destructive</p>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Impaired Communication Other</label>
                  <input type="text" value={summaryForm.impaired_communication_other ?? ''} onChange={(e) => updateSummaryField('impaired_communication_other', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                </div>
              </section>

              {/* Changes and Actions */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Changes and Actions</h3>
                <div className="space-y-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Describe Changes</label>
                    <input type="text" value={summaryForm.describe_changes ?? ''} onChange={(e) => updateSummaryField('describe_changes', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Date MD Notified</label>
                      <input type="date" value={summaryForm.date_md_notified ?? ''} onChange={(e) => updateSummaryField('date_md_notified', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Actions</label>
                    <input type="text" value={summaryForm.actions ?? ''} onChange={(e) => updateSummaryField('actions', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Changes in Condition Y/N</label>
                      <YnSwitch value={summaryForm.changes_in_condition_yn ?? ''} onChange={(v) => updateSummaryField('changes_in_condition_yn', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Illness Y/N</label>
                      <YnSwitch value={summaryForm.illness_yn ?? ''} onChange={(v) => updateSummaryField('illness_yn', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Injury Y/N</label>
                      <YnSwitch value={summaryForm.injury_yn ?? ''} onChange={(v) => updateSummaryField('injury_yn', v)} className="w-full" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400">Date Physician Notified</label>
                      <input type="date" value={summaryForm.date_physician_notified ?? ''} onChange={(e) => updateSummaryField('date_physician_notified', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Describe Type and Actions Taken</label>
                    <textarea value={summaryForm.describe_type_actions_taken ?? ''} onChange={(e) => updateSummaryField('describe_type_actions_taken', e.target.value)} rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
              </section>

              {/* Plan of Care */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Plan of Care</h3>
                <textarea value={summaryForm.plan_of_care ?? ''} onChange={(e) => updateSummaryField('plan_of_care', e.target.value)} rows={4} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
              </section>

              {/* Signature / Title / Date */}
              <section className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Signature / Title / Date</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Title</label>
                    <input type="text" value={summaryForm.signature_title ?? ''} onChange={(e) => updateSummaryField('signature_title', e.target.value)} placeholder="e.g. RN, LPN" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Date</label>
                    <input type="date" value={summaryForm.signature_date ?? ''} onChange={(e) => updateSummaryField('signature_date', e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700 text-gray-900 dark:text-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Signature</label>
                  {summaryForm.signature && userProfile ? (
                    <div className="flex flex-col gap-1">
                      <InitialsOrSignatureDisplay value={summaryForm.signature} variant="signature" userProfile={userProfile} />
                      <button
                        type="button"
                        onClick={() => updateSummaryField('signature', null)}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline w-fit"
                      >
                        Clear signature
                      </button>
                    </div>
                  ) : userProfile?.staff_signature ? (
                    <button
                      type="button"
                      onClick={() => updateSummaryField('signature', userProfile.staff_signature)}
                      className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                    >
                      Sign
                    </button>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400 text-sm">Set signature in Profile first</span>
                  )}
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
