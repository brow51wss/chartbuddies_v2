import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import AppHeader from '../../../components/AppHeader'
import PatientStickyBar from '../../../components/PatientStickyBar'
import EditPatientInfoModal, { type EditPatientInfoSaveArgs } from '../../../components/EditPatientInfoModal'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile, signOut } from '../../../lib/auth'
import { rdsGetPatient, rdsListMarForms, rdsListProgressNotes, rdsPatchPatient } from '../../../lib/rdsApi'
import { useReadOnly } from '../../../contexts/ReadOnlyContext'
import type { Patient, UserProfile } from '../../../types/auth'
import { PatientSummaryCard } from '../../../components/PatientSummaryCard'

interface EHRModule {
  id: string
  name: string
  description: string
  icon: string
  status: 'available' | 'coming_soon'
  gradient: string
  href?: string
}

type BinderActivityRow = {
  moduleId: EHRModule['id']
  moduleName: string
  statusLabel: string
  lastActivityLabel: string
  href?: string
  /** UTC ms — timeline reads left-to-right: most recent → oldest */
  lastActivitySortMs: number
}

const MODULES: EHRModule[] = [
  {
    id: 'mar',
    name: 'Medication Administration Record',
    description: 'Track and manage medication administration',
    icon: '💊',
    status: 'available',
    gradient: 'from-lasso-navy to-lasso-teal',
    href: 'forms'
  },
  {
    id: 'progress',
    name: 'Progress Notes',
    description: 'Document progress, observations, and clinical notes',
    icon: '📝',
    status: 'available',
    gradient: 'from-purple-500 to-purple-600',
    href: 'progress-notes'
  },
  {
    id: 'vitals',
    name: 'Vital Signs',
    description: 'Record and monitor vital signs (BP, temperature, pulse, etc.)',
    icon: '📊',
    status: 'coming_soon',
    gradient: 'from-green-500 to-green-600'
  },
  {
    id: 'admissions',
    name: 'Admissions',
    description: 'Manage admissions, discharges, and transfers',
    icon: '🏥',
    status: 'coming_soon',
    gradient: 'from-lasso-teal to-lasso-blue'
  },
  {
    id: 'lab',
    name: 'Laboratory Results',
    description: 'View and manage lab results and reports',
    icon: '🔬',
    status: 'coming_soon',
    gradient: 'from-orange-500 to-orange-600'
  },
  {
    id: 'imaging',
    name: 'Imaging & Radiology',
    description: 'Access imaging studies and radiology reports',
    icon: '🩻',
    status: 'coming_soon',
    gradient: 'from-teal-500 to-teal-600'
  }
]

