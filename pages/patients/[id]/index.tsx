import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import AppHeader from '../../../components/AppHeader'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth'
import type { Patient } from '../../../types/auth'

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
  const { id: patientId } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activityRows, setActivityRows] = useState<BinderActivityRow[]>([])
  const [showActivityStatus, setShowActivityStatus] = useState(true)

  const formatDateTimeLabel = (value?: string | null) => {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return date.toLocaleString()
  }

  useEffect(() => {
    if (!patientId || typeof patientId !== 'string') return
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      const { data, error: fetchError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()
      if (fetchError || !data) {
        setError('Patient not found')
        setLoading(false)
        return
      }
      setPatient(data)

      const [marRes, progressRes] = await Promise.all([
        supabase
          .from('mar_forms')
          .select('id, status, month_year, updated_at, created_at')
          .eq('patient_id', patientId)
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('progress_note_entries')
          .select('id, updated_at, note_date')
          .eq('patient_id', patientId)
          .order('updated_at', { ascending: false })
          .limit(1),
      ])

      const latestMar = marRes.data?.[0]
      const latestProgressEntry = progressRes.data?.[0]

      const rows: BinderActivityRow[] = []

      const marModule = MODULES.find((module) => module.id === 'mar')
      if (latestMar && marModule) {
        rows.push({
          moduleId: marModule.id,
          moduleName: marModule.name,
          statusLabel: `${String(latestMar.status || 'active').replace('_', ' ')} (${latestMar.month_year || 'unknown month'})`,
          lastActivityLabel: formatDateTimeLabel(latestMar.updated_at || latestMar.created_at),
          href: marModule.href ? `/patients/${patientId}/${marModule.href}` : undefined,
        })
      }

      const progressModule = MODULES.find((module) => module.id === 'progress')
      if (latestProgressEntry && progressModule) {
        rows.push({
          moduleId: progressModule.id,
          moduleName: progressModule.name,
          statusLabel: 'Has entries',
          lastActivityLabel: formatDateTimeLabel(latestProgressEntry.updated_at || latestProgressEntry.note_date || null),
          href: progressModule.href ? `/patients/${patientId}/${progressModule.href}` : undefined,
        })
      }

      setActivityRows(rows)
      setLoading(false)
    }
    load()
  }, [patientId, router])

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
          patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
          patientName={patient.patient_name}
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
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
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
                className={`w-5 h-5 text-gray-500 dark:text-gray-300 transition-transform ${showActivityStatus ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showActivityStatus && (
              <div id="activity-status-panel" className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
                <table className="min-w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Module</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Last activity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityRows.map((row) => {
                      const actionAvailable = row.moduleId === 'mar' || row.moduleId === 'progress'
                      return (
                        <tr key={row.moduleId} className="border-t border-gray-200 dark:border-gray-700">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{row.moduleName}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.statusLabel}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.lastActivityLabel}</td>
                          <td className="px-4 py-3 text-sm">
                            {actionAvailable && row.href ? (
                              <Link href={row.href} className="font-medium text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue">
                                Open
                              </Link>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {MODULES.map((module) => {
              const isAvailable = module.status === 'available' && module.href
              const href = module.href ? `/patients/${patientId}/${module.href}` : '#'
              const cardClasses = `group relative block bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border transition-all duration-300 ${
                isAvailable
                  ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] border-gray-200 dark:border-gray-700 hover:border-lasso-blue dark:hover:border-lasso-blue'
                  : 'cursor-not-allowed opacity-75 border-gray-200 dark:border-gray-700'
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
                        className={`text-4xl ${
                          module.status === 'coming_soon'
                            ? 'grayscale opacity-70'
                            : ''
                        }`}
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
        </main>
      </div>
    </ProtectedRoute>
  )
}
