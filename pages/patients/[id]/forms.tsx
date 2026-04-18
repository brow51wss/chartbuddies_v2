import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import AppHeader from '../../../components/AppHeader'
import TimeInput from '../../../components/TimeInput'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth'
import { useReadOnly } from '../../../contexts/ReadOnlyContext'
import { ensureProgressNoteSummaryForMonth } from '../../../lib/progress-notes'
import type { Patient } from '../../../types/auth'
import type { MARForm, MARMedication } from '../../../types/mar'

/** YYYY-MM for calendar month comparison (matches list/sort logic). */
function marFormCalendarKey(monthYear: string, ref: Date): string {
  const raw = String(monthYear || '').trim().replace(/\//g, '-')
  const parts = raw.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
  let y = parts[0],
    m = parts[1]
  if (parts.length >= 2 && m > 12) [y, m] = [m, y]
  if (y && m) return `${y}-${String(m).padStart(2, '0')}`
  const months: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  }
  const lower = raw.toLowerCase()
  for (const [name, num] of Object.entries(months)) {
    if (lower.includes(name)) {
      const match = raw.match(/\b(19|20)\d{2}\b/)
      const year = match ? parseInt(match[0], 10) : ref.getFullYear()
      return `${year}-${String(num).padStart(2, '0')}`
    }
  }
  return ''
}

