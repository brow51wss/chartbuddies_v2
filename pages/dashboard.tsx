import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import type { UserProfile, Patient } from '../types/auth'

interface EHRModule {
  id: string
  name: string
  description: string
  icon: string
  status: 'available' | 'coming_soon'
  color: string
  gradient: string
  route?: string
}

export default function Dashboard() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  // Define EHR modules
  const modules: EHRModule[] = [
    {
      id: 'mar',
      name: 'Medication Administration Record',
      description: 'Track and manage medication administration for patients',
      icon: '💊',
      status: 'available',
      color: 'blue',
      gradient: 'from-blue-500 to-blue-600',
      route: '/dashboard/mar'
    },
    {
      id: 'vitals',
      name: 'Vital Signs',
      description: 'Record and monitor patient vital signs (BP, temperature, pulse, etc.)',
      icon: '📊',
      status: 'coming_soon',
      color: 'green',
      gradient: 'from-green-500 to-green-600'
    },
    {
      id: 'progress',
      name: 'Progress Notes',
      description: 'Document patient progress, observations, and clinical notes',
      icon: '📝',
      status: 'coming_soon',
      color: 'purple',
      gradient: 'from-purple-500 to-purple-600'
    },
    {
      id: 'admissions',
      name: 'Admissions',
      description: 'Manage patient admissions, discharges, and transfers',
      icon: '🏥',
      status: 'coming_soon',
      color: 'indigo',
      gradient: 'from-indigo-500 to-indigo-600'
    },
    {
      id: 'lab',
      name: 'Laboratory Results',
      description: 'View and manage laboratory test results and reports',
      icon: '🔬',
      status: 'coming_soon',
      color: 'orange',
      gradient: 'from-orange-500 to-orange-600'
    },
    {
      id: 'imaging',
      name: 'Imaging & Radiology',
      description: 'Access diagnostic imaging studies and radiology reports',
      icon: '🩻',
      status: 'coming_soon',
      color: 'teal',
      gradient: 'from-teal-500 to-teal-600'
    }
  ]

  useEffect(() => {
    const loadData = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      // Load patients based on role
      await loadPatients(profile)
      setLoading(false)
    }
    loadData()
  }, [router])

  const loadPatients = async (profile: UserProfile) => {
    try {
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })

      if (profile.role === 'nurse') {
        // Nurses only see assigned patients
        const { data: assignments, error: assignError } = await supabase
          .from('nurse_patient_assignments')
          .select('patient_id')
          .eq('nurse_id', profile.id)
          .eq('is_active', true)

        if (assignError) throw assignError

        const patientIds = assignments?.map(a => a.patient_id) || []
        if (patientIds.length > 0) {
          query = query.in('id', patientIds)
        } else {
          query = query.eq('id', '00000000-0000-0000-0000-000000000000') // Empty result
        }
      } else if (profile.role === 'head_nurse') {
        // Head nurses see all hospital patients
        query = query.eq('hospital_id', profile.hospital_id!)
      }
      // Superadmins see all patients (no filter)

      const { data, error: queryError } = await query

      if (queryError) throw queryError
      setPatients(data || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const handleModuleClick = (module: EHRModule) => {
    if (module.status === 'coming_soon') {
      return
    }

    if (module.id === 'mar') {
      setSelectedModule('mar')
    }
  }

  const handleBackToModules = () => {
    setSelectedModule(null)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Dashboard - Lasso</title>
      </Head>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <img 
                  src="/images/icon-wordmark.webp" 
                  alt="Lasso EHR" 
                  className="h-10 w-auto"
                />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {userProfile?.full_name} • {userProfile?.role?.replace('_', ' ').toUpperCase()}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/admissions"
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <span>+</span>
                  <span>Add Patient</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md shadow-sm">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {!selectedModule ? (
            // Module Selection View
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  EHR Modules
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Select a module to access patient records and documentation
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((module) => (
                  <div
                    key={module.id}
                    onClick={() => handleModuleClick(module)}
                    className={`group relative bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 ${
                      module.status === 'available'
                        ? 'cursor-pointer hover:scale-105 hover:border-blue-300 dark:hover:border-blue-600'
                        : 'cursor-not-allowed opacity-75'
                    }`}
                  >
                    {/* Gradient Background */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${
                        module.status === 'coming_soon' 
                          ? 'from-gray-400 to-gray-500' 
                          : module.gradient
                      } transition-all duration-300`}
                    />
                    {/* Hover color overlay for coming soon modules */}
                    {module.status === 'coming_soon' && (
                      <div
                        className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${module.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                      />
                    )}

                    <div className="p-6">
                      {/* Icon and Status */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="text-4xl">{module.icon}</div>
                        {module.status === 'coming_soon' && (
                          <span className="px-2 py-1 text-xs font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full">
                            Coming Soon
                          </span>
                        )}
                        {module.status === 'available' && (
                          <span className="px-2 py-1 text-xs font-semibold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 rounded-full">
                            Available
                          </span>
                        )}
                      </div>

                      {/* Module Name */}
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {module.name}
                      </h3>

                      {/* Description */}
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {module.description}
                      </p>

                      {/* Action Button */}
                      {module.status === 'available' && (
                        <div className="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm group-hover:gap-2 transition-all duration-200">
                          <span>Open Module</span>
                          <span className="ml-1 group-hover:translate-x-1 transition-transform duration-200">
                            →
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hover Effect Overlay */}
                    {module.status === 'available' && (
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : selectedModule === 'mar' ? (
            // MAR Module - Patient List View
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <button
                    onClick={handleBackToModules}
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-2 inline-flex items-center gap-2 text-sm font-medium transition-colors"
                  >
                    <span>←</span>
                    <span>Back to Modules</span>
                  </button>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Medication Administration Record
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select a patient to view or create MAR forms
                  </p>
                </div>
              </div>

              {patients.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
                  <div className="text-6xl mb-4">💊</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Patients Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Add your first patient to start creating MAR forms
                  </p>
                  <Link
                    href="/admissions"
                    className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Add Patient
                  </Link>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Patient Name
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Record Number
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Date of Birth
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Diagnosis
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {patients.map((patient) => (
                          <tr
                            key={patient.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                {patient.patient_name}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {patient.record_number}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(patient.date_of_birth).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {patient.diagnosis || (
                                  <span className="text-gray-400 dark:text-gray-500 italic">N/A</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Link
                                href={`/patients/${patient.id}/mar/new`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                              >
                                <span>Open MAR</span>
                                <span>→</span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </main>
      </div>
    </ProtectedRoute>
  )
}