export default function PatientHub() {
  const router = useRouter()
  const rawPatientId = router.query.id
  const patientId =
    typeof rawPatientId === 'string'
      ? rawPatientId
      : Array.isArray(rawPatientId)
        ? rawPatientId[0]
        : undefined
  const [patient, setPatient] = useState<Patient | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [facilityName, setFacilityName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityRows, setActivityRows] = useState<BinderActivityRow[]>([])
  const [showActivityStatus, setShowActivityStatus] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const rightColRef = useRef<HTMLDivElement>(null)
  const { isReadOnly } = useReadOnly()

  const formatDateTimeLabel = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  }

  const activityTimestampMs = (value?: string | null) => {
    if (value == null || value === '') return 0
    const t = new Date(value).getTime()
    return Number.isNaN(t) ? 0 : t
  }

  useEffect(() => {
    if (!router.isReady) return

    if (!patientId) {
      setLoading(false)
      setError('Patient not found')
      setPatient(null)
      setActivityRows([])
      return
    }

    const loadPatientId = patientId
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      setActivityRows([])

      const profile = await getCurrentUserProfile()
      if (cancelled) return
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      if (profile.hospital_id) {
        const { data: hospitalData } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        if (!cancelled) setFacilityName(hospitalData?.name ?? null)
      }

      let data: Patient | null = null
      try {
        data = await rdsGetPatient(loadPatientId)
      } catch (err: any) {
        if (err.message === 'Forbidden' || err.message?.includes('403')) {
          router.replace('/dashboard')
          return
        }
        data = null
      }
      if (cancelled) return
      if (!data) {
        setError('Patient not found')
        setPatient(null)
        setActivityRows([])
        setLoading(false)
        return
      }
      setPatient(data)

      const [allMarForms, allProgressNotes] = await Promise.all([
        rdsListMarForms(loadPatientId).catch(() => [] as any[]),
        rdsListProgressNotes(loadPatientId).catch(() => [] as any[]),
      ])

      if (cancelled) return

      // Sort MAR forms newest-first
      const sortedForms = [...allMarForms].sort(
        (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
      )
      const latestMar = sortedForms[0] ?? null
      const monthByMarFormId = new Map(allMarForms.map((f: any) => [f.id, f.month_year]))

      const sortedNotes = [...allProgressNotes].sort(
        (a, b) => new Date(b.updated_at || b.note_date).getTime() - new Date(a.updated_at || a.note_date).getTime()
      )
      const latestProgressEntry = sortedNotes[0] ?? null

      // Check vitals from the most recent MAR form that has vital_signs data
      let latestVitalsActivity: {
        mar_form_id: string
        day_number?: number | null
        updated_at?: string | null
        created_at?: string | null
        source: 'reading'
      } | null = null

      for (const form of sortedForms) {
        try {
          const { data: session } = await supabase.auth.getSession()
          const token = session?.session?.access_token
          if (!token) break
          const vsRes = await fetch(`/api/rds/mar/vital-signs?mar_form_id=${form.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (vsRes.ok) {
            const vsRows: any[] = await vsRes.json()
            if (vsRows.length > 0) {
              const latest = vsRows.sort(
                (a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()
              )[0]
              latestVitalsActivity = { ...latest, mar_form_id: form.id, source: 'reading' }
              break
            }
          }
        } catch (_) {
          break
        }
      }

      const rows: BinderActivityRow[] = []

      const marModule = MODULES.find((module) => module.id === 'mar')
      if (latestMar && marModule) {
        const marRaw = latestMar.updated_at || latestMar.created_at
        rows.push({
          moduleId: marModule.id,
          moduleName: marModule.name,
          statusLabel: `${String(latestMar.status || 'active').replace('_', ' ')} (${latestMar.month_year || 'unknown month'})`,
          lastActivityLabel: formatDateTimeLabel(marRaw),
          href: marModule.href ? `/patients/${loadPatientId}/${marModule.href}` : undefined,
          lastActivitySortMs: activityTimestampMs(marRaw),
        })
      }

      const progressModule = MODULES.find((module) => module.id === 'progress')
      if (latestProgressEntry && progressModule) {
        const progressRaw =
          latestProgressEntry.updated_at || latestProgressEntry.note_date || null
        rows.push({
          moduleId: progressModule.id,
          moduleName: progressModule.name,
          statusLabel: 'Has entries',
          lastActivityLabel: formatDateTimeLabel(progressRaw),
          href: progressModule.href ? `/patients/${loadPatientId}/${progressModule.href}` : undefined,
          lastActivitySortMs: activityTimestampMs(progressRaw),
        })
      }

      const vitalsModule = MODULES.find((module) => module.id === 'vitals')
      if (latestVitalsActivity && vitalsModule) {
        const vitalsRaw = latestVitalsActivity.updated_at || latestVitalsActivity.created_at || null
        const vitalsMonth = monthByMarFormId.get(latestVitalsActivity.mar_form_id)
        rows.push({
          moduleId: vitalsModule.id,
          moduleName: vitalsModule.name,
          statusLabel:
            latestVitalsActivity.source === 'reading' && latestVitalsActivity.day_number
              ? `Vitals recorded, day ${latestVitalsActivity.day_number}${vitalsMonth ? ` (${vitalsMonth})` : ''}`
              : `Vitals entry added${vitalsMonth ? ` (${vitalsMonth})` : ''}`,
          lastActivityLabel: formatDateTimeLabel(vitalsRaw),
          href: `/patients/${loadPatientId}/mar/${latestVitalsActivity.mar_form_id}`,
          lastActivitySortMs: activityTimestampMs(vitalsRaw),
        })
      }

      rows.sort((a, b) => b.lastActivitySortMs - a.lastActivitySortMs)
      setActivityRows(rows)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [patientId, router.isReady, router])


  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !patient) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">{error || 'Patient not found'}</p>
            <Link href="/dashboard" className="mt-4 inline-block text-lasso-teal">← Back to Dashboard</Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>{patient.patient_name} - Lasso</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader
          userProfile={userProfile}
          patientId={patient.id}
          patientName={patient.patient_name}
          onLogout={async () => { await signOut(); router.push('/auth/login') }}
        />
        <PatientStickyBar
          patientId={patient.id}
          patientName={patient.patient_name}
          dateOfBirth={patient.date_of_birth}
          sex={patient.sex}
          allergies={patient.allergies}
          recordNumber={patient.record_number}
          onEditPatient={isReadOnly ? undefined : () => setShowEditModal(true)}
          editPatientLabel="Edit Patient Details"
        />
        <EditPatientInfoModal
          isOpen={showEditModal}
          patientId={patient.id}
          title="Edit Patient Details"
          facilityDisplayName={facilityName}
          recordNumber={patient.record_number}
          readOnly={isReadOnly}
          onClose={() => setShowEditModal(false)}
          onSave={async ({ patientId: pid, payload }: EditPatientInfoSaveArgs) => {
            return rdsPatchPatient(pid!, { ...payload, sync_mar_forms: true }) as Promise<Patient>
          }}
          onSaved={(updatedPatient) => {
            setPatient(updatedPatient)
          }}
        />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/dashboard"
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue mb-2 inline-flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <span>←</span>
            <span>Back to Patients</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
            {patient.patient_name}'s Binder
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-6">
            Select a module to access records and documentation for this patient
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
            {/* Left — profile card, sticky so patient context stays visible while scrolling */}
            <div className="lg:sticky lg:top-[85px] lg:self-start w-[200px]">
              <PatientSummaryCard
                as="section"
                aria-label="Patient details"
                patient={patient}
                showPatientName={false}
                showDiagnosis={false}
                className="aspect-square !p-[25px] justify-center"
              />
            </div>

            <div ref={rightColRef} className="flex flex-col gap-4 min-w-0">
            {/* Diagnosis */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Diagnosis</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {patient.diagnosis || <span className="italic">N/A</span>}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowActivityStatus((prev) => !prev)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                aria-expanded={showActivityStatus}
                aria-controls="activity-status-panel"
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Activity Status</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Quick per-module status for this patient.
                  </p>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-500 dark:text-gray-300 transition-transform shrink-0 ml-2 ${showActivityStatus ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: showActivityStatus ? '1fr' : '0fr',
                  transition: 'grid-template-rows 300ms ease',
                }}
              >
                <div className="overflow-hidden">
                <div
                  id="activity-status-panel"
                  className="border-t border-gray-200 dark:border-gray-700 px-4 py-6 sm:px-6"
                >
                  {activityRows.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-1">
                      No recent MAR or Progress Notes activity to show yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto pb-1">
                      <ul className="relative z-[1] m-0 flex min-w-min list-none flex-row items-start gap-0 px-1 py-2">
                        {activityRows.map((row, index) => {
                          const actionAvailable = Boolean(row.href)
                          const isFirst = index === 0
                          const isLast = index === activityRows.length - 1
                          return (
                            <li
                              key={row.moduleId}
                              className="flex w-[min(280px,calc(100vw-3rem))] shrink-0 flex-col items-center px-3 sm:w-72 sm:px-4"
                            >
                              {/* Bleed past horizontal padding so line segments meet between columns */}
                              <div className="mb-3 flex w-[calc(100%+1.5rem)] max-w-none items-center -mx-3 sm:w-[calc(100%+2rem)] sm:-mx-4">
                                <div
                                  className={`h-0.5 min-h-[2px] flex-1 rounded-full ${isFirst ? 'bg-transparent' : 'bg-gray-300 dark:bg-gray-600'}`}
                                  aria-hidden
                                />
                                <div
                                  className="mx-1 h-4 w-4 shrink-0 rounded-full border-4 border-white bg-lasso-teal shadow-md ring-1 ring-gray-200 dark:border-gray-800 dark:ring-gray-600"
                                  aria-hidden
                                />
                                <div
                                  className={`h-0.5 min-h-[2px] flex-1 rounded-full ${isLast ? 'bg-transparent' : 'bg-gray-300 dark:bg-gray-600'}`}
                                  aria-hidden
                                />
                              </div>
                              <div className="w-full rounded-lg border border-gray-200 bg-gray-50/90 p-4 text-center shadow-sm dark:border-gray-600 dark:bg-gray-900/50">
                                <h3 className="text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                                  {row.moduleName}
                                </h3>
                                <p className="mt-2 text-xs leading-snug text-gray-600 dark:text-gray-400">{row.statusLabel}</p>
                                <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                                  Last activity
                                </p>
                                <p className="mt-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">{row.lastActivityLabel}</p>
                                <div className="mt-4">
                                  {actionAvailable && row.href ? (
                                    <Link
                                      href={row.href}
                                      className="text-sm font-medium text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue"
                                    >
                                      Open
                                    </Link>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                  )}
                                </div>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
                </div>{/* overflow-hidden inner */}
              </div>{/* grid-template-rows wrapper */}
            </div>

            {/* Module cards — inside right column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {MODULES.map((module) => {
                const isAvailable = module.status === 'available' && module.href
                const href = module.href ? `/patients/${patient.id}/${module.href}` : '#'
                const cardClasses = `group relative block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border transition-all duration-300 ${
                  isAvailable
                    ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] border-gray-200 dark:border-gray-700 hover:border-lasso-blue dark:hover:border-lasso-blue'
                    : 'cursor-not-allowed opacity-25 border-gray-200 dark:border-gray-700'
                }`
                const content = (
                  <>
                    <div
                      className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
                        module.status === 'coming_soon' ? 'from-gray-400 to-gray-500' : module.gradient
                      }`}
                    />
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div
                          className={`text-4xl ${module.status === 'coming_soon' ? 'grayscale' : ''}`}
                          aria-hidden="true"
                        >
                          {module.icon}
                        </div>
                        {module.status === 'coming_soon' && (
                          <span className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                            Coming Soon
                          </span>
                        )}
                        {isAvailable && (
                          <span className="px-2 py-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full">
                            Available
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {module.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {module.description}
                      </p>
                      {isAvailable && (
                        <span className="inline-flex items-center text-lasso-blue dark:text-lasso-blue font-medium text-sm group-hover:gap-2 transition-all duration-200">
                          <span>Open</span>
                          <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                        </span>
                      )}
                    </div>
                  </>
                )
                return isAvailable ? (
                  <Link key={module.id} href={href} className={cardClasses}>
                    {content}
                  </Link>
                ) : (
                  <div key={module.id} className={cardClasses}>
                    {content}
                  </div>
                )
              })}
            </div>
            </div>{/* end right column flex */}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
