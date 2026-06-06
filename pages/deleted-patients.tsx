import { useState, useEffect } from 'react'
import { usePatientListView } from '../hooks/usePatientListView'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { rdsPatchPatient } from '../lib/rdsApi'
import { supabase } from '../lib/supabase'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile } from '../types/auth'
import { formatCalendarDate } from '../lib/calendarDate'
import { PatientSummaryCard } from '../components/PatientSummaryCard'


type SortColumn = 'date_of_birth' | 'created_at' | 'first_name' | 'last_name' | null
type SortDirection = 'asc' | 'desc'

const parsePatientName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts[0] || ''
  const lastName = parts.length > 1 ? parts[parts.length - 1] : ''
  return { firstName, lastName }
}

interface DeletedPatient {
  id: string
  hospital_id: string
  patient_name: string
  record_number: string
  date_of_birth: string
  sex?: 'Male' | 'Female' | 'Other' | null
  diagnosis: string | null
  created_at: string
  deleted_at: string
  patient_photo?: string | null
  home_phone?: string | null
}

export default function DeletedPatientsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [patients, setPatients] = useState<DeletedPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [searchQuery, setSearchQuery] = useState('')
  const { view: patientsView, setView: setPatientsView } = usePatientListView()
  const { isReadOnly } = useReadOnly()

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
      compareA = new Date(a[sortColumn]).getTime()
      compareB = new Date(b[sortColumn]).getTime()
    }

    if (typeof compareA === 'string' && typeof compareB === 'string') {
      const result = compareA.localeCompare(compareB)
      return sortDirection === 'asc' ? result : -result
    }
    const result = (compareA as number) - (compareB as number)
    return sortDirection === 'asc' ? result : -result
  })

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

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

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
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
        // Fetch all patients (including deleted) then filter client-side for archived ones
        const { data: session } = await supabase.auth.getSession()
        const token = session?.session?.access_token
        if (!token) throw new Error('Not authenticated')
        const res = await fetch('/api/rds/patients?includeDeleted=true', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to load patients')
        const all: DeletedPatient[] = await res.json()
        setPatients(all.filter((p) => p.deleted_at != null).sort(
          (a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime()
        ))
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
      await rdsPatchPatient(patientId, { deleted_at: null })
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
        <Head><title>Archived patients - Lasso</title></Head>
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
        <title>Archived patients - Lasso</title>
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

          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link
                href="/dashboard"
                className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue mb-2 inline-flex items-center gap-2 text-sm font-medium transition-colors"
              >
                <span>←</span>
                <span>Back to Patients</span>
              </Link>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Archived patients
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Restore a patient to bring them back to the main list with all MAR and progress note data.
              </p>
            </div>
            {patients.length > 0 && (
              <div
                className="inline-flex rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-900/40 p-0.5 shadow-sm"
                role="group"
                aria-label="Display format"
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13" />
                    <circle cx="5" cy="6" r="1.25" fill="currentColor" stroke="none" />
                    <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
                    <circle cx="5" cy="18" r="1.25" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {patients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center border border-gray-200 dark:border-gray-700">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No archived patients</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Archived patients will appear here. You can restore them at any time.
              </p>
            </div>
          ) : (
            <>
              {/* Search bar */}
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

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
                {/* Sort toolbar — always visible */}
                {patientsView === 'cards' && (
                  <div className="flex flex-wrap items-center gap-2 justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Sort</span>
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
                              ? 'border-lasso-teal bg-lasso-teal text-white [&_svg]:text-white'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-lasso-blue/40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-lasso-teal/40'
                          }`}
                        >
                          {label}
                          <SortIcon column={col} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      {searchQuery && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {filteredSortedPatients.length} of {patients.length}
                        </span>
                      )}
                      {sortColumn && (
                        <button
                          type="button"
                          onClick={() => { setSortColumn(null); setSortDirection('asc') }}
                          className="text-xs font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          Clear sort
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {filteredSortedPatients.length === 0 ? (
                  <div className="p-12 text-center">
                    <div className="text-5xl mb-4">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No patients found</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">No archived patients match &ldquo;{searchQuery}&rdquo;.</p>
                    <button type="button" onClick={() => setSearchQuery('')} className="text-sm font-medium text-lasso-teal hover:text-lasso-blue">Clear search</button>
                  </div>
                ) : patientsView === 'cards' ? (
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
                          footer={
                            <button
                              type="button"
                              onClick={() => handleUndelete(patient.id, patient.patient_name)}
                              disabled={restoringId === patient.id}
                              className="text-sm font-medium text-lasso-teal hover:text-lasso-blue dark:text-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {restoringId === patient.id ? 'Restoring...' : 'Restore'}
                            </button>
                          }
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <colgroup>
                        <col className="w-48" />
                        <col className="w-36" />
                        <col className="w-24" />
                        <col className="w-36" />
                        <col className="w-40" />
                      </colgroup>
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-20 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-r border-gray-200 dark:border-gray-600 cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onClick={() => handleSort('first_name')}>
                            <div className="flex items-center">Patient Name <SortIcon column="first_name" /></div>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" onClick={() => handleSort('date_of_birth')}>
                            <div className="flex items-center">DOB <SortIcon column="date_of_birth" /></div>
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Sex</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Phone</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Deleted At</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredSortedPatients.map((patient) => (
                          <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-150">
                            <td className="px-6 py-4 whitespace-nowrap sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600">
                              <div className="text-sm font-semibold text-gray-900 dark:text-white">{patient.patient_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {formatCalendarDate(patient.date_of_birth)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {patient.sex || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {patient.home_phone || <span className="italic text-gray-400 dark:text-gray-500">N/A</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {new Date(patient.deleted_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleUndelete(patient.id, patient.patient_name)}
                                disabled={restoringId === patient.id}
                                className="text-sm font-medium text-lasso-teal hover:text-lasso-blue dark:text-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {restoringId === patient.id ? 'Restoring...' : 'Restore'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}
