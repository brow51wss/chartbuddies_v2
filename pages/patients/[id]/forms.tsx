import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth'
import type { Patient } from '../../../types/auth'
import type { MARForm, MARMedication } from '../../../types/mar'

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

  useEffect(() => {
    if (id) {
      loadPatientData(id as string)
    }
  }, [id])

  // Handle ESC key to close duplicate modal
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showDuplicateModal) {
        setShowDuplicateModal(false)
        setMedicationsToDuplicate([])
        setSourceFormId(null)
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [showDuplicateModal])

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

      // Load MAR forms for this patient
      const { data: formsData, error: formsError } = await supabase
        .from('mar_forms')
        .select('*')
        .eq('patient_id', patientId)
        .order('month_year', { ascending: false })

      if (formsError) throw formsError
      setMarForms(formsData || [])

      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const loadMedicationsForDuplicate = async (formId: string) => {
    try {
      const { data: medications, error } = await supabase
        .from('mar_medications')
        .select('*')
        .eq('mar_form_id', formId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Filter out vitals entries
      const filteredMeds = (medications || []).filter(med => {
        const isVitals = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
        return !isVitals
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

      setMedicationsToDuplicate(medsToDuplicate)
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
      <div className="min-h-screen">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <Link href="/dashboard" className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm mb-2 inline-block">
                  ← Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {patient?.patient_name || 'Patient Forms'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Record #: {patient?.record_number}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Available Forms
            </h2>

            {/* MAR Forms Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                  Medication Administration Record (MAR)
                </h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create and manage MAR forms for this patient
                  </p>
                  <Link
                    href={`/patients/${id}/mar`}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal text-sm font-medium"
                  >
                    + New MAR Form
                  </Link>
                </div>

                {marForms.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                    No MAR forms created yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {marForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">
                            MAR - {form.month_year}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Status: {form.status} • Created: {new Date(form.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              await loadMedicationsForDuplicate(form.id)
                              setSourceFormId(form.id)
                              setShowDuplicateModal(true)
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                          >
                            Duplicate
                          </button>
                          <Link
                            href={`/patients/${id}/mar/${form.id}`}
                            className="px-4 py-2 text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium"
                          >
                            {form.status === 'draft' ? 'Continue Editing' : 'View'}
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder for future forms */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Additional form types will be available here (custom forms, vital signs, etc.)
              </p>
            </div>
          </div>
        </main>
      </div>

      {/* Duplicate MAR Modal */}
      {showDuplicateModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
                      <tr key={med.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={med.medication_name}
                              onChange={(e) => updateMedicationInList(index, 'medication_name', e.target.value)}
                              placeholder="Medication Name"
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <input
                              type="text"
                              value={med.dosage}
                              onChange={(e) => updateMedicationInList(index, 'dosage', e.target.value)}
                              placeholder="Dosage"
                              className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
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
                            <input
                              type="text"
                              value={med.notes || ''}
                              onChange={(e) => updateMedicationInList(index, 'notes', e.target.value || null)}
                              placeholder="Notes (optional)"
                              className="w-full text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <input
                              type="text"
                              value={med.parameter || ''}
                              onChange={(e) => updateMedicationInList(index, 'parameter', e.target.value || null)}
                              placeholder="Parameter (optional)"
                              className="w-full text-xs px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                          </div>
                        </td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
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
                        <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                          <div className="space-y-1">
                            {med.hours.map((hour, hourIndex) => (
                              <div key={hourIndex} className="flex gap-1 items-center">
                                <input
                                  type="text"
                                  value={hour}
                                  onChange={(e) => updateHourInGroup(index, hourIndex, e.target.value)}
                                  placeholder="e.g., 09:00"
                                  className="flex-1 text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                {med.hours.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeHourFromGroup(index, hourIndex)}
                                    className="text-red-600 hover:text-red-800 dark:text-red-400 text-xs px-1"
                                    title="Remove hour"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addHourToGroup(index)}
                              className="text-xs text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue px-1"
                            >
                              + Add Hour
                            </button>
                          </div>
                        </td>
                        <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 ${med.isGrouped || (med.hours.length > 1) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                          <input
                            type="text"
                            value={med.route || ''}
                            onChange={(e) => updateMedicationInList(index, 'route', e.target.value || null)}
                            placeholder="e.g., PO, IV"
                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
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

