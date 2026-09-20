import { useCallback, useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Patient, UserProfile } from '../types/auth'
import { formatCalendarDate, localTodayYMD, PROFILE_DATE_MIN_YMD, sanitizeFourDigitYearDate, ymdFromDateInput } from '../lib/calendarDate'
import MedicationsTab from './MedicationsTab'
import CareNotesTab from './CareNotesTab'
import VitalsTab from './VitalsTab'
import AppointmentsTab from './AppointmentsTab'

type Tab     = 'profile' | 'meds' | 'notes' | 'vitals' | 'appts'
type Section = 'identification' | 'contact' | 'clinical'

interface Props {
  patient:         Patient
  userProfile:     UserProfile | null
  onArchive?:      (id: string, name: string) => void
  onSavePatient?:  (patientId: string, payload: Partial<Patient>) => Promise<Patient>
}

function parseList(value: string | null | undefined): string[] {
  if (!value) return []
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal'
const labelCls = 'block text-xs font-bold text-gray-400 mb-1'

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile'     },
  { key: 'meds',    label: 'Medications' },
  { key: 'notes',   label: 'Care Notes'  },
  { key: 'vitals',  label: 'Vitals'      },
  { key: 'appts',   label: 'Appts'       },
]

function ProfileTextField({
  field,
  label,
  value,
  onChange,
  className,
  hint,
  placeholder,
}: {
  field: keyof Patient
  label: string
  value: string
  onChange: (field: keyof Patient, value: string) => void
  className?: string
  hint?: string
  placeholder?: string
}) {
  return (
    <div className={className}>
      <label className={labelCls}>
        {label}
        {hint ? <span className="font-normal opacity-60"> {hint}</span> : null}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(field, e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  )
}

function ProfileDateField({
  field,
  label,
  value,
  onChange,
  min = PROFILE_DATE_MIN_YMD,
  max,
}: {
  field: keyof Patient
  label: string
  value: string
  onChange: (field: keyof Patient, value: string) => void
  min?: string
  max?: string
}) {
  const display = ymdFromDateInput(value)
  const ceiling = max || localTodayYMD()
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type="date"
        value={display}
        min={min}
        max={ceiling}
        onChange={e => {
          const next = sanitizeFourDigitYearDate(e.target.value, {
            min,
            max: ceiling,
            badInput: e.target.validity.badInput,
          })
          if (next === null) return
          onChange(field, next)
        }}
        className={inputCls}
      />
    </div>
  )
}

function ProfileRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-bold text-gray-400 self-start pt-0.5">{label}</dt>
      <dd className="m-0">{children}</dd>
    </>
  )
}

function ProfileSectionFooter({
  section,
  canManage,
  canSave,
  editingSection,
  saving,
  saveError,
  onStart,
  onCancel,
  onSave,
}: {
  section: Section
  canManage: boolean
  canSave: boolean
  editingSection: Section | null
  saving: boolean
  saveError: string
  onStart: (section: Section) => void
  onCancel: () => void
  onSave: (section: Section) => void
}) {
  if (!canManage || !canSave) return null

  if (editingSection === section) {
    return (
      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3 flex-wrap">
        {saveError && (
          <p className="text-xs text-red-500 flex-1">{saveError}</p>
        )}
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(section)}
            disabled={saving}
            className="px-4 py-2 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl transition-colors disabled:opacity-50 min-w-[72px]"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
      <button
        type="button"
        onClick={() => onStart(section)}
        disabled={editingSection !== null}
        className="px-3.5 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Edit
      </button>
    </div>
  )
}

