import { useState, useEffect, useRef } from 'react'
import { usePatientListView } from '../hooks/usePatientListView'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { rdsListPatients, rdsCreatePatient, rdsPatchPatient } from '../lib/rdsApi'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile, Patient } from '../types/auth'
import EditPatientInfoModal, { type EditPatientInfoSaveArgs } from '../components/EditPatientInfoModal'
import { PatientSummaryCard } from '../components/PatientSummaryCard'
import { formatCalendarDate } from '../lib/calendarDate'

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
  const [userFacilityName, setUserFacilityName] = useState('')
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const { view: patientsView, setView: setPatientsView } = usePatientListView()
  const [showNameSortMenu, setShowNameSortMenu] = useState(false)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const nameSortRef = useRef<HTMLTableCellElement>(null)
  const { isReadOnly } = useReadOnly()

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

  const q = searchQuery.trim().toLowerCase()
  const filteredSortedPatients = q
    ? sortedPatients.filter((p) => {
        const dob = formatCalendarDate(p.date_of_birth).toLowerCase()
        return (
          p.patient_name.toLowerCase().includes(q) ||
          (p.diagnosis || '').toLowerCase().includes(q) ||
          (p.record_number || '').toLowerCase().includes(q) ||
          dob.includes(q)
        )
      })
    : sortedPatients

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

      if (profile.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        setUserFacilityName(hospital?.name ?? '')
      } else {
        setUserFacilityName('')
      }

      // Load patients based on role
      await loadPatients(profile)
      setLoading(false)
    }
    loadData()
  }, [router])

  const loadPatients = async (_profile: UserProfile) => {
    try {
      // RDS API enforces facility scoping server-side via JWT
      const data = await rdsListPatients()
      setPatients(Array.isArray(data) ? data : [])
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
      `Are you sure you want to archive patient "${patientName}"?\n\nThe patient will be moved to the archive. You can restore them (with all MAR and progress note data) from the "Archives" page.`
    )

    if (!confirmed) return

    try {
      await rdsPatchPatient(patientId, { deleted_at: new Date().toISOString() })
      if (userProfile) await loadPatients(userProfile)
      setMessage(`Patient "${patientName}" has been archived. You can restore them from Archives.`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error archiving patient:', err)
      setError(err.message || 'Failed to archive patient')
      setTimeout(() => setError(''), 5000)
    }
  }

  const openEditPatientModal = (patient: Patient) => {
    setEditingPatientId(patient.id)
  }

  const handleCreatePatient = async ({ payload }: EditPatientInfoSaveArgs): Promise<Patient> => {
    if (!userProfile) throw new Error('User profile not found.')
    if (!userProfile.hospital_id) {
      throw new Error('Hospital ID is missing. Please use the admissions page or contact support.')
    }

    const recordNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    const row = {
      hospital_id: userProfile.hospital_id,
      record_number: recordNumber,
      created_by: userProfile.id,
      ...payload,
      facility_name: userFacilityName || payload.facility_name,
    }

    const data = await rdsCreatePatient(row)
    if (!data) throw new Error('No patient returned from server.')
    return data as Patient
  }

  const handleSavePatientEdits = async ({ patientId, payload }: EditPatientInfoSaveArgs): Promise<Patient> => {
    if (!userProfile) throw new Error('User profile not found.')
    if (!patientId) throw new Error('Patient ID is missing.')
    if (userProfile.role !== 'head_nurse' && userProfile.role !== 'superadmin') {
      throw new Error('You do not have permission to edit patient details.')
    }

    const data = await rdsPatchPatient(patientId, {
      ...payload,
      facility_name: userFacilityName || payload.facility_name,
      sync_mar_forms: true,
    })
    if (!data) throw new Error('No updated patient returned from server.')
    return data as Patient
  }

  const renderPatientActions = (patient: Patient) => (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/patients/${patient.id}`}
        className="inline-flex items-center gap-1 text-sm font-medium text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue dark:hover:text-lasso-blue/80 transition-colors"
      >
        <span>Open</span>
      </Link>
      {(userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin') && !isReadOnly && (
        <button
          type="button"
          onClick={() => openEditPatientModal(patient)}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-lasso-blue dark:text-gray-300 dark:hover:text-lasso-blue transition-colors"
          title="Edit patient details"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}
      {(userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin') && !isReadOnly && (
        <button
          type="button"
          onClick={() => handleDeletePatient(patient.id, patient.patient_name)}
          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          title="Archive patient"
        >
          Archive
        </button>
      )}
    </div>
  )

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
        <AppHeader userProfile={userProfile} onLogout={handleLogout} />

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
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Patients
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Select a patient to view their records and modules
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAddPatientModal(true)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                  >
                    <span aria-hidden="true">+</span>
                    <span>Add Patient</span>
                  </button>
                )}
                {patients.length > 0 && (
                  <div
                    className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-0.5 shadow-sm"
                    role="group"
                    aria-label="Patients display format"
                  >
                    <button
                      type="button"
                      onClick={() => setPatientsView('cards')}
                      className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-2 transition-colors ${
                        patientsView === 'cards'
                          ? 'bg-white text-lasso-navy shadow-sm dark:bg-gray-800 dark:text-white'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                      aria-pressed={patientsView === 'cards'}
                      aria-label="Card view"
                      title="Card view"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientsView('list')}
                      className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded-md p-2 transition-colors ${
                        patientsView === 'list'
                          ? 'bg-white text-lasso-navy shadow-sm dark:bg-gray-800 dark:text-white'
                          : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                      }`}
                      aria-pressed={patientsView === 'list'}
                      aria-label="List view"
                      title="List view"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 6h13M8 12h13M8 18h13"
                        />
                        <circle cx="5" cy="6" r="1.25" fill="currentColor" stroke="none" />
                        <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
                        <circle cx="5" cy="18" r="1.25" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                  </div>
                )}
                {(userProfile?.role === 'head_nurse' || userProfile?.role === 'superadmin') && !isReadOnly && (
                  <Link
                    href="/deleted-patients"
                    className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-teal"
                  >
                    Archives
                  </Link>
                )}
              </div>
            </div>

            {patients.length > 0 && (
              <div className="mb-4 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, diagnosis, record #, or date of birth…"
                  className="block w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 shadow-sm placeholder-gray-400 focus:border-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-lasso-teal"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Clear search"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {patients.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
                  <div className="text-6xl mb-4">💊</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    No Patients Found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Add your first patient to start creating MAR forms
                  </p>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => setShowAddPatientModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 font-medium text-white shadow-md transition-colors hover:bg-green-700"
                    >
                      <span aria-hidden="true">+</span>
                      Add Patient
                    </button>
                  )}
                </div>
              ) : filteredSortedPatients.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
                  <div className="text-5xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No patients found</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    No patients match &ldquo;{searchQuery}&rdquo;. Try a different name, diagnosis, or record number.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-sm font-medium text-lasso-teal hover:text-lasso-blue dark:text-lasso-teal"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                    {patientsView === 'cards' && (
                      <div className="flex flex-wrap items-center gap-2 justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-4 py-3 sm:px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                            Sort
                          </span>
                          {(
                            [
                              ['first_name', 'First name'],
                              ['last_name', 'Last name'],
                              ['date_of_birth', 'Date of birth'],
                              ['created_at', 'Date added'],
                            ] as const
                          ).map(([col, label]) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => handleSort(col)}
                              className={`inline-flex items-center rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                sortColumn === col
                                  ? 'border-lasso-teal bg-lasso-teal text-white dark:border-lasso-teal dark:bg-lasso-teal [&_svg]:text-white'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-lasso-blue/40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-lasso-teal/40'
                              }`}
                            >
                              {label}
                              <SortIcon column={col} />
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 ml-auto">
                          {searchQuery && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {filteredSortedPatients.length} of {patients.length}
                            </span>
                          )}
                          {sortColumn && (
                            <button
                              type="button"
                              onClick={() => {
                                setSortColumn(null)
                                setSortDirection('asc')
                              }}
                              className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              Clear sort
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {patientsView === 'list' ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <colgroup>
                          <col className="w-48" /> {/* Patient Name */}
                          <col className="w-36" /> {/* Date of Birth */}
                          <col className="w-24" /> {/* Sex */}
                          <col className="w-36" /> {/* Phone */}
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
                                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-app-header-dropdown min-w-[160px]">
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
                              className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors select-none"
                              onClick={() => handleSort('date_of_birth')}
                            >
                              <div className="flex items-center">
                                Date of Birth
                                <SortIcon column="date_of_birth" />
                              </div>
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Sex
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Phone
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredSortedPatients.map((patient) => (
                            <tr
                              key={patient.id}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150"
                            >
                              <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
                                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {patient.patient_name}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {formatCalendarDate(patient.date_of_birth)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {patient.sex || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                  {patient.home_phone || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {renderPatientActions(patient)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    ) : (
                    <div className="p-4 sm:p-6">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredSortedPatients.map((patient) => (
                          <PatientSummaryCard
                            key={patient.id}
                            patient={patient}
                            nameHeading="h3"
                            showDateAdded={false}
                            showDiagnosis={false}
                            showSex
                            showPhone
                            className="transition-shadow hover:shadow-md"
                            footer={renderPatientActions(patient)}
                          />
                        ))}
                      </div>
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <EditPatientInfoModal
              isOpen={showAddPatientModal}
              mode="create"
              patientId={null}
              title="Add Patient"
              facilityDisplayName={userFacilityName || null}
              recordNumber="Auto-generated"
              readOnly={isReadOnly}
              onClose={() => setShowAddPatientModal(false)}
              onSave={handleCreatePatient}
              onSaved={(createdPatient) => {
                setPatients(prev => [createdPatient, ...prev])
                setMessage('Patient added.')
                setTimeout(() => setMessage(''), 3000)
              }}
            />

            <EditPatientInfoModal
              isOpen={Boolean(editingPatientId)}
              patientId={editingPatientId}
              facilityDisplayName={userFacilityName || null}
              recordNumber={patients.find((p) => p.id === editingPatientId)?.record_number || ''}
              readOnly={isReadOnly}
              onClose={() => setEditingPatientId(null)}
              onSave={handleSavePatientEdits}
              onSaved={(updatedPatient) => {
                setPatients(prev => prev.map(p => (p.id === updatedPatient.id ? { ...p, ...updatedPatient } : p)))
                setMessage('Patient updated.')
                setTimeout(() => setMessage(''), 3000)
              }}
            />
        </main>
      </div>
    </ProtectedRoute>
  )
}