export default function PatientForms() {
  const router = useRouter()
  const { id } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [marForms, setMarForms] = useState<MARForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [sourceFormId, setSourceFormId] = useState<string | null>(null)
  const [medicationsToDuplicate, setMedicationsToDuplicate] = useState<Array<{
    id: string
    medication_name: string
    dosage: string
    start_date: string
    stop_date: string | null
    hours: string[] // Array of hours for grouped medications
    route: string | null
    notes: string | null
    parameter: string | null
    frequency: number | null
    frequency_display: string | null
    isVitals: boolean
    isGrouped: boolean // Whether this represents a grouped medication
  }>>([])
  const [saving, setSaving] = useState(false)
  const [deleteConfirmForm, setDeleteConfirmForm] = useState<{ id: string; month_year: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { isReadOnly } = useReadOnly()

  useEffect(() => {
    if (id) {
      loadPatientData(id as string)
    }
  }, [id])

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmForm) setDeleteConfirmForm(null)
        else if (showDuplicateModal) {
          setShowDuplicateModal(false)
          setMedicationsToDuplicate([])
          setSourceFormId(null)
        }
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [showDuplicateModal, deleteConfirmForm])

  const loadPatientData = async (patientId: string) => {
    try {
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (patientError) throw patientError
      setPatient(patientData)

      // Load MAR forms for this patient (sort with most current on top: descending by month/year then created_at)
      const { data: formsData, error: formsError } = await supabase
        .from('mar_forms')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })

      if (formsError) throw formsError
      const sorted = (formsData || []).slice().sort((a, b) => {
        const key = (my: string) => {
          const raw = String(my || '').trim().replace(/\//g, '-')
          const parts = raw.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
          let y = parts[0], m = parts[1]
          if (parts.length >= 2 && m > 12) [y, m] = [m, y]
          if (y && m) return (y * 12 + m) * 1e6
          const months: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }
          const lower = raw.toLowerCase()
          for (const [name, num] of Object.entries(months)) {
            if (lower.includes(name)) {
              const match = raw.match(/\b(19|20)\d{2}\b/)
              const year = match ? parseInt(match[0], 10) : new Date().getFullYear()
              return (year * 12 + num) * 1e6
            }
          }
          return 0
        }
        const ka = key(a.month_year)
        const kb = key(b.month_year)
        if (ka !== kb) return kb - ka
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      setMarForms(sorted)

      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const listNow = new Date()
  const listCurrentKey = `${listNow.getFullYear()}-${String(listNow.getMonth() + 1).padStart(2, '0')}`
  const currentMonthHeading = listNow.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const currentMarForms = marForms.filter((f) => marFormCalendarKey(f.month_year, listNow) === listCurrentKey)
  const pastMarForms = marForms.filter((f) => marFormCalendarKey(f.month_year, listNow) !== listCurrentKey)

  const loadMedicationsForDuplicate = async (formId: string) => {
    try {
      const { data: medications, error } = await supabase
        .from('mar_medications')
        .select('*')
        .eq('mar_form_id', formId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Separate medications and vitals
      const filteredMeds = (medications || []).filter(med => {
        const isVitals = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
        return !isVitals
      })

      const vitalsEntries = (medications || []).filter(med => {
        const isVitals = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
        return isVitals
      })

      // Group medications by medication_name, dosage, start_date, stop_date, route, notes, parameter, frequency, frequency_display
      const groupedMeds: { [key: string]: typeof filteredMeds } = {}
      
      filteredMeds.forEach(med => {
        const groupKey = `${med.medication_name}|${med.dosage}|${med.start_date}|${med.stop_date || ''}|${med.route || ''}|${med.notes || ''}|${med.parameter || ''}|${med.frequency || 1}|${med.frequency_display || ''}`
        
        if (!groupedMeds[groupKey]) {
          groupedMeds[groupKey] = []
        }
        groupedMeds[groupKey].push(med)
      })

      // Convert grouped medications to display format
      const medsToDuplicate = Object.values(groupedMeds).map(group => {
        const firstMed = group[0]
        const hours = group.map(m => m.hour).sort()
        const isGrouped = group.length > 1

        return {
          id: firstMed.id, // Use first medication's ID as the group identifier
          medication_name: firstMed.medication_name,
          dosage: firstMed.dosage,
          start_date: firstMed.start_date,
          stop_date: firstMed.stop_date,
          hours: hours,
          route: firstMed.route,
          notes: firstMed.notes,
          parameter: firstMed.parameter,
          frequency: firstMed.frequency,
          frequency_display: firstMed.frequency_display,
          isVitals: false,
          isGrouped: isGrouped
        }
      })

      // Add vitals entries (they don't need grouping)
      const vitalsToDuplicate = vitalsEntries.map(vital => ({
        id: vital.id,
        medication_name: vital.medication_name,
        dosage: vital.dosage, // This contains the vital sign instructions
        start_date: vital.start_date,
        stop_date: vital.stop_date,
        hours: [vital.hour], // Single hour for vitals
        route: vital.route,
        notes: vital.notes, // 'Vital Signs Entry'
        parameter: vital.parameter,
        frequency: vital.frequency || 1,
        frequency_display: vital.frequency_display,
        isVitals: true,
        isGrouped: false
      }))

      // Combine medications and vitals - vitals first
      setMedicationsToDuplicate([...vitalsToDuplicate, ...medsToDuplicate])
    } catch (err: any) {
      console.error('Error loading medications:', err)
      alert('Failed to load medications: ' + err.message)
    }
  }

  const updateMedicationInList = (index: number, field: string, value: string | number | string[] | null) => {
    const updated = [...medicationsToDuplicate]
    updated[index] = { ...updated[index], [field]: value }
    setMedicationsToDuplicate(updated)
  }

  const updateHourInGroup = (index: number, hourIndex: number, value: string) => {
    const updated = [...medicationsToDuplicate]
    const newHours = [...updated[index].hours]
    newHours[hourIndex] = value
    updated[index] = { ...updated[index], hours: newHours }
    setMedicationsToDuplicate(updated)
  }

  const addHourToGroup = (index: number) => {
    const updated = [...medicationsToDuplicate]
    const newHours = [...updated[index].hours, '']
    updated[index] = { ...updated[index], hours: newHours }
    setMedicationsToDuplicate(updated)
  }

  const removeHourFromGroup = (index: number, hourIndex: number) => {
    const updated = [...medicationsToDuplicate]
    const newHours = updated[index].hours.filter((_, i) => i !== hourIndex)
    updated[index] = { ...updated[index], hours: newHours }
    setMedicationsToDuplicate(updated)
  }

  const removeMedicationFromList = (index: number) => {
    setMedicationsToDuplicate(medicationsToDuplicate.filter((_, i) => i !== index))
  }

  const handleDeleteMAR = async () => {
    if (!deleteConfirmForm || !id) return
    setDeleting(true)
    setError('')
    try {
      const { error: deleteError } = await supabase
        .from('mar_forms')
        .delete()
        .eq('id', deleteConfirmForm.id)
      if (deleteError) throw deleteError
      setMarForms(prev => prev.filter(f => f.id !== deleteConfirmForm.id))
      setDeleteConfirmForm(null)
    } catch (err: any) {
      setError(err.message || 'Failed to delete MAR form')
    } finally {
      setDeleting(false)
    }
  }

  const createDuplicateMAR = async () => {
    if (!patient || !id || !sourceFormId) return

    setSaving(true)
    setError('')

    try {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        setError('User profile not found')
        setSaving(false)
        return
      }

      // Get current month/year
      const now = new Date()
      const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      // Hard rule: never allow two MARs for the same patient and same month/year
      const { data: existingForMonth } = await supabase
        .from('mar_forms')
        .select('id')
        .eq('patient_id', patient.id)
        .eq('month_year', monthYear)
        .limit(1)
      if (existingForMonth && existingForMonth.length > 0) {
        setError(`A MAR for ${monthYear} already exists. Only one MAR per month and year is allowed.`)
        setSaving(false)
        return
      }

      // Get hospital name for facility name
      let facilityName = 'N/A'
      if (profile.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        
        if (hospital) {
          facilityName = hospital.name
        }
      }

      // Load source MAR form to get patient info
      const { data: sourceForm, error: sourceError } = await supabase
        .from('mar_forms')
        .select('*')
        .eq('id', sourceFormId)
        .single()

      if (sourceError) throw sourceError

      // Create new MAR form
      const { data: newForm, error: createError } = await supabase
        .from('mar_forms')
        .insert({
          patient_id: patient.id,
          hospital_id: patient.hospital_id || profile.hospital_id || '',
          month_year: monthYear,
          patient_name: patient.patient_name,
          record_number: patient.record_number,
          date_of_birth: patient.date_of_birth,
          sex: patient.sex,
          diagnosis: sourceForm.diagnosis || patient.diagnosis || null,
          diet: sourceForm.diet || patient.diet || null,
          allergies: sourceForm.allergies || patient.allergies || 'None',
          physician_name: sourceForm.physician_name || patient.physician_name || 'TBD',
          physician_phone: sourceForm.physician_phone || patient.physician_phone || null,
          facility_name: facilityName,
          status: 'active',
          created_by: profile.id
        })
        .select()
        .single()

      if (createError) throw createError

      await ensureProgressNoteSummaryForMonth(supabase, patient.id, monthYear, profile.id)

      // Create medications from the duplicate list
      if (medicationsToDuplicate.length > 0) {
        const medicationsToInsert: any[] = []
        
        medicationsToDuplicate.forEach(med => {
          // Create one medication entry for each hour
          med.hours.forEach(hour => {
            medicationsToInsert.push({
              mar_form_id: newForm.id,
              medication_name: med.medication_name,
              dosage: med.dosage,
              start_date: med.start_date,
              stop_date: med.stop_date,
              hour: hour,
              route: med.route,
              notes: med.notes,
              parameter: med.parameter,
              frequency: med.frequency || med.hours.length,
              frequency_display: med.frequency_display
            })
          })
        })

        const { error: medError } = await supabase
          .from('mar_medications')
          .insert(medicationsToInsert)

        if (medError) throw medError
      }

      // Close modal and redirect to new MAR form
      setShowDuplicateModal(false)
      setMedicationsToDuplicate([])
      setSourceFormId(null)
      router.push(`/patients/${id}/mar/${newForm.id}`)
    } catch (err: any) {
      console.error('Error creating duplicate MAR:', err)
      setError(err.message || 'Failed to create duplicate MAR form')
    } finally {
      setSaving(false)
    }
  }

  const renderMarFormRow = (form: MARForm) => {
    const formKey = marFormCalendarKey(form.month_year, listNow)
    const isCurrentMonthYear = !!formKey && formKey === listCurrentKey
    return (
      <div
        key={form.id}
        className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
      >
        <div>
          <p className="font-medium text-gray-800 dark:text-white">{form.month_year}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Status: {form.status} • Created: {new Date(form.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link
            href={`/patients/${id}/mar/${form.id}`}
            className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue"
          >
            {form.status === 'draft' ? 'Continue Editing' : 'View'}
          </Link>
          {!isReadOnly && (
            <button
              onClick={async () => {
                if (isCurrentMonthYear) return
                await loadMedicationsForDuplicate(form.id)
                setSourceFormId(form.id)
                setShowDuplicateModal(true)
              }}
              disabled={!!isCurrentMonthYear}
              title={
                isCurrentMonthYear
                  ? 'Duplicate is not allowed for the current month; a MAR for this month already exists.'
                  : 'Duplicate this MAR'
              }
              className="inline-flex items-center justify-center p-2 text-lasso-teal hover:text-lasso-blue dark:text-lasso-teal dark:hover:text-lasso-blue transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:disabled:hover:bg-transparent"
              aria-label="Duplicate MAR"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
          {!isReadOnly && (
            <button
              onClick={() => setDeleteConfirmForm({ id: form.id, month_year: form.month_year })}
              className="inline-flex items-center justify-center p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
              title="Delete MAR"
              aria-label="Delete MAR"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    )
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
        <title>Patient Forms - Lasso</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader
          patientId={typeof id === 'string' ? id : Array.isArray(id) ? id[0] : undefined}
          patientName={patient?.patient_name}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href={typeof id === 'string' ? `/patients/${id}` : Array.isArray(id) && id[0] ? `/patients/${id[0]}` : '/dashboard'} className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-2">
            ← Back to Patient's Binder
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 mb-2">
            {patient?.patient_name || 'Patient Forms'}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Record #: {patient?.record_number}
          </p>
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <span aria-hidden="true">💊</span>
                  <span>Available MAR Forms</span>
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Create and manage MAR forms for this patient
                </p>
              </div>
              {!isReadOnly && (
                <Link
                  href={`/patients/${id}/mar`}
                  className="shrink-0 px-4 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal text-sm font-medium text-center"
                >
                  + New MAR Form
                </Link>
              )}
            </div>

            {marForms.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6">
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">No MAR forms created yet</p>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Current month ({currentMonthHeading})
                    </h3>
                    {currentMarForms.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 italic">No MAR for this month yet.</p>
                    ) : (
                      <div className="space-y-2">{currentMarForms.map(renderMarFormRow)}</div>
                    )}
                  </div>
                </div>
                {pastMarForms.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Past months</h3>
                      <div className="space-y-2">{pastMarForms.map(renderMarFormRow)}</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Delete MAR confirmation modal */}
      {deleteConfirmForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              Delete MAR Form
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete <strong>{deleteConfirmForm.month_year}</strong>? This will permanently remove the form and all its medications, administrations, and notes. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirmForm(null)}
                disabled={deleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMAR}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate MAR Modal */}
      {showDuplicateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                Duplicate MAR Form - Review Medications
              </h2>
              <button
                onClick={() => {
                  setShowDuplicateModal(false)
                  setMedicationsToDuplicate([])
                  setSourceFormId(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Review and edit the medications below. You can modify or remove any medication before creating the new MAR form.
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              </div>
            )}

            {medicationsToDuplicate.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm italic py-4">
                No medications found in the source MAR form.
              </p>
            ) : (
              <div className="overflow-x-auto mb-4">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                        Medication
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                        Start/Stop Date
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                        Hour
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                        Route
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicationsToDuplicate.map((med, index) => (
                      <tr key={med.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${med.isVitals ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${med.isVitals ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={med.medication_name}
                              onChange={(e) => updateMedicationInList(index, 'medication_name', e.target.value)}
                              placeholder={med.isVitals ? "VITALS" : "Medication Name"}
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              disabled={med.isVitals} // VITALS name should not be changed
                            />
                            <input
                              type="text"
                              value={med.dosage}
                              onChange={(e) => updateMedicationInList(index, 'dosage', e.target.value)}
                              placeholder={med.isVitals ? "Vital Signs Instructions" : "Dosage"}
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            {!med.isVitals && (
                              <div className="flex gap-1">
                                <select
                                  value={med.frequency || med.hours.length}
                                  onChange={(e) => {
                                    const freq = parseInt(e.target.value, 10)
                                    const currentHours = med.hours.length
                                    
                                    // Adjust hours array to match frequency
                                    let newHours = [...med.hours]
                                    if (freq > currentHours) {
                                      // Add empty hours
                                      for (let i = currentHours; i < freq; i++) {
                                        newHours.push('')
                                      }
                                    } else if (freq < currentHours) {
                                      // Remove excess hours
                                      newHours = newHours.slice(0, freq)
                                    }
                                    
                                    // Auto-populate frequency_display if empty
                                    const defaultDisplay = `${freq} time${freq > 1 ? 's' : ''} per day`
                                    
                                    updateMedicationInList(index, 'frequency', freq)
                                    updateMedicationInList(index, 'hours', newHours)
                                    if (!med.frequency_display) {
                                      updateMedicationInList(index, 'frequency_display', defaultDisplay)
                                    }
                                  }}
                                  className="w-20 text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                    <option key={num} value={num}>{num}</option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  value={med.frequency_display || ''}
                                  onChange={(e) => updateMedicationInList(index, 'frequency_display', e.target.value || null)}
                                  placeholder="Frequency display (e.g., 3 times per day)"
                                  className="flex-1 text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                              </div>
                            )}
                            {!med.isVitals && (
                              <input
                                type="text"
                                value={med.notes || ''}
                                onChange={(e) => updateMedicationInList(index, 'notes', e.target.value || null)}
                                placeholder="Notes (optional)"
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            )}
                            {!med.isVitals && (
                              <input
                                type="text"
                                value={med.parameter || ''}
                                onChange={(e) => updateMedicationInList(index, 'parameter', e.target.value || null)}
                                placeholder="Parameter (optional)"
                                className="w-full text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            )}
                          </div>
                        </td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${med.isVitals ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          <div className="space-y-1">
                            <input
                              type="date"
                              value={med.start_date}
                              onChange={(e) => updateMedicationInList(index, 'start_date', e.target.value)}
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <input
                              type="date"
                              value={med.stop_date || ''}
                              onChange={(e) => updateMedicationInList(index, 'stop_date', e.target.value || null)}
                              placeholder="Stop date (optional)"
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          </div>
                        </td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${med.isVitals ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          <div className="space-y-2">
                            {med.hours.map((hour, hourIndex) => (
                              <div key={hourIndex} className="flex gap-1 items-center">
                                <TimeInput
                                  value={hour}
                                  onChange={(newTime) => updateHourInGroup(index, hourIndex, newTime)}
                                  compact
                                  plain
                                />
                                {med.hours.length > 1 && !med.isVitals && (
                                  <button
                                    type="button"
                                    onClick={() => removeHourFromGroup(index, hourIndex)}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 text-xs px-1"
                                    title="Remove time"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            {!med.isVitals && (
                              <button
                                type="button"
                                onClick={() => addHourToGroup(index)}
                                className="text-xs text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue px-1"
                              >
                                + Add Time
                              </button>
                            )}
                          </div>
                        </td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${med.isVitals ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                          {med.isVitals ? (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">—</span>
                          ) : (
                            <input
                              type="text"
                              value={med.route || ''}
                              onChange={(e) => updateMedicationInList(index, 'route', e.target.value || null)}
                              placeholder="e.g., PO, IV"
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          )}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center">
                          <button
                            onClick={() => removeMedicationFromList(index)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-300 dark:border-gray-600">
              <button
                onClick={() => {
                  setShowDuplicateModal(false)
                  setMedicationsToDuplicate([])
                  setSourceFormId(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={createDuplicateMAR}
                disabled={saving || medicationsToDuplicate.length === 0}
                className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Creating...' : 'Create New MAR Form'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