export default function DashboardPatientDetail({ patient, userProfile, onArchive, onSavePatient }: Props) {
  const [tab, setTab]                         = useState<Tab>('profile')
  const [editingSection, setEditingSection]   = useState<Section | null>(null)
  const [draft, setDraft]                     = useState<Partial<Patient>>({})
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')
  // Local optimistic patient state so edits reflect instantly without prop drilling
  const [localPatient, setLocalPatient]       = useState<Patient>(patient)

  useEffect(() => {
    setLocalPatient(patient)
    setEditingSection(null)
    setDraft({})
    setSaveError('')
  }, [patient.id])

  const allergies = parseList(localPatient.allergies)
  const diagnoses  = parseList(localPatient.diagnosis)
  const canManage  = userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin'

  const startEdit = useCallback((section: Section) => {
    setSaveError('')
    setDraft({ ...localPatient })
    setEditingSection(section)
  }, [localPatient])

  const cancelEdit = useCallback(() => {
    setEditingSection(null)
    setDraft({})
    setSaveError('')
  }, [])

  const saveSection = useCallback(async (section: Section) => {
    if (!onSavePatient) return
    setSaving(true)
    setSaveError('')
    try {
      const updated = await onSavePatient(localPatient.id, draft)
      setLocalPatient(updated)
      setEditingSection(null)
      setDraft({})
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [onSavePatient, localPatient.id, draft])

  const setField = useCallback((field: keyof Patient, value: string) => {
    setDraft(prev => ({ ...prev, [field]: value }))
  }, [])

  function sectionFooter(section: Section) {
    return (
      <ProfileSectionFooter
        section={section}
        canManage={canManage}
        canSave={Boolean(onSavePatient)}
        editingSection={editingSection}
        saving={saving}
        saveError={saveError}
        onStart={startEdit}
        onCancel={cancelEdit}
        onSave={saveSection}
      />
    )
  }

  function profileSectionClass(section: Section) {
    const locked = editingSection != null && editingSection !== section
    const active = editingSection === section
    return [
      'bg-white dark:bg-gray-800 border rounded-[18px] p-6 shadow-sm transition-all',
      locked
        ? 'border-gray-100 dark:border-gray-700 opacity-40 pointer-events-none'
        : active
          ? 'border-[#2b8878]/50 ring-2 ring-[#2b8878]/15'
          : 'border-gray-100 dark:border-gray-700',
    ].join(' ')
  }

  function LockedHint({ section }: { section: Section }) {
    if (!editingSection || editingSection === section) return null
    const openLabel =
      editingSection === 'identification' ? 'Identification'
      : editingSection === 'contact' ? 'Contact'
      : 'Clinical'
    return (
      <p className="text-xs text-gray-400 mb-3">
        Save or cancel {openLabel} to edit this section.
      </p>
    )
  }

  return (
    <div>
      {/* ── Patient header ── */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight m-0">
            {localPatient.patient_name}
          </h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            {[localPatient.sex, localPatient.date_of_birth ? `DOB ${formatCalendarDate(localPatient.date_of_birth)}` : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link
            href={`/patients/${localPatient.id}`}
            className="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl px-3.5 py-2 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Full record
          </Link>
          {canManage && onArchive && (
            <button
              type="button"
              onClick={() => onArchive(localPatient.id, localPatient.patient_name)}
              className="border border-red-200 dark:border-red-800 bg-white dark:bg-gray-800 text-red-500 dark:text-red-400 rounded-xl px-3.5 py-2 text-sm font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="inline-flex gap-1.5 mb-6 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-1.5 rounded-[14px] shadow-sm flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-[10px] text-sm font-bold transition-colors ${
              tab === t.key
                ? 'bg-lasso-teal text-white'
                : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          TAB: Profile
      ════════════════════════════════════════════ */}
      {tab === 'profile' && (
        <div className="space-y-5">

          {/* ── Identification ── */}
          <section className={profileSectionClass('identification')}>
            <h3 className="text-[13px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 m-0">Identification</h3>
            <LockedHint section="identification" />

            {editingSection === 'identification' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileTextField field="patient_name" label="Full name" value={(draft.patient_name as string) ?? ''} onChange={setField} />
                <ProfileDateField field="date_of_birth" label="Date of birth" value={(draft.date_of_birth as string) ?? ''} onChange={setField} />
                <div>
                  <label className={labelCls}>Sex</label>
                  <select
                    value={(draft.sex as string) ?? ''}
                    onChange={e => setField('sex', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select…</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <ProfileDateField field="admission_date" label="Admission date" value={(draft.admission_date as string) ?? ''} onChange={setField} />
              </div>
            ) : (
              <dl className="grid text-sm" style={{ gridTemplateColumns: '160px 1fr', rowGap: '12px' }}>
                <ProfileRow label="Record #">
                  <span className="text-gray-900 dark:text-white font-mono text-xs">{localPatient.record_number || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Full name">
                  <span className="text-gray-900 dark:text-white">{localPatient.patient_name || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Date of birth">
                  <span className="text-gray-900 dark:text-white">{formatCalendarDate(localPatient.date_of_birth) || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Sex">
                  <span className="text-gray-900 dark:text-white">{localPatient.sex || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Admission date">
                  <span className="text-gray-900 dark:text-white">
                    {localPatient.admission_date ? formatCalendarDate(localPatient.admission_date) : '—'}
                  </span>
                </ProfileRow>
                {localPatient.facility_name && (
                  <ProfileRow label="Facility">
                    <span className="text-gray-900 dark:text-white">{localPatient.facility_name}</span>
                  </ProfileRow>
                )}
              </dl>
            )}

            {sectionFooter('identification')}
          </section>

          {/* ── Contact ── */}
          <section className={profileSectionClass('contact')}>
            <h3 className="text-[13px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 m-0">Contact</h3>
            <LockedHint section="contact" />

            {editingSection === 'contact' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileTextField field="home_phone" label="Phone" value={(draft.home_phone as string) ?? ''} onChange={setField} />
                <ProfileTextField field="email" label="Email" value={(draft.email as string) ?? ''} onChange={setField} />
                <ProfileTextField className="sm:col-span-2" field="street_address" label="Street address" value={(draft.street_address as string) ?? ''} onChange={setField} />
                <ProfileTextField field="city" label="City" value={(draft.city as string) ?? ''} onChange={setField} />
                <ProfileTextField field="state" label="State" value={(draft.state as string) ?? ''} onChange={setField} />
                <ProfileTextField field="zip_code" label="ZIP code" value={(draft.zip_code as string) ?? ''} onChange={setField} />
              </div>
            ) : (
              <dl className="grid text-sm" style={{ gridTemplateColumns: '160px 1fr', rowGap: '12px' }}>
                <ProfileRow label="Phone">
                  <span className="text-gray-900 dark:text-white">{localPatient.home_phone || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Email">
                  <span className="text-gray-900 dark:text-white">{localPatient.email || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Address">
                  {localPatient.street_address || localPatient.city || localPatient.state || localPatient.zip_code ? (
                    <span className="text-gray-900 dark:text-white">
                      {[localPatient.street_address, localPatient.city, localPatient.state, localPatient.zip_code]
                        .filter(Boolean).join(', ')}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </ProfileRow>
              </dl>
            )}

            {sectionFooter('contact')}
          </section>

          {/* ── Clinical ── */}
          <section className={profileSectionClass('clinical')}>
            <h3 className="text-[13px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4 m-0">Clinical</h3>
            <LockedHint section="clinical" />

            {editingSection === 'clinical' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileTextField field="physician_name" label="Physician" value={(draft.physician_name as string) ?? ''} onChange={setField} />
                <ProfileTextField field="physician_phone" label="Physician phone" value={(draft.physician_phone as string) ?? ''} onChange={setField} />
                <ProfileTextField field="diet" label="Diet" value={(draft.diet as string) ?? ''} onChange={setField} />
                <ProfileTextField
                  className="sm:col-span-2"
                  field="allergies"
                  label="Allergies"
                  hint="(comma-separated)"
                  placeholder="e.g. Penicillin, Latex"
                  value={(draft.allergies as string) ?? ''}
                  onChange={setField}
                />
                <div className="sm:col-span-2">
                  <label className={labelCls}>Diagnoses <span className="font-normal opacity-60">(comma-separated)</span></label>
                  <textarea
                    value={(draft.diagnosis as string) ?? ''}
                    onChange={e => setField('diagnosis', e.target.value)}
                    rows={3}
                    placeholder="e.g. Type 2 Diabetes, Hypertension"
                    className={inputCls + ' resize-none'}
                  />
                </div>
              </div>
            ) : (
              <dl className="grid text-sm" style={{ gridTemplateColumns: '160px 1fr', rowGap: '12px' }}>
                <ProfileRow label="Physician">
                  <span className="text-gray-900 dark:text-white">{localPatient.physician_name || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Physician phone">
                  <span className="text-gray-900 dark:text-white">{localPatient.physician_phone || '—'}</span>
                </ProfileRow>
                <ProfileRow label="Diet">
                  {localPatient.diet
                    ? <span className="text-gray-900 dark:text-white">{localPatient.diet}</span>
                    : <span className="text-gray-400">None set</span>}
                </ProfileRow>
                <ProfileRow label="Allergies">
                  {allergies.length > 0
                    ? allergies.map(a => (
                        <span key={a} className="inline-block bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-[9px] px-2.5 py-1 text-xs font-semibold mr-1.5 mb-1">
                          {a}
                        </span>
                      ))
                    : <span className="text-gray-400">None recorded</span>}
                </ProfileRow>
                <ProfileRow label="Diagnoses">
                  {diagnoses.length > 0
                    ? diagnoses.map(d => (
                        <span key={d} className="inline-block bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-[9px] px-2.5 py-1 text-xs font-semibold mr-1.5 mb-1">
                          {d}
                        </span>
                      ))
                    : <span className="text-gray-400">None recorded</span>}
                </ProfileRow>
              </dl>
            )}

            {sectionFooter('clinical')}
          </section>

        </div>
      )}

      {/* ════════════════════════════════════════════
          TAB: Medications
      ════════════════════════════════════════════ */}
      {tab === 'meds' && (
        <MedicationsTab
          patient={localPatient}
          userProfile={userProfile}
          onEditDiet={canManage && onSavePatient ? () => { setTab('profile'); startEdit('clinical') } : undefined}
        />
      )}

      {/* ════════════════════════════════════════════
          TAB: Care Notes
      ════════════════════════════════════════════ */}
      {tab === 'notes' && (
        <CareNotesTab patient={localPatient} userProfile={userProfile} />
      )}

      {/* ════════════════════════════════════════════
          TAB: Vitals
      ════════════════════════════════════════════ */}
      {tab === 'vitals' && (
        <VitalsTab patient={localPatient} userProfile={userProfile} />
      )}

      {/* ════════════════════════════════════════════
          TAB: Appointments
      ════════════════════════════════════════════ */}
      {tab === 'appts' && (
        <AppointmentsTab patient={localPatient} userProfile={userProfile} />
      )}
    </div>
  )
}
