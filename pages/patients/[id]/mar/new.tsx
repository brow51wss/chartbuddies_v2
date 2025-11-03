import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile } from '../../../../lib/auth'
import type { Patient } from '../../../../types/auth'
import type { MARMedication, MARAdministration, MARPRNRecord, MARVitalSigns } from '../../../../types/mar'

export default function NewMARForm() {
  const router = useRouter()
  const { id: patientId } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  // Form state
  const [patientInfo, setPatientInfo] = useState({
    monthYear: '',
    diagnosis: '',
    diet: '',
    allergies: '',
    physicianName: '',
    physicianPhone: '',
    facilityName: ''
  })
  const [medications, setMedications] = useState<Array<{
    medicationName: string
    dosage: string
    startDate: string
    stopDate: string
    hour: string
    notes: string
    administrations: { [day: number]: { status: string; initials: string; notes: string } }
  }>>([])
  const [prnRecords, setPrnRecords] = useState<Array<{
    date: string
    hour: string
    initials: string
    medication: string
    reason: string
    result: string
    staffSignature: string
  }>>([])
  const [vitalSigns, setVitalSigns] = useState<{ [day: number]: {
    temperature: string
    pulse: string
    respiration: string
    weight: string
  } }>({})

  useEffect(() => {
    if (patientId) {
      loadData()
    }
  }, [patientId])

  const loadData = async () => {
    try {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (patientError) throw patientError
      setPatient(patientData)

      // Pre-fill patient info
      setPatientInfo({
        monthYear: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        diagnosis: patientData.diagnosis || '',
        diet: patientData.diet || '',
        allergies: patientData.allergies || '',
        physicianName: patientData.physician_name || '',
        physicianPhone: patientData.physician_phone || '',
        facilityName: patientData.facility_name || ''
      })

      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const addMedication = () => {
    setMedications([...medications, {
      medicationName: '',
      dosage: '',
      startDate: '',
      stopDate: '',
      hour: '',
      notes: '',
      administrations: {}
    }])
  }

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index))
  }

  const updateMedication = (index: number, field: string, value: string) => {
    const updated = [...medications]
    updated[index] = { ...updated[index], [field]: value }
    setMedications(updated)
  }

  const updateAdministration = (medIndex: number, day: number, field: string, value: string) => {
    const updated = [...medications]
    if (!updated[medIndex].administrations[day]) {
      updated[medIndex].administrations[day] = { status: 'Not Given', initials: '', notes: '' }
    }
    updated[medIndex].administrations[day] = {
      ...updated[medIndex].administrations[day],
      [field]: value
    }
    setMedications(updated)
  }

  const addPRNRecord = () => {
    setPrnRecords([...prnRecords, {
      date: '',
      hour: '',
      initials: userProfile?.staff_initials || '',
      medication: '',
      reason: '',
      result: '',
      staffSignature: userProfile?.staff_signature || userProfile?.full_name || ''
    }])
  }

  const removePRNRecord = (index: number) => {
    setPrnRecords(prnRecords.filter((_, i) => i !== index))
  }

  const updatePRNRecord = (index: number, field: string, value: string) => {
    const updated = [...prnRecords]
    updated[index] = { ...updated[index], [field]: value }
    setPrnRecords(updated)
  }

  const updateVitalSigns = (day: number, field: string, value: string) => {
    setVitalSigns({
      ...vitalSigns,
      [day]: {
        ...vitalSigns[day],
        [field]: value
      }
    })
  }

  const handleSave = async (status: 'draft' | 'submitted') => {
    if (!patient || !userProfile) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      // Create MAR form
      const { data: marForm, error: formError } = await supabase
        .from('mar_forms')
        .insert({
          patient_id: patient.id,
          hospital_id: patient.hospital_id,
          month_year: patientInfo.monthYear,
          created_by: userProfile.id,
          status: status,
          patient_name: patient.patient_name,
          record_number: patient.record_number,
          date_of_birth: patient.date_of_birth,
          sex: patient.sex,
          diagnosis: patientInfo.diagnosis,
          diet: patientInfo.diet,
          allergies: patientInfo.allergies,
          physician_name: patientInfo.physicianName,
          physician_phone: patientInfo.physicianPhone,
          facility_name: patientInfo.facilityName
        })
        .select()
        .single()

      if (formError) throw formError

      // Save medications and administrations
      for (const med of medications) {
        if (!med.medicationName || !med.dosage || !med.startDate || !med.hour) continue

        const { data: medication, error: medError } = await supabase
          .from('mar_medications')
          .insert({
            mar_form_id: marForm.id,
            medication_name: med.medicationName,
            dosage: med.dosage,
            start_date: med.startDate,
            stop_date: med.stopDate || null,
            hour: med.hour,
            notes: med.notes || null
          })
          .select()
          .single()

        if (medError) throw medError

        // Save administrations for each day
        for (const day in med.administrations) {
          const admin = med.administrations[day]
          if (admin.status) {
            await supabase
              .from('mar_administrations')
              .insert({
                mar_medication_id: medication.id,
                day_number: parseInt(day),
                status: admin.status,
                initials: admin.initials || null,
                notes: admin.notes || null,
                administered_at: admin.status === 'Given' ? new Date().toISOString() : null
              })
          }
        }
      }

      // Save PRN records
      for (let i = 0; i < prnRecords.length; i++) {
        const prn = prnRecords[i]
        if (!prn.date || !prn.medication || !prn.reason) continue

        await supabase
          .from('mar_prn_records')
          .insert({
            mar_form_id: marForm.id,
            date: prn.date,
            hour: prn.hour,
            initials: prn.initials,
            medication: prn.medication,
            reason: prn.reason,
            result: prn.result || null,
            staff_signature: prn.staffSignature,
            entry_number: i + 1
          })
      }

      // Save vital signs
      for (const day in vitalSigns) {
        const vs = vitalSigns[day]
        if (vs.temperature || vs.pulse || vs.respiration || vs.weight) {
          await supabase
            .from('mar_vital_signs')
            .insert({
              mar_form_id: marForm.id,
              day_number: parseInt(day),
              temperature: vs.temperature ? parseFloat(vs.temperature) : null,
              pulse: vs.pulse ? parseInt(vs.pulse) : null,
              respiration: vs.respiration ? parseInt(vs.respiration) : null,
              weight: vs.weight ? parseFloat(vs.weight) : null
            })
        }
      }

      setMessage(`MAR form ${status === 'draft' ? 'saved as draft' : 'submitted'} successfully!`)
      setTimeout(() => {
        router.push(`/patients/${patientId}/mar/${marForm.id}`)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to save MAR form')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!patient) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <p className="text-red-600">Patient not found</p>
        </div>
      </ProtectedRoute>
    )
  }

  const daysInMonth = 31 // Assuming full month view
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <ProtectedRoute>
      <Head>
        <title>New MAR Form - Chartbuddies</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => router.back()}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-4"
            >
              ← Back
            </button>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              New Medication Administration Record (MAR)
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Patient: {patient.patient_name} • Record #: {patient.record_number}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
              <p className="text-green-800 dark:text-green-200">{message}</p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-8">
            {/* Patient Information Section */}
            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                Patient Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Patient Name
                  </label>
                  <input
                    type="text"
                    value={patient.patient_name}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-700 dark:text-white cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Record Number
                  </label>
                  <input
                    type="text"
                    value={patient.record_number}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-700 dark:text-white cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date of Birth
                  </label>
                  <input
                    type="text"
                    value={new Date(patient.date_of_birth).toLocaleDateString()}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-700 dark:text-white cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sex
                  </label>
                  <input
                    type="text"
                    value={patient.sex}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 dark:bg-gray-700 dark:text-white cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Month/Year *
                  </label>
                  <input
                    type="month"
                    value={patientInfo.monthYear ? new Date(`${patientInfo.monthYear} 1`).toISOString().slice(0, 7) : ''}
                    onChange={(e) => {
                      const date = new Date(e.target.value + '-01')
                      setPatientInfo({
                        ...patientInfo,
                        monthYear: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                      })
                    }}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Diagnosis *
                  </label>
                  <input
                    type="text"
                    value={patientInfo.diagnosis}
                    onChange={(e) => setPatientInfo({ ...patientInfo, diagnosis: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Diet
                  </label>
                  <input
                    type="text"
                    value={patientInfo.diet}
                    onChange={(e) => setPatientInfo({ ...patientInfo, diet: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Allergies *
                  </label>
                  <input
                    type="text"
                    value={patientInfo.allergies}
                    onChange={(e) => setPatientInfo({ ...patientInfo, allergies: e.target.value })}
                    required
                    placeholder="None (if no allergies)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Physician Name *
                  </label>
                  <input
                    type="text"
                    value={patientInfo.physicianName}
                    onChange={(e) => setPatientInfo({ ...patientInfo, physicianName: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Physician Phone *
                  </label>
                  <input
                    type="tel"
                    value={patientInfo.physicianPhone}
                    onChange={(e) => setPatientInfo({ ...patientInfo, physicianPhone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Facility Name *
                  </label>
                  <input
                    type="text"
                    value={patientInfo.facilityName}
                    onChange={(e) => setPatientInfo({ ...patientInfo, facilityName: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </section>

            {/* Medications Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Medications
                </h2>
                <button
                  type="button"
                  onClick={addMedication}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  + Add Medication
                </button>
              </div>

              {medications.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  Click "Add Medication" to start adding medications
                </p>
              ) : (
                <div className="space-y-6">
                  {medications.map((med, medIndex) => (
                    <div key={medIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                          Medication #{medIndex + 1}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removeMedication(medIndex)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Medication Name *
                          </label>
                          <input
                            type="text"
                            value={med.medicationName}
                            onChange={(e) => updateMedication(medIndex, 'medicationName', e.target.value)}
                            required
                            placeholder="e.g., Lisinopril 10 mg"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Dosage *
                          </label>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) => updateMedication(medIndex, 'dosage', e.target.value)}
                            required
                            placeholder="e.g., 10 mg PO daily"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Start Date *
                          </label>
                          <input
                            type="date"
                            value={med.startDate}
                            onChange={(e) => updateMedication(medIndex, 'startDate', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Stop Date
                          </label>
                          <input
                            type="date"
                            value={med.stopDate}
                            onChange={(e) => updateMedication(medIndex, 'stopDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Administration Time *
                          </label>
                          <input
                            type="time"
                            value={med.hour}
                            onChange={(e) => updateMedication(medIndex, 'hour', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={med.notes}
                            onChange={(e) => updateMedication(medIndex, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Daily Administration Grid */}
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Daily Administration Record (Days 1-31)
                        </label>
                        <div className="overflow-x-auto">
                          <div className="inline-block min-w-full border border-gray-200 dark:border-gray-700 rounded-md">
                            <div className="grid grid-cols-31 gap-px bg-gray-200 dark:bg-gray-700" style={{ gridTemplateColumns: 'repeat(31, minmax(60px, 1fr))' }}>
                              {days.map(day => (
                                <div key={day} className="bg-white dark:bg-gray-800 p-1">
                                  <div className="text-xs text-center text-gray-600 dark:text-gray-400 mb-1">{day}</div>
                                  <select
                                    value={med.administrations[day]?.status || 'Not Given'}
                                    onChange={(e) => updateAdministration(medIndex, day, 'status', e.target.value)}
                                    className="w-full text-xs px-1 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  >
                                    <option value="Not Given">NG</option>
                                    <option value="Given">G</option>
                                    <option value="PRN">PRN</option>
                                  </select>
                                  {med.administrations[day]?.status === 'Given' && (
                                    <input
                                      type="text"
                                      placeholder="Initials"
                                      value={med.administrations[day]?.initials || ''}
                                      onChange={(e) => updateAdministration(medIndex, day, 'initials', e.target.value)}
                                      maxLength={3}
                                      className="w-full text-xs px-1 py-0.5 mt-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          G = Given, NG = Not Given, PRN = As Needed
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* PRN Records Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  PRN and Medications Not Administered
                </h2>
                <button
                  type="button"
                  onClick={addPRNRecord}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
                >
                  + Add PRN Record
                </button>
              </div>

              {prnRecords.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  Add PRN records as needed
                </p>
              ) : (
                <div className="space-y-4">
                  {prnRecords.map((prn, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-md font-medium text-gray-800 dark:text-white">
                          Entry #{index + 1}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removePRNRecord(index)}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Date *
                          </label>
                          <input
                            type="date"
                            value={prn.date}
                            onChange={(e) => updatePRNRecord(index, 'date', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Time *
                          </label>
                          <input
                            type="time"
                            value={prn.hour}
                            onChange={(e) => updatePRNRecord(index, 'hour', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Initials *
                          </label>
                          <input
                            type="text"
                            value={prn.initials}
                            onChange={(e) => updatePRNRecord(index, 'initials', e.target.value)}
                            required
                            maxLength={10}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Medication *
                          </label>
                          <input
                            type="text"
                            value={prn.medication}
                            onChange={(e) => updatePRNRecord(index, 'medication', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Reason *
                          </label>
                          <textarea
                            value={prn.reason}
                            onChange={(e) => updatePRNRecord(index, 'reason', e.target.value)}
                            required
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Result
                          </label>
                          <textarea
                            value={prn.result}
                            onChange={(e) => updatePRNRecord(index, 'result', e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Staff Signature *
                          </label>
                          <input
                            type="text"
                            value={prn.staffSignature}
                            onChange={(e) => updatePRNRecord(index, 'staffSignature', e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Vital Signs Section */}
            <section>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
                Vital Signs (Optional)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 dark:border-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Day</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Temperature (°F)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Pulse (bpm)</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Respiration</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Weight (lbs)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {days.slice(0, 7).map(day => (
                      <tr key={day} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">{day}</td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={vitalSigns[day]?.temperature || ''}
                            onChange={(e) => updateVitalSigns(day, 'temperature', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={vitalSigns[day]?.pulse || ''}
                            onChange={(e) => updateVitalSigns(day, 'pulse', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={vitalSigns[day]?.respiration || ''}
                            onChange={(e) => updateVitalSigns(day, 'respiration', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            step="0.1"
                            value={vitalSigns[day]?.weight || ''}
                            onChange={(e) => updateVitalSigns(day, 'weight', e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Showing first 7 days. More days available after form creation.
                </p>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={saving}
                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSave('draft')}
                disabled={saving}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={() => handleSave('submitted')}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

