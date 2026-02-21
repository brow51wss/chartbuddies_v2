import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import type { UserProfile, Patient } from '../types/auth'

type SortColumn = 'date_of_birth' | 'created_at' | 'first_name' | 'last_name' | null
type SortDirection = 'asc' | 'desc'

// Helper to parse first/last name from full name
const parsePatientName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
  return { firstName, lastName }
}

export default function Dashboard() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [showNameSortMenu, setShowNameSortMenu] = useState(false)
  const nameSortRef = useRef<HTMLTableCellElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nameSortRef.current && !nameSortRef.current.contains(event.target as Node)) {
        setShowNameSortMenu(false)
      }
    }

    if (showNameSortMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNameSortMenu])

  // Sort patients based on current sort settings
  const sortedPatients = [...patients].sort((a, b) => {
    if (!sortColumn) return 0
    
    let compareA: string | number
    let compareB: string | number
    
    if (sortColumn === 'first_name') {
      compareA = parsePatientName(a.patient_name).firstName.toLowerCase()
      compareB = parsePatientName(b.patient_name).firstName.toLowerCase()
    } else if (sortColumn === 'last_name') {
      compareA = parsePatientName(a.patient_name).lastName.toLowerCase()
      compareB = parsePatientName(b.patient_name).lastName.toLowerCase()
    } else {
      // Date columns
      compareA = new Date(a[sortColumn]).getTime()
      compareB = new Date(b[sortColumn]).getTime()
    }
    
    if (typeof compareA === 'string' && typeof compareB === 'string') {
      const result = compareA.localeCompare(compareB)
      return sortDirection === 'asc' ? result : -result
    } else {
      const result = (compareA as number) - (compareB as number)
      return sortDirection === 'asc' ? result : -result
    }
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column with ascending direction
      setSortColumn(column)
      setSortDirection('asc')
    }
    setShowNameSortMenu(false)
  }

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      // Show neutral sort icon
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    // Show directional arrow
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

  const NameSortIcon = () => {
    const isNameSort = sortColumn === 'first_name' || sortColumn === 'last_name'
    if (!isNameSort) {
      return (
        <svg className="w-4 h-4 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      )
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 ml-1 text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 ml-1 text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }

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

      // Exclude soft-deleted patients (requires migration 051)
      let build = query.is('deleted_at', null)
      let { data, error: queryError } = await build
      if (queryError?.message?.includes('deleted_at')) {
        // Column not added yet; load all (no soft-delete filter)
        const fallback = query
        const res = await fallback
        data = res.data
        queryError = res.error
      }
      if (queryError) throw queryError

      // Client-side filter if DB has no deleted_at (e.g. old data)
      const activeData = Array.isArray(data)
        ? data.filter((p: { deleted_at?: string | null }) => p.deleted_at == null)
        : []

      // Get the most recent MAR form diagnosis for each patient
      if (activeData.length > 0) {
        const patientIds = activeData.map((p: { id: string }) => p.id)

        const { data: marForms, error: marError } = await supabase
          .from('mar_forms')
          .select('patient_id, diagnosis')
          .in('patient_id', patientIds)
          .order('created_at', { ascending: false })

        if (!marError && marForms) {
          const diagnosisMap = new Map<string, string | null>()
          marForms.forEach((form: { patient_id: string; diagnosis: string | null }) => {
            if (!diagnosisMap.has(form.patient_id) && form.diagnosis) {
              diagnosisMap.set(form.patient_id, form.diagnosis)
            }
          })
          setPatients(
            activeData.map((patient: Patient) => ({
              ...patient,
              diagnosis: diagnosisMap.get(patient.id) || patient.diagnosis
            }))
          )
        } else {
          setPatients(activeData)
        }
      } else {
        setPatients(activeData)
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const handleDeletePatient = async (patientId: string, patientName: string) => {
    if (!userProfile) return
    
    // Only allow head nurses and superadmins to delete
    if (userProfile.role !== 'head_nurse' && userProfile.role !== 'superadmin') {
      setError('You do not have permission to delete patients')
      setTimeout(() => setError(''), 5000)
      return
    }

    // Confirm deletion
    const confirmed = window.confirm(
      `Are you sure you want to delete patient "${patientName}"?\n\nThe patient will be moved to the deleted list. You can restore them (with all MAR and progress note data) from the "Deleted patients" page.`
    )

    if (!confirmed) return

    try {
      const { data: updatedRows, error: updateError } = await supabase
        .from('patients')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', patientId)
        .select('id')

      const softDeleteWorked = !updateError && updatedRows != null && updatedRows.length > 0
      let removed = softDeleteWorked

      if (updateError) {
        if (updateError.message?.includes('deleted_at')) {
          const { data: deletedRows, error: deleteError } = await supabase
            .from('patients')
            .delete()
            .eq('id', patientId)
            .select('id')
          if (deleteError) throw deleteError
          removed = (deletedRows?.length ?? 0) > 0
        } else {
          throw updateError
        }
      } else if (!softDeleteWorked) {
        const { data: deletedRows, error: deleteError } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId)
          .select('id')
        if (deleteError) throw deleteError
        removed = (deletedRows?.length ?? 0) > 0
      }

      if (!removed) {
        setError('Could not delete patient. The patient may not exist or you may not have permission. If you added the deleted_at column, check that RLS allows UPDATE on patients.')
        setTimeout(() => setError(''), 8000)
        return
      }

      if (userProfile) await loadPatients(userProfile)
      setMessage(
        softDeleteWorked
          ? `Patient "${patientName}" has been deleted. You can restore them from Deleted patients.`
          : `Patient "${patientName}" has been deleted.`
      )
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error deleting patient:', err)
      setError(err.message || 'Failed to delete patient')
      setTimeout(() => setError(''), 5000)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
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
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-[999]">
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
                  className="px-4 py-2 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <span>+</span>
                  <span>Add Patient</span>
                </Link>
                <Link
                  href="/profile"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
                >
                  Profile
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

          {message && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-md shadow-sm">
              <p className="text-green-800 dark:text-green-200">{message}</p>
            </div>
          )}

          {/* Patient list (default dashboard view) */}
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Patients
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select a patient to view their records and modules
                </p>
              </div>
              {(userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin') && (
                <Link
                  href="/deleted-patients"
                  className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-teal"
                >
                  View deleted patients
                </Link>
              )}
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
                    className="inline-block px-6 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue font-medium shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Add Patient
                  </Link>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <colgroup>
                          <col className="w-48" /> {/* Patient Name - ~192px */}
                          <col className="w-36" /> {/* Date of Birth - ~144px */}
                          <col className="w-36" /> {/* Date Added - ~144px */}
                        </colgroup>
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                          <tr>
                            <th 
                              ref={nameSortRef}
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-r border-gray-200 dark:border-gray-600 relative"
                            >
                              <div 
                                className="flex items-center cursor-pointer hover:text-lasso-blue transition-colors select-none"
                                onClick={() => setShowNameSortMenu(!showNameSortMenu)}
                              >
                                Patient Name
                                <NameSortIcon />
                                <svg className="w-3 h-3 ml-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                              {(sortColumn === 'first_name' || sortColumn === 'last_name') && (
                                <div className="text-[10px] text-lasso-blue font-normal normal-case mt-0.5">
                                  by {sortColumn === 'first_name' ? 'First Name' : 'Last Name'}
                                </div>
                              )}
                              {/* Dropdown Menu */}
                              {showNameSortMenu && (
                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 min-w-[160px]">
                                  <div className="py-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSort('first_name'); }}
                                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${sortColumn === 'first_name' ? 'text-lasso-blue font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                    >
                                      <span>First Name</span>
                                      {sortColumn === 'first_name' && (
                                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                      )}
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSort('last_name'); }}
                                      className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${sortColumn === 'last_name' ? 'text-lasso-blue font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                                    >
                                      <span>Last Name</span>
                                      {sortColumn === 'last_name' && (
                                        <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                      )}
                                    </button>
                                    {(sortColumn === 'first_name' || sortColumn === 'last_name') && (
                                      <>
                                        <div className="border-t border-gray-200 dark:border-gray-600 my-1"></div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSortColumn(null); setShowNameSortMenu(false); }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                          Clear Sort
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </th>
                            <th 
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-[192px] z-20 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-r border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                              onClick={() => handleSort('date_of_birth')}
                            >
                              <div className="flex items-center">
                                Date of Birth
                                <SortIcon column="date_of_birth" />
                              </div>
                            </th>
                            <th 
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                              onClick={() => handleSort('created_at')}
                            >
                              <div className="flex items-center">
                                Date Added
                                <SortIcon column="created_at" />
                              </div>
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
                          {sortedPatients.map((patient) => (
                            <tr
                              key={patient.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                            >
                              <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {patient.patient_name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap sticky left-[192px] z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(patient.date_of_birth).toLocaleDateString()}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {new Date(patient.created_at).toLocaleDateString()}
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
                                <div className="flex items-center gap-3">
                                  <Link
                                    href={`/patients/${patient.id}`}
                                    className="inline-flex items-center gap-1 text-sm font-medium text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue dark:hover:text-lasso-blue/80 transition-colors"
                                  >
                                    <span>Open</span>
                                  </Link>
                                  {(userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin') && (
                                    <button
                                      onClick={() => handleDeletePatient(patient.id, patient.patient_name)}
                                      className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                      title="Delete patient"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

