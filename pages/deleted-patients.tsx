import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile } from '../types/auth'
import { formatCalendarDate } from '../lib/calendarDate'

interface DeletedPatient {
  id: string
  hospital_id: string
  patient_name: string
  record_number: string
  date_of_birth: string
  diagnosis: string | null
  created_at: string
  deleted_at: string
}

export default function DeletedPatientsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [patients, setPatients] = useState<DeletedPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const { isReadOnly } = useReadOnly()

  useEffect(() => {
    if (isReadOnly) {
      router.replace('/dashboard')
      return
    }
  }, [isReadOnly, router])

  useEffect(() => {
    if (isReadOnly) return
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      if (profile.role !== 'head_nurse' && profile.role !== 'superadmin') {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)
      try {
        let query = supabase
          .from('patients')
          .select('id, hospital_id, patient_name, record_number, date_of_birth, diagnosis, created_at, deleted_at')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false })

        if (profile.role === 'head_nurse') {
          query = query.eq('hospital_id', profile.hospital_id!)
        }

        const { data, error: queryError } = await query
        if (queryError) {
          if (queryError.message?.includes('deleted_at')) {
            setError('Deleted patients list is not available yet. Run database migration 051_add_patients_deleted_at.sql to enable it.')
          } else {
            throw queryError
          }
        } else {
          setPatients((data as DeletedPatient[]) || [])
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, isReadOnly])

  const handleUndelete = async (patientId: string, patientName: string) => {
    if (!userProfile) return
    const confirmed = window.confirm(
      `Restore "${patientName}"? They will appear on the main Patients list again with all MAR and progress note data intact.`
    )
    if (!confirmed) return
    setRestoringId(patientId)
    setError('')
    try {
      const { error: updateError } = await supabase
        .from('patients')
        .update({ deleted_at: null })
        .eq('id', patientId)
      if (updateError) throw updateError
      setPatients((prev) => prev.filter((p) => p.id !== patientId))
      setMessage(`"${patientName}" has been restored.`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to restore patient')
    } finally {
      setRestoringId(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Head><title>Deleted patients - Lasso</title></Head>
        <div className="min-h-screen">
          <AppHeader userProfile={userProfile} onLogout={async () => { await signOut(); router.push('/auth/login') }} />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Deleted patients - Lasso</title>
      </Head>
      <div className="min-h-screen">
        <AppHeader userProfile={userProfile} onLogout={async () => { await signOut(); router.push('/auth/login') }} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md shadow-sm">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          {message && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-md shadow-sm">
              <p className="text-green-800 dark:text-green-200">{message}</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Deleted patients
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Restore a patient to bring them back to the main list with all MAR and progress note data.
            </p>
          </div>

          {patients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                No deleted patients
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Deleted patients will appear here. You can restore them at any time.
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-lasso-teal text-white rounded-lg hover:bg-lasso-blue font-medium"
              >
                Back to Patients
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
                        Date of Birth
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Date Added
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Deleted at
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
                      <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                          {patient.patient_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatCalendarDate(patient.date_of_birth)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(patient.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {new Date(patient.deleted_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {patient.diagnosis || (
                            <span className="text-gray-400 dark:text-gray-500 italic">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleUndelete(patient.id, patient.patient_name)}
                            disabled={restoringId === patient.id}
                            className="inline-flex items-center gap-1 text-sm font-medium text-lasso-teal hover:text-lasso-blue dark:text-lasso-teal dark:hover:text-lasso-blue/80 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {restoringId === patient.id ? 'Restoring...' : 'Undelete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}
