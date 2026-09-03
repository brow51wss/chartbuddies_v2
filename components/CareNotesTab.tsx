import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { Patient, UserProfile } from '../types/auth'
import type { ProgressNoteEntry } from '../types/progress-notes'
import { formatCalendarDate, localTodayYMD } from '../lib/calendarDate'
import { rdsCreateProgressNote, rdsDeleteProgressNote, rdsListProgressNotes } from '../lib/rdsApi'

interface Props {
  patient: Patient
  userProfile: UserProfile | null
}

function isMarPrnLinked(note: ProgressNoteEntry): boolean {
  return Boolean(note.source_mar_prn_record_id)
}

function isMarAdminLinked(note: ProgressNoteEntry): boolean {
  return (note.notes || '').includes('(from MAR')
}

function isMarLinked(note: ProgressNoteEntry): boolean {
  return isMarPrnLinked(note) || isMarAdminLinked(note)
}

function profileInitials(p: Pick<UserProfile, 'staff_initials_text' | 'full_name'> & { first_name?: string | null; last_name?: string | null }): string {
  if (p.staff_initials_text) return p.staff_initials_text.toUpperCase()
  const fn = p.first_name?.trim()?.[0] || ''
  const ln = p.last_name?.trim()?.[0] || ''
  if (fn && ln) return (fn + ln).toUpperCase()
  return (
    p.full_name.split(' ').filter(Boolean).slice(0, 2)
      .map((w: string) => w[0]).join('').toUpperCase() || '?'
  )
}

function marInitialsFromBody(raw: string | null | undefined): string | null {
  const match = (raw || '').match(/^MAR initials:\s*(.+)$/m)
  const value = match?.[1]?.trim()
  return value ? value.slice(0, 3).toUpperCase() : null
}

function noteAuthorInitials(
  note: ProgressNoteEntry,
  userProfile: UserProfile | null,
  staffById: Record<string, string>
): string {
  const fromBody = marInitialsFromBody(note.notes)
  if (fromBody) return fromBody
  if (note.created_by && staffById[note.created_by]) return staffById[note.created_by]
  if (userProfile && note.created_by === userProfile.id) return profileInitials(userProfile)
  return '?'
}

/** Chip already shows MAR source — display only the time, not "(from MAR…)". */
function displayNoteBody(raw: string | null | undefined): string {
  const text = (raw || '').trim()
  if (!text) return '—'
  const stripped = text
    .split('\n')
    .map(line =>
      line
        .replace(/^\(from MAR(?: PRN)?(?:,\s*([^)]+))?\)\s*/i, (_, time) => (time ? `${time.trim()} ` : ''))
        .trimEnd()
    )
    .filter(line => !/^MAR initials:\s*/i.test(line))
    .join('\n')
    .trim()
  return stripped || '—'
}

function NoteAvatar({ initials }: { initials: string }) {
  const label = (initials || '?').slice(0, 3).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#2b8878] text-white font-extrabold leading-none shrink-0"
      style={{ fontSize: label.length > 2 ? '8px' : '10px' }}
      title={label}
    >
      {label}
    </span>
  )
}

function noteDateKey(note: ProgressNoteEntry): string {
  return String(note.note_date || '').slice(0, 10)
}

function NoteBody({ raw }: { raw: string | null | undefined }) {
  const text = displayNoteBody(raw)
  if (text === '—') return <>{text}</>
  return (
    <>
      {text.split('\n').map((line, i) => {
        const colon = line.indexOf(':')
        const label = colon > 0 ? line.slice(0, colon) : ''
        const isFieldLabel = colon > 0 && /[a-zA-Z]/.test(label)
        return (
          <div key={i}>
            {isFieldLabel ? (
              <>
                <span className="font-bold">{line.slice(0, colon + 1)}</span>
                {line.slice(colon + 1)}
              </>
            ) : (
              line || '\u00a0'
            )}
          </div>
        )
      })}
    </>
  )
}

