import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
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
    id: 'vitals',
    name: 'Vital Signs',
    description: 'Record and monitor vital signs (BP, temperature, pulse, etc.)',
    icon: '📊',
    status: 'coming_soon',
    gradient: 'from-green-500 to-green-600'
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
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link
              href="/dashboard"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 inline-flex items-center gap-2 text-sm font-medium transition-colors"
            >
              <span>←</span>
              <span>Back to Patients</span>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {patient.patient_name}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Select a module to access records and documentation for this patient
            </p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULES.map((module) => {
              const isAvailable = module.status === 'available' && module.href
              const href = module.href ? `/patients/${patientId}/${module.href}` : '#'
              return (
                <div
                  key={module.id}
                  className={`group relative bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border transition-all duration-300 ${
                    isAvailable
                      ? 'cursor-pointer hover:shadow-xl hover:scale-[1.02] border-gray-200 dark:border-gray-700 hover:border-lasso-blue dark:hover:border-lasso-blue'
                      : 'cursor-not-allowed opacity-75 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div
                    className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
                      module.status === 'coming_soon' ? 'from-gray-400 to-gray-500' : module.gradient
                    }`}
                  />
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-4xl">{module.icon}</div>
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
                      <Link
                        href={href}
                        className="inline-flex items-center text-lasso-blue dark:text-lasso-blue font-medium text-sm group-hover:gap-2 transition-all duration-200"
                      >
                        <span>Open</span>
                        <span className="ml-1 group-hover:translate-x-1 transition-transform">→</span>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
