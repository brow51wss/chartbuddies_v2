import { useState, useEffect, useCallback, useRef, type ReactNode, type RefObject } from 'react'
import Link from 'next/link'
import type { Patient, UserProfile } from '../types/auth'
import {
  rdsListMarForms,
  rdsListMarMedications,
  rdsListAdministrations,
  rdsUpsertAdministration,
  rdsListPrnMedications,
  rdsListPrnRecords,
  rdsCreatePrnMedication,
  rdsPatchPrnMedication,
  rdsDeletePrnMedication,
  rdsPatchMarMedication,
  rdsDeleteMarMedication,
  rdsCreateMarMedication,
} from '../lib/rdsApi'

type MarView = 'yesterday' | 'today' | 'tomorrow' | 'week' | 'month'

const VIEW_LABELS: Record<MarView, string> = {
  yesterday: 'Yesterday',
  today:     'Today',
  tomorrow:  'Tomorrow',
  week:      'Week',
  month:     'Month grid',
}

function getUserInitials(p: UserProfile): string {
  if (p.staff_initials_text) return p.staff_initials_text.toUpperCase()
  const fn = (p as any).first_name?.trim()?.[0] || ''
  const ln = (p as any).last_name?.trim()?.[0] || ''
  if (fn && ln) return (fn + ln).toUpperCase()
  return (
    p.full_name.split(' ').filter(Boolean).slice(0, 2)
      .map((w: string) => w[0]).join('').toUpperCase() || '?'
  )
}

function parseMedTime(h: number | string | null | undefined): { hours: number; minutes: number } | null {
  if (h == null || h === '') return null
  if (typeof h === 'number' && !isNaN(h)) {
    return { hours: Math.trunc(h), minutes: Math.round((h % 1) * 60) }
  }
  const s = String(h).trim()
  const ampm = s.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)$/i)
  if (ampm) {
    let hours = parseInt(ampm[1], 10)
    const minutes = parseInt(ampm[2] || '0', 10)
    hours = hours % 12
    if (/p/i.test(ampm[3])) hours += 12
    return { hours, minutes }
  }
  const hm = s.match(/^(\d{1,2})(?::(\d{2}))?/)
  if (!hm) return null
  const hours = parseInt(hm[1], 10)
  if (isNaN(hours)) return null
  return { hours, minutes: parseInt(hm[2] || '0', 10) }
}

function fmtHour(h: number | string | null | undefined): string {
  const t = parseMedTime(h)
  if (!t) return h == null || h === '' ? '—' : String(h)
  const ampm = t.hours < 12 ? 'AM' : 'PM'
  const h12 = t.hours % 12 === 0 ? 12 : t.hours % 12
  return `${h12}:${String(t.minutes).padStart(2, '0')} ${ampm}`
}

function medTimeMinutes(h: number | string | null | undefined): number {
  const t = parseMedTime(h)
  return t ? t.hours * 60 + t.minutes : 99 * 60
}

function medDetailLine(med: any): string {
  return [
    med.dosage,
    med.frequency_display || (med.frequency > 1 ? `${med.frequency} times per day` : null),
    med.hour != null && med.hour !== '' ? fmtHour(med.hour) : null,
    med.route,
    med.notes,
  ].filter(Boolean).join(' · ')
}

function dayPassSchedule(med: any): string {
  return [
    med.dosage,
    med.frequency_display || (med.frequency > 1 ? `${med.frequency} times per day` : null),
    med.route,
    med.notes,
  ].filter(Boolean).join(' · ')
}

/** Shared name + descriptor type — 12px name to match the grid "Medication" label. */
function MedIdentity({
  name,
  detail,
  discontinued,
  badge,
}: {
  name: string
  detail?: string | null
  discontinued?: boolean
  badge?: ReactNode
}) {
  return (
    <>
      <div className="text-xs font-extrabold text-gray-900 dark:text-white leading-tight">
        {name}
        {badge}
        {discontinued && (
          <span className="ml-1.5 text-[10px] font-bold text-gray-400 border border-gray-200 dark:border-gray-600 rounded px-1">D/C</span>
        )}
      </div>
      {detail ? (
        <div className="text-xs text-gray-400 mt-0.5">{detail}</div>
      ) : null}
    </>
  )
}