export default function CareNotesTab({ patient, userProfile }: Props) {
  const canManage = userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin'
  const [notes, setNotes] = useState<ProgressNoteEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [draftDate, setDraftDate] = useState(localTodayYMD())
  const [draftText, setDraftText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [removing, setRemoving] = useState<ProgressNoteEntry | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [staffById, setStaffById] = useState<Record<string, string>>({})

  const loadNotes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await rdsListProgressNotes(patient.id, false)
      setNotes((rows || []) as ProgressNoteEntry[])
    } catch (err: any) {
      setError(err.message ?? 'Failed to load care notes')
    } finally {
      setLoading(false)
    }
  }, [patient.id])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    const hospitalId = userProfile?.hospital_id || patient.hospital_id
    if (!hospitalId) return
    let cancelled = false
    fetch(`/api/staff/users?hospital_id=${encodeURIComponent(hospitalId)}`)
      .then(res => (res.ok ? res.json() : []))
      .then((rows: any[]) => {
        if (cancelled || !Array.isArray(rows)) return
        const map: Record<string, string> = {}
        for (const row of rows) {
          if (row?.id) map[row.id] = profileInitials(row)
        }
        setStaffById(map)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [userProfile?.hospital_id, patient.hospital_id])

  function openAdd() {
    setDraftDate(localTodayYMD())
    setDraftText('')
    setSaveError('')
    setAdding(true)
  }

  async function submitNote() {
    if (!userProfile) return
    const text = draftText.trim()
    if (!text) {
      setSaveError('Note text is required.')
      return
    }
    if (!draftDate) {
      setSaveError('Date is required.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const created = await rdsCreateProgressNote({
        patient_id: patient.id,
        note_date: draftDate,
        notes: text,
        signature: null,
        physician_name: patient.physician_name || null,
        is_addendum: false,
        source_mar_prn_record_id: null,
        created_by: userProfile.id,
      })
      if (created) setNotes(prev => [created as ProgressNoteEntry, ...prev])
      setAdding(false)
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to add note')
    } finally {
      setSaving(false)
    }
  }

  async function confirmRemove() {
    if (!removing) return
    if (isMarLinked(removing)) return
    setDeleting(true)
    try {
      await rdsDeleteProgressNote(removing.id)
      setNotes(prev => prev.filter(n => n.id !== removing.id))
      setRemoving(null)
    } catch (err: any) {
      alert(err.message ?? 'Failed to delete note')
    } finally {
      setDeleting(false)
    }
  }

  const grouped = notes.reduce<Record<string, ProgressNoteEntry[]>>((acc, note) => {
    const key = noteDateKey(note) || 'undated'
    if (!acc[key]) acc[key] = []
    acc[key].push(note)
    return acc
  }, {})
  const dayKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-[18px] p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-[17px] font-extrabold text-gray-900 dark:text-white m-0 tracking-tight">
          Care Notes
        </h3>
        <div className="flex items-center gap-2">
          <Link
            href={`/patients/${patient.id}/progress-notes`}
            className="text-sm font-bold text-[#2b8878] hover:text-[#1f6559]"
          >
            Open full notes →
          </Link>
          <button
            type="button"
            onClick={openAdd}
            className="bg-[#2b8878] hover:bg-[#1f6559] text-white text-sm font-bold rounded-[9px] px-3.5 py-2 transition-colors"
          >
            + Add note
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Manual notes and MAR PRN doses share this list. PRN-linked notes stay mapped to the MAR and cannot be deleted here.
      </p>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lasso-teal" />
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-5 text-sm text-red-600 dark:text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={loadNotes} className="ml-4 underline font-bold">Retry</button>
        </div>
      )}

      {!loading && !error && dayKeys.length === 0 && (
        <div className="px-2 py-12 text-center text-sm text-gray-400">
          No care notes yet.
        </div>
      )}

      {!loading && !error && dayKeys.map(day => (
        <div key={day} className="mb-5 last:mb-0">
          <div className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400 mb-2">
            {day === 'undated' ? 'Undated' : formatCalendarDate(day, undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
            {grouped[day].map(note => {
              const fromMarPrn = isMarPrnLinked(note)
              const fromMarAdmin = !fromMarPrn && isMarAdminLinked(note)
              const authorInitials = noteAuthorInitials(note, userProfile, staffById)
              return (
                <div key={note.id} className="px-4 py-3.5 bg-white dark:bg-gray-800">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    {fromMarPrn ? (
                      <span className="text-[10px] font-bold text-[#2b8878] border border-[#2b8878]/30 rounded px-1">
                        From MAR PRN
                      </span>
                    ) : fromMarAdmin ? (
                      <span className="text-[10px] font-bold text-[#2b8878] border border-[#2b8878]/30 rounded px-1">
                        From MAR
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 border border-gray-200 dark:border-gray-600 rounded px-1">
                        Manual
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed">
                    <NoteBody raw={note.notes} />
                  </div>
                  <div className="mt-2.5 flex items-end justify-between gap-3">
                    <NoteAvatar initials={authorInitials} />
                    {canManage && !fromMarPrn && !fromMarAdmin && !note.signature ? (
                      <button
                        type="button"
                        onClick={() => setRemoving(note)}
                        className="text-xs font-bold text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setAdding(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add care note</h2>
              <button type="button" onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Date *</label>
                <input
                  type="date"
                  value={draftDate}
                  onChange={e => setDraftDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 mb-1">Note *</label>
                <textarea
                  value={draftText}
                  onChange={e => setDraftText(e.target.value)}
                  placeholder="Progress note or daily care log"
                  rows={5}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal resize-none"
                />
              </div>
              {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNote}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Add note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => setRemoving(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Delete this note?</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This only removes a manual care note. MAR-linked PRN notes cannot be deleted here.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
