import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Patient, UserProfile } from '../types/auth'
import type { ProgressNoteMonthlySummary } from '../types/progress-notes'
import {
  rdsGetLatestProgressNoteSummaryWeightUnit,
  rdsGetProgressNoteSummary,
  rdsListProgressNoteSummaries,
  rdsPatchProgressNoteSummary,
  rdsUpsertProgressNoteSummary,
} from '../lib/rdsApi'
import { MonthPickerButton, type MonthPickerItem } from './MonthPickerButton'

const INPUT =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal disabled:opacity-60'
const LABEL = 'block text-xs font-bold text-gray-400 mb-1'
const SIGNATURE_FONTS_LINK_ID = 'monthly-summary-signature-fonts'

function currentMonthYear(): string {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

function previousMonthYear(monthYear: string): string {
  const [y, m] = monthYear.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

function formatMonthLabel(monthYear: string): string {
  const [y, m] = monthYear.split('-').map(Number)
  if (!y || !m) return monthYear
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function emptyForm(monthYear: string, weightUnit: string): Partial<ProgressNoteMonthlySummary> {
  return {
    month_year: monthYear,
    weight_unit: weightUnit === 'kg' ? 'kg' : 'lbs',
    bp: '', pulse: '', resp: '', temp: '', wt: '', wt_change_yn: '',
    response_to_diet: '', medication_available_yn: '', medication_secured_yn: '',
    taking_medications_yn: '', physician_notified_yn: '', physician_notified_date: '',
    medication_changes_yn: '', response_to_medication: '',
    treatments_yn: '', treatments_type: '', response_to_treatment: '',
    therapy_yn: '', therapy_pt: '', therapy_ot: '', therapy_st: '',
    adl_level: '', ambulation: '', continent_urine_yn: '', continent_stool_yn: '',
    incontinent_urine_yn: '', incontinent_stool_yn: '', timed_toileting_yn: '',
    diapers_yn: '', bm_type: '',
    skin_intact_yn: '', wound_type: '', wound_location: '', wound_treatment: '', wound_response: '',
    pain_yn: '', pain_location: '', pain_intensity: '', pain_cause: '', pain_treatment: '', pain_response: '',
    mental_descriptors: '', impaired_communication_other: '',
    describe_changes: '', date_md_notified: '', actions: '',
    changes_in_condition_yn: '', illness_yn: '', injury_yn: '',
    date_physician_notified: '', describe_type_actions_taken: '',
    plan_of_care: '', signature: null, signature_title: '', signature_date: '',
  }
}

function YnSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const v = value ?? ''
  return (
    <div
      role="radiogroup"
      aria-label="Yes or No"
      className={`inline-flex w-full rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-700 ${disabled ? 'opacity-75 pointer-events-none' : ''}`}
    >
      {(['N', 'Y'] as const).map((opt, i) => (
        <label key={opt} className={`flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'} ${i === 1 ? 'border-l border-gray-200 dark:border-gray-600' : ''}`}>
          <input type="radio" checked={v === opt} onChange={() => onChange(opt)} disabled={disabled} className="sr-only" />
          <span className={`block px-3 py-1.5 text-center text-sm font-bold transition-colors ${v === opt ? 'bg-[#2b8878] text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {opt}
          </span>
        </label>
      ))}
    </div>
  )
}

function KgLbsSwitch({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null | undefined
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const v = value === 'kg' ? 'kg' : 'lbs'
  return (
    <div
      role="radiogroup"
      aria-label="Weight unit"
      className={`inline-flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-50 dark:bg-gray-700 shrink-0 ${disabled ? 'opacity-75 pointer-events-none' : ''}`}
    >
      {(['lbs', 'kg'] as const).map((opt, i) => (
        <label key={opt} className={`cursor-pointer ${i === 1 ? 'border-l border-gray-200 dark:border-gray-600' : ''}`}>
          <input type="radio" checked={v === opt} onChange={() => onChange(opt)} disabled={disabled} className="sr-only" />
          <span className={`block px-2 py-1 text-center text-xs font-bold transition-colors ${v === opt ? 'bg-[#2b8878] text-white' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
            {opt}
          </span>
        </label>
      ))}
    </div>
  )
}

function ensureSignatureFontsLoaded() {
  if (typeof document === 'undefined') return
  if (document.getElementById(SIGNATURE_FONTS_LINK_ID)) return
  const link = document.createElement('link')
  link.id = SIGNATURE_FONTS_LINK_ID
  link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Sacramento&display=swap'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
}

function SignatureDisplay({
  value,
  userProfile,
}: {
  value: string | null | undefined
  userProfile: UserProfile | null
}) {
  if (!value) return <span className="text-sm text-gray-400">—</span>
  const font = userProfile?.staff_signature_font || 'Dancing Script'
  const signatureMatch =
    !!userProfile?.staff_signature_text &&
    (value === userProfile.staff_signature ||
      value.trim().toUpperCase() === userProfile.staff_signature_text.trim().toUpperCase())
  if (signatureMatch && userProfile?.staff_signature_text) {
    ensureSignatureFontsLoaded()
    return (
      <span style={{ fontFamily: `"${font}", cursive`, fontSize: '1.75em' }}>
        {userProfile.staff_signature_text}
      </span>
    )
  }
  const imgSrc = value.startsWith('s3:')
    ? `/api/signature-image?key=${encodeURIComponent(value.slice(3))}`
    : value.startsWith('data:image') ? value : null
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt="Signature"
        style={{ maxHeight: '2.5em', maxWidth: '12em', verticalAlign: 'middle', display: 'inline-block' }}
      />
    )
  }
  return <span className="text-sm">{value}</span>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-gray-100 dark:border-gray-700 rounded-xl p-4">
      <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mb-3">{title}</h4>
      {children}
    </section>
  )
}

interface Props {
  patient: Patient
  userProfile: UserProfile | null
}

export default function MonthlySummaryPanel({ patient, userProfile }: Props) {
  const [monthYear, setMonthYear] = useState(currentMonthYear)
  const [form, setForm] = useState<Partial<ProgressNoteMonthlySummary>>(() => emptyForm(currentMonthYear(), 'lbs'))
  const [existingId, setExistingId] = useState<string | null>(null)
  const [previousSummary, setPreviousSummary] = useState<ProgressNoteMonthlySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const formRef = useRef(form)
  const existingIdRef = useRef<string | null>(null)
  const dirtyRef = useRef(false)

  useEffect(() => { formRef.current = form }, [form])
  useEffect(() => { existingIdRef.current = existingId }, [existingId])
  useEffect(() => { dirtyRef.current = dirty }, [dirty])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const prevMonth = previousMonthYear(monthYear)
      const [data, previous, latest] = await Promise.all([
        rdsGetProgressNoteSummary(patient.id, monthYear),
        rdsGetProgressNoteSummary(patient.id, prevMonth),
        rdsGetLatestProgressNoteSummaryWeightUnit(patient.id),
      ])
      const defaultWeightUnit = latest?.weight_unit === 'kg' || latest?.weight_unit === 'lbs' ? latest.weight_unit : 'lbs'
      setPreviousSummary((previous || null) as ProgressNoteMonthlySummary | null)
      if (data) {
        const next: Partial<ProgressNoteMonthlySummary> = { ...data }
        const currentWt = data.wt != null && String(data.wt).trim() !== '' ? parseFloat(data.wt) : NaN
        const previousWt = previous?.wt != null && String(previous.wt).trim() !== '' ? parseFloat(previous.wt) : NaN
        if (!Number.isNaN(currentWt) && !Number.isNaN(previousWt)) {
          next.wt_change_yn = 'Y'
        }
        setForm(next)
        setExistingId(data.id)
      } else {
        setForm(emptyForm(monthYear, defaultWeightUnit))
        setExistingId(null)
      }
      setDirty(false)
    } catch (err: any) {
      setError(err.message ?? 'Failed to load monthly summary')
    } finally {
      setLoading(false)
    }
  }, [patient.id, monthYear])

  useEffect(() => {
    load()
  }, [load])

  function update<K extends keyof ProgressNoteMonthlySummary>(key: K, value: ProgressNoteMonthlySummary[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      formRef.current = next
      return next
    })
    setDirty(true)
    setMessage('')
  }

  function changeMonth(next: string) {
    if (dirtyRef.current && !window.confirm('You have unsaved changes. Switch month and discard them?')) return
    setMonthYear(next)
  }

  const loadMonths = useCallback(async (): Promise<MonthPickerItem[]> => {
    let saved = new Set<string>()
    try {
      const rows = await rdsListProgressNoteSummaries(patient.id)
      saved = new Set((rows || []).map((r: any) => String(r.month_year || '').slice(0, 7)).filter(Boolean))
    } catch {
      saved = new Set()
    }
    const now = new Date()
    const items: MonthPickerItem[] = []
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const filled = saved.has(key)
      items.push({
        id: key,
        label: `${formatMonthLabel(key)}${filled ? ' · saved' : ''}`,
        isCurrent: key === monthYear,
        onClick: () => { changeMonth(key) },
      })
    }
    return items
  }, [patient.id, monthYear])

  async function save() {
    if (!userProfile) return
    setSaving(true)
    setError('')
    try {
      const current = formRef.current
      const { id: _id, created_by: _cb, created_at: _ca, updated_at: _ua, ...rest } = current
      const payload = {
        patient_id: patient.id,
        month_year: monthYear,
        ...rest,
      }
      let saved: any
      if (existingIdRef.current) {
        saved = await rdsPatchProgressNoteSummary(existingIdRef.current, payload)
      } else {
        saved = await rdsUpsertProgressNoteSummary({ ...payload, created_by: userProfile.id })
      }
      if (saved?.id) {
        setExistingId(saved.id)
        existingIdRef.current = saved.id
        setForm(prev => ({ ...prev, ...saved }))
      }
      setDirty(false)
      setMessage('Saved')
    } catch (err: any) {
      setError(err.message ?? 'Failed to save monthly summary')
    } finally {
      setSaving(false)
    }
  }

  function handlePrint() {
    window.print()
  }

  const currentWtNum = form.wt != null && String(form.wt).trim() !== '' ? parseFloat(String(form.wt)) : NaN
  const previousWtNum = previousSummary?.wt != null && String(previousSummary.wt).trim() !== '' ? parseFloat(String(previousSummary.wt)) : NaN
  const hasWeightChange = !Number.isNaN(currentWtNum) && !Number.isNaN(previousWtNum)
  const weightDiff = hasWeightChange ? currentWtNum - previousWtNum : null
  const weightUnit = form.weight_unit === 'kg' || form.weight_unit === 'lbs' ? form.weight_unit : 'lbs'
  const canSign = Boolean(userProfile?.staff_signature)
  const shownSignature = form.signature
    || (form.created_by === userProfile?.id ? userProfile?.staff_signature : null)

  return (
    <div id="monthly-summary-print">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4 no-print">
        <MonthPickerButton
          key={monthYear}
          currentLabel={formatMonthLabel(monthYear)}
          loadMonths={loadMonths}
          size="sm"
        />
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs font-bold text-amber-600">Unsaved</span>}
          {message && !dirty && <span className="text-xs font-bold text-[#2b8878]">{message}</span>}
          <button
            type="button"
            onClick={handlePrint}
            className="text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-[9px] px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Print
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !userProfile || !dirty}
            className="bg-[#2b8878] hover:bg-[#1f6559] text-white text-sm font-bold rounded-[9px] px-3.5 py-2 transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : existingId ? 'Save summary' : 'Save summary'}
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4 no-print">
        Head-to-toe summary for this resident and month only. Last month is not copied in. Weight change uses last month’s weight when both exist.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lasso-teal" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 text-sm text-red-600 dark:text-red-400 flex items-center justify-between mb-4">
          <span>{error}</span>
          <button type="button" onClick={load} className="ml-4 underline font-bold">Retry</button>
        </div>
      )}

      {!loading && (
        <div className="space-y-4">
          <Section title="Vitals / Weight / Diet">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-3">
              {([
                ['bp', 'B.P.'],
                ['pulse', 'P.'],
                ['resp', 'R.'],
                ['temp', 'Temp.'],
              ] as const).map(([f, label]) => (
                <div key={f}>
                  <label className={LABEL}>{label}</label>
                  <input type="text" value={form[f] ?? ''} onChange={e => update(f, e.target.value)} className={INPUT} />
                </div>
              ))}
              <div>
                <label className={LABEL}>Wt.</label>
                <div className="flex items-center gap-2">
                  <input type="text" value={form.wt ?? ''} onChange={e => update('wt', e.target.value)} className={`${INPUT} flex-1 min-w-0`} />
                  <KgLbsSwitch value={form.weight_unit ?? 'lbs'} onChange={v => update('weight_unit', v)} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Wt. Change Y/N</label>
                <YnSwitch value={form.wt_change_yn ?? ''} onChange={v => update('wt_change_yn', v)} />
                {weightDiff !== null && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 font-medium">
                    {weightDiff > 0 ? `+${weightDiff}` : `${weightDiff}`} {weightUnit}
                  </p>
                )}
              </div>
            </div>
            <label className={LABEL}>Response to Diet</label>
            <input type="text" value={form.response_to_diet ?? ''} onChange={e => update('response_to_diet', e.target.value)} className={INPUT} />
          </Section>

          <Section title="Medication">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              {([
                ['medication_available_yn', 'Medication available Y/N'],
                ['medication_secured_yn', 'Medication secured Y/N'],
                ['taking_medications_yn', 'Taking medications Y/N'],
              ] as const).map(([f, label]) => (
                <div key={f}>
                  <label className={LABEL}>{label}</label>
                  <YnSwitch value={form[f] ?? ''} onChange={v => update(f, v)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Physician notified Y/N</label>
                <YnSwitch value={form.physician_notified_yn ?? ''} onChange={v => update('physician_notified_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Date</label>
                <input type="date" value={form.physician_notified_date ?? ''} onChange={e => update('physician_notified_date', e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="mb-3">
              <label className={LABEL}>Medication changes Y/N</label>
              <YnSwitch value={form.medication_changes_yn ?? ''} onChange={v => update('medication_changes_yn', v)} />
            </div>
            <label className={LABEL}>Response to Medication</label>
            <input type="text" value={form.response_to_medication ?? ''} onChange={e => update('response_to_medication', e.target.value)} className={INPUT} />
          </Section>

          <Section title="Treatments">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Treatments Y/N</label>
                <YnSwitch value={form.treatments_yn ?? ''} onChange={v => update('treatments_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Type</label>
                <input type="text" value={form.treatments_type ?? ''} onChange={e => update('treatments_type', e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="mb-3">
              <label className={LABEL}>Response to Treatment</label>
              <input type="text" value={form.response_to_treatment ?? ''} onChange={e => update('response_to_treatment', e.target.value)} className={INPUT} />
            </div>
            <div className="mb-3">
              <label className={LABEL}>Therapy Y/N</label>
              <YnSwitch value={form.therapy_yn ?? ''} onChange={v => update('therapy_yn', v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                ['therapy_pt', 'PT'],
                ['therapy_ot', 'OT'],
                ['therapy_st', 'ST'],
              ] as const).map(([f, label]) => (
                <div key={f}>
                  <label className={LABEL}>{label}</label>
                  <input type="text" value={form[f] ?? ''} onChange={e => update(f, e.target.value)} className={INPUT} />
                </div>
              ))}
            </div>
          </Section>

          <Section title="ADL / Ambulation / Continence / BM">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>ADL</label>
                <select value={form.adl_level ?? ''} onChange={e => update('adl_level', e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  <option value="Independent">Independent</option>
                  <option value="Minimal">Minimal</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Maximum">Maximum</option>
                </select>
              </div>
              <div>
                <label className={LABEL}>Ambulation</label>
                <select value={form.ambulation ?? ''} onChange={e => update('ambulation', e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  <option value="Independent">Independent</option>
                  <option value="Walker">Walker</option>
                  <option value="Cane">Cane</option>
                  <option value="W/C">W/C</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {([
                ['continent_urine_yn', 'Continent urine Y/N'],
                ['continent_stool_yn', 'Continent stool Y/N'],
                ['incontinent_urine_yn', 'Incontinent urine Y/N'],
                ['incontinent_stool_yn', 'Incontinent stool Y/N'],
              ] as const).map(([f, label]) => (
                <div key={f}>
                  <label className={LABEL}>{label}</label>
                  <YnSwitch value={form[f] ?? ''} onChange={v => update(f, v)} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Timed toileting Y/N</label>
                <YnSwitch value={form.timed_toileting_yn ?? ''} onChange={v => update('timed_toileting_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Diapers Y/N</label>
                <YnSwitch value={form.diapers_yn ?? ''} onChange={v => update('diapers_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>BM</label>
                <select value={form.bm_type ?? ''} onChange={e => update('bm_type', e.target.value)} className={INPUT}>
                  <option value="">—</option>
                  <option value="Regular">Regular</option>
                  <option value="Enema/Supp">Enema/Supp</option>
                  <option value="Stool Softeners/Laxatives">Stool Softeners/Laxatives</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Skin Integrity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Intact Y/N</label>
                <YnSwitch value={form.skin_intact_yn ?? ''} onChange={v => update('skin_intact_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Wound Type</label>
                <input type="text" value={form.wound_type ?? ''} onChange={e => update('wound_type', e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="mb-3">
              <label className={LABEL}>Location</label>
              <input type="text" value={form.wound_location ?? ''} onChange={e => update('wound_location', e.target.value)} className={INPUT} />
            </div>
            <label className={LABEL}>Treatment / Response</label>
            <input type="text" value={form.wound_treatment ?? ''} onChange={e => update('wound_treatment', e.target.value)} placeholder="Treatment" className={`${INPUT} mb-2`} />
            <input type="text" value={form.wound_response ?? ''} onChange={e => update('wound_response', e.target.value)} placeholder="Response" className={INPUT} />
          </Section>

          <Section title="Pain">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Pain Y/N</label>
                <YnSwitch value={form.pain_yn ?? ''} onChange={v => update('pain_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Location</label>
                <input type="text" value={form.pain_location ?? ''} onChange={e => update('pain_location', e.target.value)} className={INPUT} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Intensity (0–10)</label>
                <input type="text" value={form.pain_intensity ?? ''} onChange={e => update('pain_intensity', e.target.value)} className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Cause</label>
                <input type="text" value={form.pain_cause ?? ''} onChange={e => update('pain_cause', e.target.value)} className={INPUT} />
              </div>
            </div>
            <label className={LABEL}>Treatment / Response</label>
            <input type="text" value={form.pain_treatment ?? ''} onChange={e => update('pain_treatment', e.target.value)} placeholder="Treatment" className={`${INPUT} mb-2`} />
            <input type="text" value={form.pain_response ?? ''} onChange={e => update('pain_response', e.target.value)} placeholder="Response" className={INPUT} />
          </Section>

          <Section title="Mental">
            <div className="mb-3">
              <label className={LABEL}>Select all that apply</label>
              <input
                type="text"
                value={form.mental_descriptors ?? ''}
                onChange={e => update('mental_descriptors', e.target.value)}
                placeholder="e.g. Oriented, Pleasant, Forgetful"
                className={INPUT}
              />
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                Oriented, Pleasant, Happy, Forgetful, Wanders, Disoriented, Depressed, Withdrawn, Angry, Agitated, Delusions, Hallucinations, Suicidal/Homicidal, Physical Hostile, Verbal Hostile, Destructive
              </p>
            </div>
            <label className={LABEL}>Impaired Communication Other</label>
            <input type="text" value={form.impaired_communication_other ?? ''} onChange={e => update('impaired_communication_other', e.target.value)} className={INPUT} />
          </Section>

          <Section title="Changes and Actions">
            <div className="mb-3">
              <label className={LABEL}>Describe Changes</label>
              <input type="text" value={form.describe_changes ?? ''} onChange={e => update('describe_changes', e.target.value)} className={INPUT} />
            </div>
            <div className="mb-3">
              <label className={LABEL}>Date MD Notified</label>
              <input type="date" value={form.date_md_notified ?? ''} onChange={e => update('date_md_notified', e.target.value)} className={INPUT} />
            </div>
            <div className="mb-3">
              <label className={LABEL}>Actions</label>
              <input type="text" value={form.actions ?? ''} onChange={e => update('actions', e.target.value)} className={INPUT} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div>
                <label className={LABEL}>Changes in condition Y/N</label>
                <YnSwitch value={form.changes_in_condition_yn ?? ''} onChange={v => update('changes_in_condition_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Illness Y/N</label>
                <YnSwitch value={form.illness_yn ?? ''} onChange={v => update('illness_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Injury Y/N</label>
                <YnSwitch value={form.injury_yn ?? ''} onChange={v => update('injury_yn', v)} />
              </div>
              <div>
                <label className={LABEL}>Date physician notified</label>
                <input type="date" value={form.date_physician_notified ?? ''} onChange={e => update('date_physician_notified', e.target.value)} className={INPUT} />
              </div>
            </div>
            <label className={LABEL}>Describe Type and Actions Taken</label>
            <textarea value={form.describe_type_actions_taken ?? ''} onChange={e => update('describe_type_actions_taken', e.target.value)} rows={3} className={`${INPUT} resize-none`} />
          </Section>

          <Section title="Plan of Care">
            <textarea value={form.plan_of_care ?? ''} onChange={e => update('plan_of_care', e.target.value)} rows={4} className={`${INPUT} resize-none`} />
          </Section>

          <Section title="Signature / Title / Date">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className={LABEL}>Title</label>
                <input type="text" value={form.signature_title ?? ''} onChange={e => update('signature_title', e.target.value)} placeholder="e.g. RN, LPN" className={INPUT} />
              </div>
              <div>
                <label className={LABEL}>Date</label>
                <input type="date" value={form.signature_date ?? ''} onChange={e => update('signature_date', e.target.value)} className={INPUT} />
              </div>
            </div>
            <label className={LABEL}>Signature</label>
            {shownSignature && userProfile ? (
              <div className="flex flex-col gap-1">
                <SignatureDisplay value={shownSignature} userProfile={userProfile} />
                <button
                  type="button"
                  onClick={() => update('signature', null)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline w-fit no-print"
                >
                  Clear signature
                </button>
              </div>
            ) : canSign ? (
              <button
                type="button"
                onClick={() => update('signature', userProfile!.staff_signature)}
                className="px-3 py-1.5 text-sm font-bold text-[#2b8878] border border-[#2b8878] rounded-lg hover:bg-[#2b8878]/10"
              >
                Sign
              </button>
            ) : (
              <span className="text-sm text-amber-600">Set signature in Profile first</span>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}
