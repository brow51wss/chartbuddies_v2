import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import DashboardLayout from '../components/DashboardLayout'
import DashboardPatientDetail from '../components/DashboardPatientDetail'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import { rdsListPatients, rdsCreatePatient, rdsPatchPatient } from '../lib/rdsApi'
import type { UserProfile, Patient } from '../types/auth'
import EditPatientInfoModal, { type EditPatientInfoSaveArgs } from '../components/EditPatientInfoModal'

export default function Dashboard() {
  const router = useRouter()
  const [userProfile, setUserProfile]         = useState<UserProfile | null>(null)
  const [userFacilityName, setUserFacilityName] = useState('')
  const [patients, setPatients]               = useState<Patient[]>([])
  const [loading, setLoading]                 = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [showAddPatientModal, setShowAddPatientModal] = useState(false)
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null)

  // Auto-select first patient when list loads
  useEffect(() => {
    if (patients.length > 0 && !selectedPatientId) {
      setSelectedPatientId(patients[0].id)
    }
  }, [patients, selectedPatientId])

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
      }

      try {
        const data = await rdsListPatients()
        setPatients(Array.isArray(data) ? data : [])
      } catch (err: any) {
        console.error('Failed to load patients:', err.message)
      }

      setLoading(false)
    }
    loadData()
  }, [router])

  const handleArchivePatient = async (patientId: string, patientName: string) => {
    if (!userProfile) return
    if (userProfile.role !== 'head_nurse' && userProfile.role !== 'superadmin') return
    const confirmed = window.confirm(
      `Archive "${patientName}"?\n\nThe patient will be moved to the archive and can be restored from the Archives page.`
    )
    if (!confirmed) return
    try {
      await rdsPatchPatient(patientId, { deleted_at: new Date().toISOString() })
      setPatients(prev => prev.filter(p => p.id !== patientId))
      if (selectedPatientId === patientId) {
        const remaining = patients.filter(p => p.id !== patientId)
        setSelectedPatientId(remaining[0]?.id ?? null)
      }
    } catch (err: any) {
      console.error('Error archiving patient:', err)
    }
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

  const selectedPatient = patients.find(p => p.id === selectedPatientId) ?? null

  // ── Loading screen ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-[#f4f7f7] dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute>
      <Head>
        <title>Dashboard — Lasso</title>
      </Head>

      <DashboardLayout
        userProfile={userProfile}
        facilityName={userFacilityName}
        patients={patients}
        loadingPatients={false}
        selectedPatientId={selectedPatientId}
        onSelectPatient={setSelectedPatientId}
        onAddPatient={() => setShowAddPatientModal(true)}
      >
        {/* Onboarding banner */}
        {(!userProfile?.staff_signature || !userProfile?.staff_initials) && (
          <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Action required: Complete your account setup
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                Your signature and initials are required to sign MAR records. You won&apos;t be able to record any medication administrations until this is done.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="flex-shrink-0 inline-block bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Set Up Now
            </Link>
          </div>
        )}

        {/* Patient detail or empty state */}
        {selectedPatient ? (
          <DashboardPatientDetail
            patient={selectedPatient}
            userProfile={userProfile}
            onArchive={handleArchivePatient}
            onSavePatient={async (patientId, payload) => {
              const updated = await handleSavePatientEdits({
                patientId,
                payload,
              } as EditPatientInfoSaveArgs)
              setPatients(prev => prev.map(p => p.id === patientId ? { ...p, ...updated } : p))
              return updated
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            {patients.length === 0 ? (
              <>
                <div className="text-5xl mb-4">💊</div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No residents yet</h3>
                <p className="text-sm text-gray-400 mb-5">Add your first resident to get started.</p>
                <button
                  type="button"
                  onClick={() => setShowAddPatientModal(true)}
                  className="bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-colors"
                >
                  + Add resident
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3 opacity-30">←</div>
                <p className="text-sm text-gray-400 font-semibold">Select a resident from the sidebar</p>
              </>
            )}
          </div>
        )}
      </DashboardLayout>

      {/* Add patient modal */}
      <EditPatientInfoModal
        isOpen={showAddPatientModal}
        mode="create"
        patientId={null}
        title="Add Resident"
        facilityDisplayName={userFacilityName || null}
        recordNumber="Auto-generated"
        readOnly={false}
        onClose={() => setShowAddPatientModal(false)}
        onSave={handleCreatePatient}
        onSaved={(createdPatient) => {
          setPatients(prev => [createdPatient, ...prev])
          setSelectedPatientId(createdPatient.id)
        }}
      />

      {/* Edit patient modal */}
      <EditPatientInfoModal
        isOpen={Boolean(editingPatientId)}
        patientId={editingPatientId}
        facilityDisplayName={userFacilityName || null}
        recordNumber={patients.find(p => p.id === editingPatientId)?.record_number || ''}
        readOnly={false}
        onClose={() => setEditingPatientId(null)}
        onSave={handleSavePatientEdits}
        onSaved={(updatedPatient) => {
          setPatients(prev => prev.map(p => (p.id === updatedPatient.id ? { ...p, ...updatedPatient } : p)))
        }}
      />
    </ProtectedRoute>
  )
}
