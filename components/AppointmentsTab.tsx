import { useCallback, useEffect, useState } from 'react'
import type { Patient, UserProfile } from '../types/auth'
import { formatCalendarDate, localTodayYMD, ymdFromDateInput } from '../lib/calendarDate'
import { rdsCreatePatientAppointment, rdsDeletePatientAppointment, rdsListPatientAppointments } from '../lib/rdsApi'

interface Props {
  patient: Patient
  userProfile: UserProfile | null
}

function fmtTime12(raw: string | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).slice(0, 5)
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return String(raw)
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ap = h < 12 ? 'AM' : 'PM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${min} ${ap}`
}

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal'

export default function AppointmentsTab({ patient, userProfile }: Props) {
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
    title: '',
    appointment_date: '',
    appointment_time: '',
    location: '',
    notes: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRows(await rdsListPatientAppointments(patient.id))
    } catch (err: any) {
      setError(err.message ?? 'Failed to load appointments')
    } finally {
      setLoading(false)
    }
  }, [patient.id])

  useEffect(() => { load() }, [load])

  function openAdd() {
    setDraft({
      title: '',
      appointment_date: localTodayYMD(),
      appointment_time: '',
      location: '',
      notes: '',
    })
    setSaveError('')
    setAdding(true)
  }

  async function submit() {
    const title = draft.title.trim()
    if (!title) {
      setSaveError('Purpose is required.')
      return
    }
    if (!draft.appointment_date) {
      setSaveError('Date is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const created = await rdsCreatePatientAppointment({
        patient_id: patient.id,
        title,
        appointment_date: draft.appointment_date,
        appointment_time: draft.appointment_time || null,
        location: draft.location,
        notes: draft.notes,
      })
      if (created) {
        setRows(prev =>
          [...prev, created].sort((a, b) => {
            const da = ymdFromDateInput(a.appointment_date)
            const db = ymdFromDateInput(b.appointment_date)
            if (da !== db) return da.localeCompare(db)
            return String(a.appointment_time || '').localeCompare(String(b.appointment_time || ''))
          })
        )
      }
      setAdding(false)
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to add appointment')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setDeleting(true)
    try {
      await rdsDeletePatientAppointment(removing.id)
      setRows(prev => prev.filter(r => r.id !== removing.id))
      setRemoving(null)
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete appointment')
    } finally {
      setDeleting(false)
    }
  }

  const today = localTodayYMD()

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white m-0 tracking-tight">
          Appointments
        </h3>
        <button
          type="button"
          onClick={openAdd}
          className="bg-[#2b8878] hover:bg-[#1f6559] text-white text-sm font-bold rounded-[9px] px-3.5 py-2 transition-colors"
        >
          + Add appointment
        </button>
      </div>

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
                <th className="px-3 py-2.5">Date</th>
                <th className="px-3 py-2.5">Purpose</th>
                <th className="px-3 py-2.5">Location</th>
                <th className="px-3 py-2.5">Notes</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-12 text-center text-sm text-gray-400">
                    No appointments.
                  </td>
                </tr>
              ) : (
                rows.map(row => {
                  const dateKey = ymdFromDateInput(row.appointment_date)
                  const upcoming = dateKey >= today
                  const timeLabel = fmtTime12(row.appointment_time)
                  return (
                    <tr key={row.id} className="border-t border-gray-100 dark:border-gray-700">
                      <td className="px-3 py-3 text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                        {formatCalendarDate(dateKey, undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {timeLabel ? ` · ${timeLabel}` : ''}
                        {upcoming && (
                          <span className="ml-2 inline-block text-[10px] font-extrabold uppercase tracking-wide text-[#d3855c] bg-[#fbeadf] dark:bg-amber-900/30 rounded-full px-2 py-0.5">
                            upcoming
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-800 dark:text-gray-200">{row.title || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{row.location || '—'}</td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{row.notes || '—'}</td>
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
                  )
                })
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
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add appointment</h2>
              <button type="button" onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Purpose *</label>
                <input type="text" value={draft.title} onChange={e => setDraft(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Cardiology follow-up" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Date *</label>
                  <input type="date" value={draft.appointment_date} onChange={e => setDraft(p => ({ ...p, appointment_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Time</label>
                  <input type="time" value={draft.appointment_time} onChange={e => setDraft(p => ({ ...p, appointment_time: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Location</label>
                <input type="text" value={draft.location} onChange={e => setDraft(p => ({ ...p, location: e.target.value }))} placeholder="Clinic, hospital, telehealth…" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Notes</label>
                <textarea
                  value={draft.notes}
                  onChange={e => setDraft(p => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                Cancel
              </button>
              <button type="button" onClick={submit} disabled={saving} className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40">
                {saving ? 'Saving…' : 'Add appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setRemoving(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete this appointment?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">This removes it from the resident’s appointment list.</p>
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