function parseList(v: string | null | undefined): string[] {
  if (!v) return []
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

function cellAvatarLabel(initials: string | null | undefined): string | null {
  if (!initials) return null
  const raw = String(initials).trim()
  if (!raw) return null
  if (raw.startsWith('s3:') || raw.startsWith('data:')) return null
  const upper = raw.toUpperCase()
  if (['DC', 'R', 'W', 'H'].includes(upper)) return null
  return raw
}

function CellAvatar({ value }: { value: string | null | undefined }) {
  const imgSrc = value?.startsWith('s3:')
    ? `/api/signature-image?key=${encodeURIComponent(value.slice(3))}`
    : value?.startsWith('data:image')
      ? value
      : null
  const label = cellAvatarLabel(value)
  if (!imgSrc && !label) return null
  return (
    <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-lasso-teal text-white font-extrabold leading-none overflow-hidden"
      style={{ fontSize: '8px' }}>
      {imgSrc ? (
        <img src={imgSrc} alt="" className="w-full h-full object-cover" />
      ) : (
        label
      )}
    </span>
  )
}

function StatusKindIcon({ kind }: { kind: 'Given' | 'DC' | 'R' | 'W' }) {
  if (kind === 'Given') {
    return (
      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (kind === 'DC') {
    return (
      <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8.6 2h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6L8.6 2z" />
        <path fill="white" d="M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    )
  }
  if (kind === 'R') {
    return (
      <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 4V12M10 4a2 2 0 00-4 0v8M10 4a2 2 0 014 0v4m0 0V6a2 2 0 014 0v6M14 8v4m0 0v-4m0 4v2m0 0a6 6 0 01-6 6H7a6 6 0 01-6-6v-2a2 2 0 014 0" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" rx="1.5" />
      <rect x="14" y="4" width="4" height="16" rx="1.5" />
    </svg>
  )
}

function AdminStatusMark({
  kind,
  initials,
  hasNotes,
}: {
  kind: 'Given' | 'DC' | 'R' | 'W'
  initials?: string | null
  hasNotes?: boolean
}) {
  return (
    <span className="relative inline-flex flex-col items-center justify-center gap-0.5">
      {hasNotes && (
        <span className="absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full bg-red-500 pointer-events-none" />
      )}
      <StatusKindIcon kind={kind} />
      <CellAvatar value={initials} />
    </span>
  )
}

type StatusPillKind = 'Given' | 'DC' | 'R' | 'W' | 'Missed' | 'Due'

const STATUS_PILL_CLASS: Record<StatusPillKind, string> = {
  Given:  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  DC:     'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  R:      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  W:      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Missed: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  Due:    'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
}

const STATUS_PILL_LABEL: Record<StatusPillKind, string> = {
  Given:  'Given',
  DC:     'Discontinued',
  R:      'Refused',
  W:      'Withheld',
  Missed: 'Missed',
  Due:    'Due',
}

function StatusTextPill({
  kind,
  hasNotes,
  onClick,
  disabled,
}: {
  kind: StatusPillKind
  hasNotes?: boolean
  onClick?: () => void
  disabled?: boolean
}) {
  const showKindIcon = kind === 'Given' || kind === 'DC' || kind === 'R' || kind === 'W'
  const className = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_PILL_CLASS[kind]} ${
    onClick && !disabled ? 'hover:brightness-90 cursor-pointer' : 'cursor-default'
  }`
  const inner = (
    <>
      {kind === 'Missed' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
      {showKindIcon && (
        <span className="relative inline-flex shrink-0">
          {hasNotes && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 pointer-events-none" />
          )}
          <StatusKindIcon kind={kind} />
        </span>
      )}
      <span>{STATUS_PILL_LABEL[kind]}</span>
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} disabled={disabled} className={className}>
        {inner}
      </button>
    )
  }
  return <span className={className}>{inner}</span>
}

/** Returns Mon–Sun dates for the week containing `ref`. */
function currentWeekDates(ref: Date): Date[] {
  const dow = ref.getDay() // 0 = Sun
  const monday = new Date(ref)
  monday.setDate(ref.getDate() - (dow === 0 ? 6 : dow - 1))
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  patient: Patient
  userProfile: UserProfile | null
  onEditDiet?: () => void
}

export default function MedicationsTab({ patient, userProfile, onEditDiet }: Props) {
  const now        = new Date()
  const todayNum   = now.getDate()
  const curMonth   = now.getMonth()
  const curYear    = now.getFullYear()
  const todayMonthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const daysInMonth    = new Date(curYear, curMonth + 1, 0).getDate()
  const todayDateStr   = now.toISOString().slice(0, 10)

  const yesterdayNum = todayNum > 1 ? todayNum - 1 : null
  const tomorrowNum  = todayNum < daysInMonth ? todayNum + 1 : null
  const weekDates    = currentWeekDates(now)
  const weekDayNums  = weekDates.map(d =>
    (d.getMonth() === curMonth && d.getFullYear() === curYear) ? d.getDate() : null
  )
  const monthDayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const [marForm,    setMarForm]    = useState<any | null>(null)
  const [medications,setMedications]= useState<any[]>([])
  const [adminMap,   setAdminMap]   = useState<Record<string, any[]>>({})
  const [prnMeds,    setPrnMeds]    = useState<any[]>([])
  const [prnRecords, setPrnRecords] = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState('')
  const [view,       setView]       = useState<MarView>('today')
  const [editingCell, setEditingCell] = useState<{ medId: string; day: number } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [editingNote, setEditingNote] = useState('')
  const [cellSaving, setCellSaving] = useState(false)
  const [editingMed, setEditingMed] = useState<any | null>(null)
  const [editingMedGroupIds, setEditingMedGroupIds] = useState<string[]>([])
  const [medDraft, setMedDraft] = useState({
    medication_name: '',
    dosage: '',
    route: '',
    frequency: 1,
    frequency_display: '',
    times: [''] as string[],
    notes: '',
    isPrn: false,
    reason: '',
    start_date: '',
    stop_date: '',
  })
  const [medSaving, setMedSaving] = useState(false)
  const [removingMed, setRemovingMed] = useState<any | null>(null)
  const [medRemoving, setMedRemoving] = useState(false)
  const [managingMeds, setManagingMeds] = useState(false)
  const [editingPrn, setEditingPrn] = useState<any | null>(null)
  const [prnDraft, setPrnDraft] = useState({ medication: '', dosage: '', reason: '', start_date: '' })
  const [prnSaving, setPrnSaving] = useState(false)
  const [removingPrn, setRemovingPrn] = useState<any | null>(null)
  const [prnRemoving, setPrnRemoving] = useState(false)
  const monthScrollRef = useRef<HTMLDivElement>(null)

  function hourToInput(h: number | string | null | undefined): string {
    if (h == null || h === '') return ''
    const s = String(h)
    if (s.includes(':')) return s.slice(0, 5)
    const n = parseInt(s, 10)
    if (isNaN(n)) return ''
    return `${String(n).padStart(2, '0')}:00`
  }

  function medGroupKey(m: any): string {
    return `${m.medication_name}|${m.dosage || ''}|${m.start_date || ''}|${m.stop_date || ''}`
  }

  function groupForMed(med: any): any[] {
    const key = medGroupKey(med)
    return medications
      .filter(m => medGroupKey(m) === key)
      .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99) || String(a.hour ?? '').localeCompare(String(b.hour ?? '')))
  }

  function setFrequency(freq: number) {
    setMedDraft(prev => {
      const times = Array.from({ length: freq }, (_, i) => prev.times[i] || '')
      return { ...prev, frequency: freq, times }
    })
  }

  function openAddMed() {
    setEditingMed('new')
    setEditingMedGroupIds([])
    setMedDraft({
      medication_name: '',
      dosage: '',
      route: '',
      frequency: 1,
      frequency_display: '',
      times: [''],
      notes: '',
      isPrn: false,
      reason: '',
      start_date: `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(todayNum).padStart(2, '0')}`,
      stop_date: '',
    })
  }

  function openEditMed(med: any) {
    const group = groupForMed(med)
    const freq = Math.max(med.frequency || group.length || 1, group.length, 1)
    const times = Array.from({ length: freq }, (_, i) => hourToInput(group[i]?.hour ?? (i === 0 ? med.hour : '')))
    setEditingMed(med)
    setEditingMedGroupIds(group.map(m => m.id))
    setMedDraft({
      medication_name: med.medication_name || '',
      dosage: med.dosage || '',
      route: med.route || '',
      frequency: freq,
      frequency_display: med.frequency_display || '',
      times,
      notes: med.notes || '',
      isPrn: false,
      reason: '',
      start_date: (med.start_date || '').slice(0, 10),
      stop_date: (med.stop_date || '').slice(0, 10),
    })
  }

  function openEditPrn(prn: any) {
    setEditingPrn(prn)
    setPrnDraft({
      medication: prn.medication || prn.medication_name || '',
      dosage: prn.dosage || '',
      reason: prn.reason || '',
      start_date: (prn.start_date || '').slice(0, 10),
    })
  }

  function closeEditPrn() {
    setEditingPrn(null)
    setPrnDraft({ medication: '', dosage: '', reason: '', start_date: '' })
  }

  function closeEditMed() {
    setEditingMed(null)
    setEditingMedGroupIds([])
  }

  async function saveEditMed() {
    if (!editingMed || !marForm) return
    if (!medDraft.medication_name.trim()) {
      alert('Medication name is required.')
      return
    }
    if (!medDraft.start_date) {
      alert('Start date is required.')
      return
    }
    if (editingMed === 'new' && medDraft.isPrn && !medDraft.reason.trim()) {
      alert('Enter the reason or indication for this PRN.')
      return
    }
    if (!(editingMed === 'new' && medDraft.isPrn) && !medDraft.dosage.trim()) {
      alert('Dosage is required.')
      return
    }
    if (!(editingMed === 'new' && medDraft.isPrn) && medDraft.times.some(t => !t.trim())) {
      alert('Enter a time for each dose. Frequency controls how many rows appear on the MAR.')
      return
    }
    if (medDraft.stop_date && medDraft.stop_date < medDraft.start_date) {
      alert('Stop date cannot be before the start date.')
      return
    }
    setMedSaving(true)
    try {
      if (editingMed === 'new' && medDraft.isPrn) {
        const created = await rdsCreatePrnMedication({
          mar_form_id: marForm.id,
          start_date: medDraft.start_date,
          medication: medDraft.medication_name.trim(),
          dosage: medDraft.dosage.trim() || null,
          reason: medDraft.reason.trim(),
        })
        setPrnMeds(prev => [...prev, created])
        closeEditMed()
        return
      }

      const shared = {
        medication_name: medDraft.medication_name.trim(),
        dosage: medDraft.dosage.trim() || null,
        route: medDraft.route.trim() || null,
        frequency: medDraft.frequency,
        frequency_display: medDraft.frequency_display.trim() || null,
        notes: medDraft.notes.trim() || null,
        start_date: medDraft.start_date,
        stop_date: medDraft.stop_date || null,
      }

      if (editingMed === 'new') {
        const maxOrder = Math.max(0, ...medications.map(m => m.display_order || 0))
        const createdRows: any[] = []
        for (let i = 0; i < medDraft.frequency; i++) {
          const created = await rdsCreateMarMedication({
            mar_form_id: marForm.id,
            ...shared,
            hour: medDraft.times[i],
            display_order: maxOrder + 10 + i,
          })
          createdRows.push(created)
        }
        setMedications(prev => [...prev, ...createdRows])
        closeEditMed()
        return
      }

      const existingIds = [...editingMedGroupIds]
      const updatedRows: any[] = []

      for (let i = 0; i < Math.min(existingIds.length, medDraft.frequency); i++) {
        const updated = await rdsPatchMarMedication(existingIds[i], {
          ...shared,
          hour: medDraft.times[i],
        })
        updatedRows.push(updated)
      }

      if (medDraft.frequency > existingIds.length) {
        const baseOrder = editingMed.display_order ?? medications.length * 10
        for (let i = existingIds.length; i < medDraft.frequency; i++) {
          const created = await rdsCreateMarMedication({
            mar_form_id: marForm.id,
            ...shared,
            hour: medDraft.times[i],
            display_order: baseOrder + i,
          })
          updatedRows.push(created)
        }
      }

      if (medDraft.frequency < existingIds.length) {
        const extraIds = existingIds.slice(medDraft.frequency)
        await Promise.all(extraIds.map(id => rdsDeleteMarMedication(id)))
        setAdminMap(prev => {
          const next = { ...prev }
          extraIds.forEach(id => { delete next[id] })
          return next
        })
      }

      const keepIds = new Set(updatedRows.map(r => r.id))
      setMedications(prev => {
        const withoutGroup = prev.filter(m => !existingIds.includes(m.id) || keepIds.has(m.id))
        const merged = withoutGroup.map(m => {
          const fresh = updatedRows.find(r => r.id === m.id)
          return fresh ? { ...m, ...fresh } : m
        })
        const newcomers = updatedRows.filter(r => !merged.some(m => m.id === r.id))
        return [...merged, ...newcomers]
      })
      closeEditMed()
    } catch (err: any) {
      alert(err.message ?? 'Failed to save medication')
    } finally {
      setMedSaving(false)
    }
  }

  async function confirmRemoveMed() {
    if (!removingMed) return
    setMedRemoving(true)
    try {
      const group = groupForMed(removingMed)
      const ids = group.map(m => m.id)
      await Promise.all(ids.map(id => rdsDeleteMarMedication(id)))
      setMedications(prev => prev.filter(m => !ids.includes(m.id)))
      setAdminMap(prev => {
        const next = { ...prev }
        ids.forEach(id => { delete next[id] })
        return next
      })
      setRemovingMed(null)
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove medication')
    } finally {
      setMedRemoving(false)
    }
  }

  async function saveEditPrn() {
    if (!editingPrn) return
    if (!prnDraft.medication.trim() || !prnDraft.reason.trim()) {
      alert('Medication name and reason are required.')
      return
    }
    if (!prnDraft.start_date) {
      alert('Start date is required.')
      return
    }
    setPrnSaving(true)
    try {
      const updated = await rdsPatchPrnMedication(editingPrn.id, {
        start_date: prnDraft.start_date,
        medication: prnDraft.medication.trim(),
        dosage: prnDraft.dosage.trim() || null,
        reason: prnDraft.reason.trim(),
      })
      setPrnMeds(prev => prev.map(p => p.id === editingPrn.id ? { ...p, ...updated } : p))
      closeEditPrn()
    } catch (err: any) {
      alert(err.message ?? 'Failed to save PRN')
    } finally {
      setPrnSaving(false)
    }
  }

  async function confirmRemovePrn() {
    if (!removingPrn) return
    setPrnRemoving(true)
    try {
      await rdsDeletePrnMedication(removingPrn.id)
      setPrnMeds(prev => prev.filter(p => p.id !== removingPrn.id))
      setRemovingPrn(null)
    } catch (err: any) {
      alert(err.message ?? 'Failed to remove PRN')
    } finally {
      setPrnRemoving(false)
    }
  }

  const userInitials = userProfile ? getUserInitials(userProfile) : '?'
  const allergies    = parseList(patient.allergies)
  const canManage    = userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin'

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const forms = await rdsListMarForms(patient.id)
      const form = forms.find((f: any) => f.month_year === todayMonthYear) ?? null
      setMarForm(form)
      if (!form) { setLoading(false); return }

      const [meds, prnM, prnR] = await Promise.all([
        rdsListMarMedications(form.id),
        rdsListPrnMedications(form.id),
        rdsListPrnRecords(form.id),
      ])
      setMedications(meds)
      setPrnMeds(prnM)
      setPrnRecords(prnR)

      if (meds.length > 0) {
        const results = await Promise.all(
          meds.map((m: any) =>
            rdsListAdministrations(m.id).then(admins => ({ id: m.id, admins }))
          )
        )
        const map: Record<string, any[]> = {}
        results.forEach(({ id, admins }) => { map[id] = admins })
        setAdminMap(map)
      }
    } catch (err: any) {
      setError(err.message ?? 'Failed to load medications')
    } finally {
      setLoading(false)
    }
  }, [patient.id, todayMonthYear])

  useEffect(() => {
    setMarForm(null); setMedications([]); setAdminMap({})
    setPrnMeds([]); setPrnRecords([])
    loadData()
  }, [patient.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Same as the original monthly MAR: today's column sits just after the sticky med name.
  useEffect(() => {
    if (view !== 'month' || loading) return
    const container = monthScrollRef.current
    if (!container) return
    const apply = () => {
      const todayCol = container.querySelector('[data-today-col]') as HTMLElement | null
      if (!todayCol) return
      const stickyMedCol = 220
      const delta = todayCol.getBoundingClientRect().left - container.getBoundingClientRect().left - stickyMedCol
      container.scrollLeft = Math.max(0, container.scrollLeft + delta)
    }
    requestAnimationFrame(() => {
      apply()
      requestAnimationFrame(apply)
    })
  }, [view, loading, todayNum, daysInMonth])

  function adminKind(admin: any | undefined): 'Given' | 'DC' | 'R' | 'W' | null {
    if (!admin) return null
    const s = admin.status || ''
    const init = String(admin.initials || '').trim().toUpperCase()
    if (s === 'DC' || init === 'DC') return 'DC'
    if (s === 'Refused' || init === 'R') return 'R'
    if (s === 'Withheld' || init === 'W' || init === 'H') return 'W'
    if (s === 'Given') return 'Given'
    return null
  }

  // RDS / node-pg can return day_number as a string. Original MAR already coerces this.
  function adminForDay(medId: string, day: number | null) {
    if (day == null) return undefined
    return adminMap[medId]?.find(a => Number(a.day_number) === Number(day))
  }

  function hasUserNotes(admin: any | undefined): boolean {
    const notes = admin?.notes
    if (!notes) return false
    if (notes.startsWith('VITAL:') || notes.startsWith('LEGEND:')) {
      const extra = notes.split('\n').slice(1).join('\n').trim()
      return extra.length > 0
    }
    return String(notes).trim().length > 0
  }

  function closeCellModal() {
    setEditingCell(null)
    setEditingValue('')
    setEditingNote('')
  }

  function openCell(med: any, day: number) {
    if (med.discontinued || day > todayNum) return
    const admin = adminForDay(med.id, day)
    const kind = adminKind(admin)
    const notes = admin?.notes || ''
    const noteVal = notes.startsWith('LEGEND:') || notes.startsWith('VITAL:')
      ? notes.split('\n').slice(1).join('\n')
      : notes
    setEditingCell({ medId: med.id, day })
    setEditingValue(kind === 'Given' ? 'Given' : kind === 'DC' ? 'DC' : kind === 'R' ? 'R' : kind === 'W' ? 'W' : '')
    setEditingNote(noteVal)
  }

  function applyAdminToMap(medId: string, day: number, rec: any | null) {
    setAdminMap(prev => {
      const rest = (prev[medId] || []).filter(a => Number(a.day_number) !== Number(day))
      return { ...prev, [medId]: rec ? [...rest, rec] : rest }
    })
  }

  async function submitCellEntry() {
    if (!editingCell || !userProfile || !editingValue) return
    setCellSaving(true)
    const statusMap: Record<string, string> = { Given: 'Given', DC: 'DC', R: 'Refused', W: 'Withheld' }
    const status = statusMap[editingValue] ?? 'Given'
    try {
      const rec = await rdsUpsertAdministration({
        mar_medication_id: editingCell.medId,
        day_number: editingCell.day,
        status,
        initials: userInitials,
        notes: editingNote.trim() || null,
        administered_at: status === 'Given' ? new Date().toISOString() : null,
      })
      applyAdminToMap(editingCell.medId, editingCell.day, rec)
      closeCellModal()
    } catch (err: any) {
      alert(err.message ?? 'Failed to save')
    } finally { setCellSaving(false) }
  }

  async function clearCellEntry() {
    if (!editingCell) return
    setCellSaving(true)
    try {
      await rdsUpsertAdministration({
        mar_medication_id: editingCell.medId,
        day_number: editingCell.day,
        status: 'Not Given',
        initials: null,
        notes: null,
        administered_at: null,
      })
      applyAdminToMap(editingCell.medId, editingCell.day, null)
      closeCellModal()
    } catch (err: any) {
      alert(err.message ?? 'Failed to clear')
    } finally { setCellSaving(false) }
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const scheduledMeds = medications.filter(m => !m.discontinued)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  function slotIsPast(med: any, dayNum: number): boolean {
    if (dayNum < todayNum) return true
    if (dayNum > todayNum) return false
    return medTimeMinutes(med.hour) <= nowMinutes
  }

  function countGivenOnDays(days: Array<number | null>): number {
    let n = 0
    for (const day of days) {
      if (day == null) continue
      for (const med of scheduledMeds) {
        if (adminKind(adminForDay(med.id, day)) === 'Given') n++
      }
    }
    return n
  }

  function countMissedOnDays(days: Array<number | null>): number {
    let n = 0
    for (const day of days) {
      if (day == null) continue
      for (const med of scheduledMeds) {
        if (adminKind(adminForDay(med.id, day))) continue
        if (slotIsPast(med, day)) n++
      }
    }
    return n
  }

  const dueNext4 = scheduledMeds.filter(m => {
    if (adminKind(adminForDay(m.id, todayNum))) return false
    const mins = medTimeMinutes(m.hour)
    return mins >= nowMinutes && mins < nowMinutes + 4 * 60
  }).length

  const givenToday  = countGivenOnDays([todayNum])
  const missedToday = countMissedOnDays([todayNum])
  const givenYest   = yesterdayNum != null ? countGivenOnDays([yesterdayNum]) : 0
  const missedYest  = yesterdayNum != null ? countMissedOnDays([yesterdayNum]) : 0
  const givenWeek   = countGivenOnDays(weekDayNums)
  const missedWeek  = countMissedOnDays(weekDayNums)
  const givenMonth  = countGivenOnDays(monthDayNums)
  const missedMonth = countMissedOnDays(monthDayNums)

  const todayChips = [
    { label: 'Given today',    value: givenToday,  color: '#2b8878' },
    { label: 'Due next 4 hrs', value: dueNext4,    color: '#d3855c' },
    { label: 'Missed today',   value: missedToday, color: '#d15b44' },
  ]
  const yesterdayChips = [
    { label: 'Given yesterday', value: givenYest,  color: '#2b8878' },
    { label: 'Due next 4 hrs',  value: 0,          color: '#d3855c' },
    { label: 'Missed yesterday', value: missedYest, color: '#d15b44' },
  ]
  const weekChips = [
    { label: 'Given this week',  value: givenWeek,  color: '#2b8878' },
    { label: 'Due next 4 hrs',   value: dueNext4,   color: '#d3855c' },
    { label: 'Missed this week', value: missedWeek, color: '#d15b44' },
  ]
  const monthChips = [
    { label: 'Given this month',  value: givenMonth,  color: '#2b8878' },
    { label: 'Due next 4 hrs',    value: dueNext4,    color: '#d3855c' },
    { label: 'Missed this month', value: missedMonth, color: '#d15b44' },
  ]

  const prnToday = prnRecords.filter(r => r.date === todayDateStr)

  // ── Loading / error / no form guards ────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lasso-teal" />
    </div>
  )

  if (error) return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
      <span>{error}</span>
      <button type="button" onClick={loadData} className="ml-4 underline font-bold">Retry</button>
    </div>
  )

  if (!marForm) return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] p-8 shadow-sm text-center">
      <div className="text-3xl mb-3">💊</div>
      <h3 className="font-extrabold text-gray-900 dark:text-white mb-1">No MAR for {todayMonthYear}</h3>
      <p className="text-sm text-gray-400 mb-5">
        A Medication Administration Record hasn&apos;t been created for this month yet.
      </p>
      <Link href={`/patients/${patient.id}/mar`}
        className="inline-flex items-center gap-2 bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition-colors">
        Open MAR to get started →
      </Link>
    </div>
  )

  // ── Shared: day-pass list renderer ──────────────────────────────────────────
  function DayPassList({ dayNum, interactive, label }: {
    dayNum: number | null
    interactive: boolean
    label: string
  }) {
    if (dayNum === null) {
      return (
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          {label === 'Yesterday'
            ? 'Yesterday was in the previous month. View that MAR for the record.'
            : 'Tomorrow is in the next month. Check back then.'}
        </div>
      )
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    return (
      <>
        <div className="pt-2 pb-1">
          <span className="text-sm font-extrabold text-gray-900 dark:text-white">
            Scheduled — {new Date(curYear, curMonth, dayNum).toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
            {label === 'Tomorrow' && (
              <span className="ml-1.5 font-semibold text-gray-400">(preview)</span>
            )}
          </span>
        </div>

        {scheduledMeds.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No scheduled medications on this MAR.</div>
        ) : (
          [...scheduledMeds]
            .sort((a, b) => medTimeMinutes(a.hour) - medTimeMinutes(b.hour))
            .map(med => {
              const admin    = adminForDay(med.id, dayNum)
              const kind     = adminKind(admin)
              const slotMins = medTimeMinutes(med.hour)
              const isPast   = label === 'Yesterday' || (label === 'Today' && slotMins <= nowMinutes)
              const schedule = dayPassSchedule(med)
              const canOpenCell = label !== 'Tomorrow' && !med.discontinued
              const timeLabel = med.hour != null && med.hour !== '' ? fmtHour(med.hour) : undefined
              const pendingKind: StatusPillKind | null = kind
                ? null
                : isPast ? 'Missed' : (timeLabel ? 'Due' : null)
              const showRecord = interactive && !kind && !med.discontinued

              return (
                <div key={med.id} className="flex items-center gap-3.5 px-1 py-[13px] border-b border-gray-100 dark:border-gray-700/40 last:border-0">
                  <span
                    className="flex-shrink-0 font-extrabold tabular-nums"
                    style={{ minWidth: 82, fontSize: 14, color: isPast ? '#d15b44' : '#1f6559' }}
                  >
                    {fmtHour(med.hour)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <MedIdentity name={med.medication_name} detail={schedule} discontinued={med.discontinued} />
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    {kind && (
                      <StatusTextPill
                        kind={kind}
                        hasNotes={hasUserNotes(admin)}
                        onClick={canOpenCell ? () => openCell(med, dayNum) : undefined}
                      />
                    )}
                    {kind && (kind === 'Given' || kind === 'R' || kind === 'W') && (
                      <CellAvatar value={admin?.initials} />
                    )}
                    {pendingKind && (
                      <StatusTextPill
                        kind={pendingKind}
                        onClick={canOpenCell && pendingKind === 'Missed' ? () => openCell(med, dayNum) : undefined}
                      />
                    )}
                    {showRecord && (
                      <button
                        type="button"
                        onClick={() => openCell(med, dayNum)}
                        className="px-3 py-1.5 bg-lasso-teal text-white rounded-lg text-xs font-semibold hover:bg-lasso-blue transition-colors"
                      >
                        Record
                      </button>
                    )}
                  </span>
                </div>
              )
            })
        )}
      </>
    )
  }

  function StatChips({ chips }: { chips: { label: string; value: number; color: string }[] }) {
    return (
      <div className="flex gap-3 flex-wrap mb-1">
        {chips.map(c => (
          <div
            key={c.label}
            className="bg-gray-50 dark:bg-gray-700/40 border border-gray-100 dark:border-gray-700 rounded-[14px] px-[18px] py-2.5 min-w-[120px]"
          >
            <div className="text-2xl font-extrabold leading-tight" style={{ color: c.color }}>{c.value}</div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>
    )
  }

  // ── PRN section (Today only) ─────────────────────────────────────────────────
  function PrnSection() {
    return (
      <>
        {prnMeds.length > 0 && (
          <>
            <div className="px-5 pt-4 pb-1 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm font-extrabold text-gray-900 dark:text-white">As needed (PRN)</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {prnMeds.map(med => (
                <div key={med.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex-1 min-w-0">
                    <MedIdentity
                      name={med.medication || med.medication_name}
                      detail={[med.dosage, med.reason || med.notes].filter(Boolean).join(' · ') || null}
                      badge={<span className="ml-1.5 text-[10px] font-bold text-[#2b8878] border border-[#2b8878]/30 rounded px-1">PRN</span>}
                    />
                  </span>
                  <Link href={`/patients/${patient.id}/mar`}
                    className="flex-shrink-0 border border-lasso-teal text-lasso-teal text-xs font-extrabold px-3 py-2 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                    Log PRN →
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        {prnToday.length > 0 && (
          <>
            <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">PRN Given Today</span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {prnToday.map(r => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-sm font-bold text-gray-500 dark:text-gray-400 min-w-[72px]">
                    {r.hour != null ? fmtHour(r.hour) : '—'}
                  </span>
                  <span className="flex-1 min-w-0">
                    <MedIdentity name={r.medication} detail={r.reason || null} />
                  </span>
                  <span className="text-sm font-bold text-lasso-teal flex-shrink-0">{r.initials}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )
  }

  const GRID_DAY_COL_PX = 84

  // ── Shared: grid table (Week / Month) ────────────────────────────────────────
  function renderGridTable(
    days: { label: string; dayNum: number | null; isToday: boolean }[],
    scrollRef?: RefObject<HTMLDivElement>,
  ) {
    return (
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="border-collapse" style={{ width: 'max-content', fontSize: '12px' }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-700/50 border-b border-r border-gray-100 dark:border-gray-700 text-left px-4 py-2.5 font-extrabold text-gray-500 dark:text-gray-400"
                style={{ minWidth: '220px' }}>
                Medication
              </th>
              {days.map(({ label, isToday }, i) => (
                <th key={i}
                  data-today-col={isToday || undefined}
                  className={`border-b border-r border-gray-100 dark:border-gray-700 text-center font-extrabold py-2 ${
                    isToday
                      ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                      : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400'
                  }`}
                  style={{ width: GRID_DAY_COL_PX, minWidth: GRID_DAY_COL_PX, maxWidth: GRID_DAY_COL_PX }}>
                  <div style={{ fontSize: '11px' }}>{label}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {medications.length === 0 ? (
              <tr>
                <td colSpan={days.length + 1} className="px-4 py-8 text-center text-sm text-gray-400">
                  No medications on this form.
                </td>
              </tr>
            ) : (
              [...medications]
                .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99))
                .map(med => (
                  <tr key={med.id} className={`border-b border-gray-50 dark:border-gray-700/50 ${med.discontinued ? 'opacity-40' : ''}`}>
                    <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 px-4 py-2.5"
                      style={{ minWidth: '220px' }}>
                      <MedIdentity
                        name={med.medication_name}
                        detail={medDetailLine(med) || null}
                        discontinued={med.discontinued}
                      />
                    </td>
                    {days.map(({ dayNum, isToday }, i) => {
                      if (dayNum === null) {
                        return (
                          <td key={i} className="border-r border-b border-gray-50 dark:border-gray-700/50 text-center text-gray-200 dark:text-gray-700"
                            style={{ width: GRID_DAY_COL_PX, minWidth: GRID_DAY_COL_PX, maxWidth: GRID_DAY_COL_PX, height: '52px' }}>—</td>
                        )
                      }
                      const admin = adminForDay(med.id, dayNum)
                      const kind = adminKind(admin)
                      const isFuture = dayNum > todayNum
                      const canInteract = !med.discontinued && !isFuture

                      return (
                        <td
                          key={i}
                          title={
                            isFuture
                              ? 'Future dates cannot be documented in advance.'
                              : canInteract
                                ? 'Click to record Given, DC, Withheld, or Refused'
                                : undefined
                          }
                          onClick={() => {
                            if (!canInteract) return
                            openCell(med, dayNum)
                          }}
                          className={`relative border-r border-b border-gray-50 dark:border-gray-700/50 text-center py-1 ${
                            isToday ? 'bg-amber-50/60 dark:bg-amber-900/10' : ''
                          } ${canInteract ? 'cursor-pointer hover:bg-teal-50/60 dark:hover:bg-teal-900/20' : ''}`}
                          style={{ width: GRID_DAY_COL_PX, minWidth: GRID_DAY_COL_PX, maxWidth: GRID_DAY_COL_PX, height: '52px' }}
                        >
                          {kind ? (
                            <AdminStatusMark
                              kind={kind}
                              initials={admin?.initials}
                              hasNotes={hasUserNotes(admin)}
                            />
                          ) : (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Build week day descriptors ───────────────────────────────────────────────
  const weekDayDescriptors = weekDates.map(d => ({
    label:    DAY_ABBR[d.getDay()] + '\n' + (d.getMonth() + 1) + '/' + d.getDate(),
    dayNum:   (d.getMonth() === curMonth && d.getFullYear() === curYear) ? d.getDate() : null,
    isToday:  d.toDateString() === now.toDateString(),
  }))

  // ── Build month day descriptors ──────────────────────────────────────────────
  const monthDayDescriptors = Array.from({ length: daysInMonth }, (_, i) => ({
    label:   String(i + 1),
    dayNum:  i + 1,
    isToday: i + 1 === todayNum,
  }))

  // ── Main render ──────────────────────────────────────────────────────────────
  const viewToggle = (
    <div className="inline-flex bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-[11px] p-[3px] flex-wrap">
      {(Object.keys(VIEW_LABELS) as MarView[]).map(v => (
        <button key={v} type="button" onClick={() => setView(v)}
          className={`px-4 py-2 rounded-[9px] text-sm font-bold transition-colors ${
            view === v
              ? 'bg-[#2b8878] text-white'
              : 'text-gray-400 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}>
          {VIEW_LABELS[v]}
        </button>
      ))}
    </div>
  )

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] p-6 shadow-sm">

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white m-0">Medications</h3>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Link href={`/patients/${patient.id}/mar`}
            className="text-sm font-bold text-[#2b8878] hover:text-[#1f6559] dark:text-teal-400 dark:hover:text-teal-300 transition-colors whitespace-nowrap">
            Open full MAR →
          </Link>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setManagingMeds(true)}
                className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm font-bold rounded-[9px] px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Manage meds
              </button>
              <button
                type="button"
                onClick={openAddMed}
                className="bg-[#2b8878] hover:bg-[#1f6559] text-white text-sm font-bold rounded-[9px] px-3.5 py-2 transition-colors"
              >
                + Add med
              </button>
            </>
          )}
        </div>
      </div>

      {allergies.length > 0 && (
        <div className="flex items-center gap-2 bg-[#fdeee9] border border-[#f3cabf] rounded-xl px-[15px] py-2.5 text-sm font-extrabold text-[#d15b44] mb-3.5">
          ⚠ Allergies: {allergies.join(', ')}
        </div>
      )}

      <div className="text-sm text-gray-800 dark:text-gray-200 mb-4">
        🍽 <span className="font-extrabold">Diet:</span>{' '}
        {patient.diet
          ? <span>{patient.diet}</span>
          : <span className="text-gray-400">none set</span>}
        {onEditDiet && (
          <button
            type="button"
            onClick={onEditDiet}
            className="ml-2 text-[13px] font-bold text-[#2b8878] hover:text-[#1f6559] dark:text-teal-400"
          >
            {patient.diet ? 'Edit' : 'Add'}
          </button>
        )}
      </div>

      <div className="mb-4">
        {viewToggle}
      </div>

      {/* ══════════════════════════════
          TODAY
      ══════════════════════════════ */}
      {view === 'today' && (
        <>
          <StatChips chips={todayChips} />
          <DayPassList dayNum={todayNum} interactive={true} label="Today" />
          <PrnSection />
        </>
      )}

      {/* ══════════════════════════════
          YESTERDAY
      ══════════════════════════════ */}
      {view === 'yesterday' && (
        <div>
          <StatChips chips={yesterdayChips} />
          <DayPassList dayNum={yesterdayNum} interactive={false} label="Yesterday" />
          {/* PRN given yesterday */}
          {yesterdayNum && (() => {
            const yd = new Date(curYear, curMonth, yesterdayNum).toISOString().slice(0, 10)
            const prnYesterday = prnRecords.filter(r => r.date === yd)
            if (prnYesterday.length === 0) return null
            return (
              <>
                <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">PRN Given Yesterday</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {prnYesterday.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm font-bold text-gray-500 min-w-[72px]">{r.hour != null ? fmtHour(r.hour) : '—'}</span>
                      <span className="flex-1 min-w-0">
                        <MedIdentity name={r.medication} detail={r.reason || null} />
                      </span>
                      <span className="text-sm font-bold text-lasso-teal flex-shrink-0">{r.initials}</span>
                    </div>
                  ))}
                </div>
              </>
            )
          })()}
        </div>
      )}

      {/* ══════════════════════════════
          TOMORROW
      ══════════════════════════════ */}
      {view === 'tomorrow' && (
        <>
          <p className="text-[13px] text-gray-400 mb-1">
            Tomorrow&apos;s planned doses, for prep. Sign for them on the <b>Today</b> view when the time comes.
          </p>
          <DayPassList dayNum={tomorrowNum} interactive={false} label="Tomorrow" />
        </>
      )}

      {/* ══════════════════════════════
          WEEK
      ══════════════════════════════ */}
      {view === 'week' && (
        <>
          <StatChips chips={weekChips} />
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <span className="text-sm font-extrabold text-gray-900 dark:text-white">
              Week of {weekDates[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
              {weekDates[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="text-xs text-gray-400">Click a cell to record Given, DC, Withheld, or Refused</span>
          </div>
          {renderGridTable(weekDayDescriptors)}
        </>
      )}

      {/* ══════════════════════════════
          MONTH GRID
      ══════════════════════════════ */}
      {view === 'month' && (
        <>
          <StatChips chips={monthChips} />
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <span className="text-sm font-extrabold text-gray-900 dark:text-white">{todayMonthYear}</span>
            <span className="text-xs text-gray-400">Click a cell to record Given, DC, Withheld, or Refused</span>
          </div>
          {renderGridTable(monthDayDescriptors, monthScrollRef)}
        </>
      )}

      {editingCell && (() => {
        const editingMed = medications.find(m => m.id === editingCell.medId)
        if (!editingMed) return null
        const existing = adminForDay(editingCell.medId, editingCell.day)
        const options: { value: string; label: string; selectedClass: string }[] = [
          { value: 'Given', label: 'Given', selectedClass: 'border-lasso-teal bg-lasso-teal/10 text-lasso-teal' },
          { value: 'DC', label: 'DC', selectedClass: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
          { value: 'W', label: 'Withheld', selectedClass: 'border-orange-500 bg-orange-50 text-orange-600 dark:bg-orange-900/20' },
          { value: 'R', label: 'Refused', selectedClass: 'border-red-500 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' },
        ]
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={closeCellModal}>
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">{editingMed.medication_name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Day {editingCell.day}
                    {editingMed.hour != null ? ` · ${fmtHour(editingMed.hour)}` : ''}
                  </p>
                </div>
                <button type="button" onClick={closeCellModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
              </div>

              <div className="px-5 py-4">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Select entry</label>
                <div className="grid grid-cols-2 gap-2">
                  {options.map(opt => {
                    const isSelected = editingValue === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditingValue(isSelected ? '' : opt.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left ${
                          isSelected
                            ? opt.selectedClass
                            : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.value === 'Given' && (
                          <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {opt.value === 'DC' && (
                          <svg className="h-4 w-4 shrink-0 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8.6 2h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6L8.6 2z" />
                          </svg>
                        )}
                        {opt.value === 'W' && (
                          <svg className="h-4 w-4 shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                            <rect x="6" y="4" width="4" height="16" rx="1.5" />
                            <rect x="14" y="4" width="4" height="16" rx="1.5" />
                          </svg>
                        )}
                        {opt.value === 'R' && (
                          <svg className="h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 4V12M10 4a2 2 0 00-4 0v8M10 4a2 2 0 014 0v4m0 0V6a2 2 0 014 0v6M14 8v4m0 0v-4m0 4v2m0 0a6 6 0 01-6 6H7a6 6 0 01-6-6v-2a2 2 0 014 0" />
                          </svg>
                        )}
                        <span>{opt.label}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notes <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={editingNote}
                    onChange={e => setEditingNote(e.target.value)}
                    placeholder="Add any notes about this entry…"
                    rows={3}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-lasso-teal resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-between gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div>
                  {existing && adminKind(existing) && (
                    <button
                      type="button"
                      onClick={clearCellEntry}
                      disabled={cellSaving}
                      className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeCellModal}
                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitCellEntry}
                    disabled={!editingValue || cellSaving}
                    className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {cellSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {managingMeds && (() => {
        const seen = new Set<string>()
        const groups = medications
          .slice()
          .sort((a, b) => (a.display_order ?? 99) - (b.display_order ?? 99))
          .filter(m => {
            const key = medGroupKey(m)
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setManagingMeds(false)}>
            <div
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Manage medications</h2>
                <button type="button" onClick={() => setManagingMeds(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {groups.length === 0 && prnMeds.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-gray-400">
                    No medications on this MAR.
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                      Scheduled
                    </div>
                    {groups.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400">No scheduled medications.</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {groups.map(med => {
                          const group = groupForMed(med)
                          const times = group.map(m => fmtHour(m.hour)).filter(t => t !== '—').join(', ')
                          return (
                            <div key={med.id} className={`flex items-start justify-between gap-3 px-5 py-3.5 ${med.discontinued ? 'opacity-50' : ''}`}>
                              <div className="min-w-0">
                                <MedIdentity
                                  name={med.medication_name}
                                  detail={[
                                    med.dosage,
                                    med.frequency_display || (group.length > 1 ? `${group.length} times per day` : null),
                                    times || null,
                                    med.route,
                                  ].filter(Boolean).join(' · ') || null}
                                  discontinued={med.discontinued}
                                />
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-[12px] font-bold">
                                <button type="button" onClick={() => openEditMed(med)} className="text-[#2b8878] hover:text-[#1f6559]">Edit</button>
                                <span className="text-gray-300">·</span>
                                <button type="button" onClick={() => setRemovingMed(med)} className="text-red-400 hover:text-red-600">Remove</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/40 text-[11px] font-extrabold uppercase tracking-widest text-gray-400 border-t border-gray-100 dark:border-gray-700">
                      As needed (PRN)
                    </div>
                    {prnMeds.length === 0 ? (
                      <div className="px-5 py-4 text-sm text-gray-400">No PRN medications.</div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {prnMeds.map(prn => (
                          <div key={prn.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                            <div className="min-w-0">
                              <MedIdentity
                                name={prn.medication || prn.medication_name}
                                detail={[prn.dosage, prn.reason || prn.notes].filter(Boolean).join(' · ') || null}
                                badge={<span className="ml-1.5 text-[10px] font-bold text-[#2b8878] border border-[#2b8878]/30 rounded px-1">PRN</span>}
                              />
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-[12px] font-bold">
                              <button type="button" onClick={() => openEditPrn(prn)} className="text-[#2b8878] hover:text-[#1f6559]">Edit</button>
                              <span className="text-gray-300">·</span>
                              <button type="button" onClick={() => setRemovingPrn(prn)} className="text-red-400 hover:text-red-600">Remove</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="flex justify-end px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setManagingMeds(false)}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {editingMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={closeEditMed}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {editingMed === 'new' ? 'Add medication' : 'Edit medication'}
              </h2>
              <button type="button" onClick={closeEditMed} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Medication name *</label>
                <input
                  type="text"
                  value={medDraft.medication_name}
                  onChange={e => setMedDraft(prev => ({ ...prev, medication_name: e.target.value }))}
                  placeholder={medDraft.isPrn ? 'e.g., Tylenol' : 'e.g., Lisinopril 10 mg'}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">
                  Dosage{medDraft.isPrn ? '' : ' *'}
                </label>
                <input
                  type="text"
                  value={medDraft.dosage}
                  onChange={e => setMedDraft(prev => ({ ...prev, dosage: e.target.value }))}
                  placeholder={medDraft.isPrn ? 'e.g., 500 mg' : 'e.g., 10 mg PO daily'}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              {editingMed === 'new' && (
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={medDraft.isPrn}
                    onChange={e => setMedDraft(prev => ({ ...prev, isPrn: e.target.checked }))}
                    className="rounded border-gray-300 text-[#2b8878] focus:ring-[#2b8878]"
                  />
                  PRN — give only as needed (no set times)
                </label>
              )}
              <div className={medDraft.isPrn ? '' : 'grid grid-cols-2 gap-3'}>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Start date *</label>
                  <input
                    type="date"
                    value={medDraft.start_date}
                    onChange={e => setMedDraft(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
                {!medDraft.isPrn && (
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Stop date (optional)</label>
                    <input
                      type="date"
                      value={medDraft.stop_date}
                      onChange={e => setMedDraft(prev => ({ ...prev, stop_date: e.target.value }))}
                      min={medDraft.start_date || undefined}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                    />
                  </div>
                )}
              </div>
              {medDraft.isPrn && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Reason / indication *</label>
                  <input
                    type="text"
                    value={medDraft.reason}
                    onChange={e => setMedDraft(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="e.g., Headache, Pain"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
              )}
              {!medDraft.isPrn && (
              <>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Route</label>
                <input
                  type="text"
                  value={medDraft.route}
                  onChange={e => setMedDraft(prev => ({ ...prev, route: e.target.value }))}
                  placeholder="e.g., PO, IV, IM, SubQ"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Frequency (times per day) *</label>
                <select
                  value={medDraft.frequency}
                  onChange={e => setFrequency(parseInt(e.target.value, 10))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <option key={n} value={n}>{n} time{n > 1 ? 's' : ''} per day</option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1">
                  Each time becomes its own row on the MAR so staff can sign that dose separately.
                  {medDraft.frequency > 1
                    ? ` This will show as ${medDraft.frequency} rows.`
                    : ' One time = one row.'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Frequency display text (optional)</label>
                <input
                  type="text"
                  value={medDraft.frequency_display}
                  onChange={e => setMedDraft(prev => ({ ...prev, frequency_display: e.target.value }))}
                  placeholder="e.g. BID, 1 tab QD, with meals"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Shown under the medication name. Leave blank to show “{medDraft.frequency} time{medDraft.frequency > 1 ? 's' : ''} per day”.
                </p>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Administration time{medDraft.frequency > 1 ? 's' : ''} *</label>
                <div className="space-y-2">
                  {medDraft.times.map((t, i) => (
                    <div key={i}>
                      {medDraft.frequency > 1 && (
                        <label className="block text-[11px] text-gray-400 mb-1">Time {i + 1}</label>
                      )}
                      <input
                        type="time"
                        value={t}
                        onChange={e => setMedDraft(prev => {
                          const times = [...prev.times]
                          times[i] = e.target.value
                          return { ...prev, times }
                        })}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Notes (optional)</label>
                <textarea
                  value={medDraft.notes}
                  onChange={e => setMedDraft(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about this medication"
                  rows={2}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal resize-none"
                />
              </div>
              </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={closeEditMed}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditMed}
                disabled={medSaving}
                className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40"
              >
                {medSaving ? 'Saving…' : editingMed === 'new' ? 'Add' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removingMed && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setRemovingMed(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Remove medication?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This permanently removes <span className="font-bold text-gray-800 dark:text-gray-200">{removingMed.medication_name}</span>
                {removingMed.dosage ? ` ${removingMed.dosage}` : ''}
                {(removingMed.frequency || 1) > 1 ? ` and all ${removingMed.frequency} scheduled times` : ''}
                {' '}from this month&apos;s MAR, including any administrations already recorded.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setRemovingMed(null)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveMed}
                disabled={medRemoving}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40"
              >
                {medRemoving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingPrn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={closeEditPrn}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Edit PRN</h2>
              <button type="button" onClick={closeEditPrn} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Start date *</label>
                <input
                  type="date"
                  value={prnDraft.start_date}
                  onChange={e => setPrnDraft(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Medication name *</label>
                <input
                  type="text"
                  value={prnDraft.medication}
                  onChange={e => setPrnDraft(prev => ({ ...prev, medication: e.target.value }))}
                  placeholder="e.g., Tylenol"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Dose</label>
                <input
                  type="text"
                  value={prnDraft.dosage}
                  onChange={e => setPrnDraft(prev => ({ ...prev, dosage: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Reason / indication *</label>
                <input
                  type="text"
                  value={prnDraft.reason}
                  onChange={e => setPrnDraft(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={closeEditPrn} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={saveEditPrn} disabled={prnSaving} className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40">
                {prnSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removingPrn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setRemovingPrn(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Remove PRN?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This removes <span className="font-bold text-gray-800 dark:text-gray-200">{removingPrn.medication || removingPrn.medication_name}</span> from the as-needed list. Existing PRN records already given stay on the chart.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={() => setRemovingPrn(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">Cancel</button>
              <button type="button" onClick={confirmRemovePrn} disabled={prnRemoving} className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40">
                {prnRemoving ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
