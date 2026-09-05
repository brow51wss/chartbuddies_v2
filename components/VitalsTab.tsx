import { useCallback, useEffect, useState } from 'react'
import type { Patient, UserProfile } from '../types/auth'
import { localTodayYMD } from '../lib/calendarDate'
import { rdsCreatePatientVital, rdsDeletePatientVital, rdsListPatientVitals } from '../lib/rdsApi'

interface Props {
  patient: Patient
  userProfile: UserProfile | null
}

function staffInitials(p: UserProfile): string {
  if (p.staff_initials_text) return p.staff_initials_text.toUpperCase()
  const fn = (p as any).first_name?.trim()?.[0] || ''
  const ln = (p as any).last_name?.trim()?.[0] || ''
  if (fn && ln) return (fn + ln).toUpperCase()
  return (
    p.full_name.split(' ').filter(Boolean).slice(0, 2)
      .map((w: string) => w[0]).join('').toUpperCase() || '?'
  )
}

function localNowTime(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

function combineLocalDateTime(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(n => parseInt(n, 10))
  const [hh, mm] = time.split(':').map(n => parseInt(n, 10))
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).toISOString()
}

function fmtWhen(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal'

export default function VitalsTab({ patient, userProfile }: Props) {
  const canManage = userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin'
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [removing, setRemoving] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [draft, setDraft] = useState({
    date: localTodayYMD(),
    time: localNowTime(),
    bp: '',
    heart_rate: '',
    temperature: '',
    weight: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await rdsListPatientVitals(patient.id))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load vitals')
    } finally {
      setLoading(false)
    }
  }, [patient.id])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setDraft({
      date: localTodayYMD(),
      time: localNowTime(),
      bp: '',
      heart_rate: '',
      temperature: '',
      weight: '',
    })
    setSaveError('')
    setAdding(true)
  }

  async function submit() {
    if (!userProfile) return
    if (!draft.date || !draft.time) {
      setSaveError('Date and time are required.')
      return
    }
    const hasReading = [draft.bp, draft.heart_rate, draft.temperature, draft.weight].some(v => v.trim())
    if (!hasReading) {
      setSaveError('Enter at least one reading (BP, HR, temp, or weight).')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const created = await rdsCreatePatientVital({
        patient_id: patient.id,
        recorded_at: combineLocalDateTime(draft.date, draft.time),
        bp: draft.bp,
        heart_rate: draft.heart_rate,
        temperature: draft.temperature,
        weight: draft.weight,
        initials: staffInitials(userProfile),
      })
      if (created) setRows(prev => [created, ...prev])
      setAdding(false)
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to record vitals')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setDeleting(true)
    try {
      await rdsDeletePatientVital(removing.id)
      setRows(prev => prev.filter(r => r.id !== removing.id))
      setRemoving(null)
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete reading')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white m-0 tracking-tight">
          Vitals
        </h3>
        <button
          type="button"
          onClick={openAdd}
          className="bg-[#2b8878] hover:bg-[#1f6559] text-white text-sm font-bold rounded-[9px] px-3.5 py-2 transition-colors"
        >
          + Record vitals{userProfile ? ` — ${staffInitials(userProfile)}` : ''}
        </button>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Point-in-time readings for this resident. Scheduled MAR vitals stay on the Medications tab and full MAR.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lasso-teal" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={load} className="ml-4 underline font-bold">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto border border-gray-100 dark:border-gray-700 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/40 text-left text-[11px] font-extrabold uppercase tracking-widest text-gray-400">
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">BP</th>
                <th className="px-3 py-2.5">HR</th>
                <th className="px-3 py-2.5">Temp °F</th>
                <th className="px-3 py-2.5">Weight lb</th>
                <th className="px-3 py-2.5">By</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-12 text-center text-sm text-gray-400">
                    No vitals recorded.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-3 text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                      {fmtWhen(row.recorded_at)}
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{row.bp || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{row.heart_rate || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{row.temperature || '—'}</td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{row.weight || '—'}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-full bg-[#e6f4f1] text-[#1f6559] text-[11px] font-extrabold">
                        {row.initials || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setRemoving(row)}
                          className="text-xs font-bold text-red-400 hover:text-red-600"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setAdding(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Record vitals</h2>
              <button type="button" onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Date *</label>
                  <input type="date" value={draft.date} onChange={e => setDraft(p => ({ ...p, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Time *</label>
                  <input type="time" value={draft.time} onChange={e => setDraft(p => ({ ...p, time: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Blood pressure</label>
                <input type="text" value={draft.bp} onChange={e => setDraft(p => ({ ...p, bp: e.target.value }))} placeholder="e.g. 120/80" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Heart rate (bpm)</label>
                <input type="text" value={draft.heart_rate} onChange={e => setDraft(p => ({ ...p, heart_rate: e.target.value }))} placeholder="e.g. 72" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Temperature (°F)</label>
                <input type="text" value={draft.temperature} onChange={e => setDraft(p => ({ ...p, temperature: e.target.value }))} placeholder="e.g. 98.6" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Weight (lb)</label>
                <input type="text" value={draft.weight} onChange={e => setDraft(p => ({ ...p, weight: e.target.value }))} placeholder="e.g. 145" className={inputCls} />
              </div>
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={saving} className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setRemoving(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete this reading?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This removes the vitals entry from the resident log.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={() => setRemoving(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="button" onClick={confirmRemove} disabled={deleting} className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
