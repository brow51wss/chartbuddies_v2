import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

interface AdmissionData {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  dob: string
  age: number
  sex: string | null
  date_of_admission: string
}

interface MarRecord {
  id: string
  admission_id: string
  month_year: string
  facility_name: string | null
  patient_name: string | null
  date_of_birth: string | null
  sex: string | null
  allergies: string | null
  diagnosis: string | null
  diet_instructions: string | null
  physician_name: string | null
  physician_phone: string | null
  record_number: string | null
  comments: string | null
}

interface Medication {
  id: string
  mar_record_id: string
  medication_name: string
  start_date: string
  stop_date: string | null
  hour: string | null
}

interface Administration {
  id: string
  medication_id: string
  day_of_month: number
  initials: string | null
  given: boolean
  reason_for_omission: string | null
}

interface VitalSign {
  id: string
  mar_record_id: string
  vital_type: string
  day_of_month: number
  value: string | null
}

interface PRNRecord {
  id: string
  mar_record_id: string
  date: string
  hour: string | null
  initials: string | null
  medication: string
  reason: string
  result: string | null
  staff_signature: string | null
}

export default function MAR() {
  const router = useRouter()
  const { admission_id } = router.query
  const [activeTab, setActiveTab] = useState<'medications' | 'vitals' | 'prn'>('medications')
  const [admissionData, setAdmissionData] = useState<AdmissionData | null>(null)
  const [marRecord, setMarRecord] = useState<MarRecord | null>(null)
  const [medications, setMedications] = useState<Medication[]>([])
  const [administrations, setAdministrations] = useState<Administration[]>([])
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([])
  const [prnRecords, setPrnRecords] = useState<PRNRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [monthYear, setMonthYear] = useState<string>('')
  const [currentMonthYear, setCurrentMonthYear] = useState<string>('')
  const [editingRecord, setEditingRecord] = useState(false)
  const [showInitialsModal, setShowInitialsModal] = useState(false)
  const [pendingAdmin, setPendingAdmin] = useState<{ adminId?: string; medicationId: string; day: number; currentAdmin?: Administration } | null>(null)
  const [initialsInput, setInitialsInput] = useState('')

  // Initialize month/year on mount
  useEffect(() => {
    const now = new Date()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yyyy = now.getFullYear()
    const initialMonthYear = `${mm}/${yyyy}`
    setMonthYear(initialMonthYear)
    setCurrentMonthYear(initialMonthYear)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      if (!admission_id || typeof admission_id !== 'string') {
        setLoading(false)
        return
      }

      try {
        // Fetch admission data
        const { data: admission, error: admissionError } = await supabase
          .from('admissions')
          .select('*')
          .eq('id', admission_id)
          .single()

        if (admissionError) throw admissionError
        setAdmissionData(admission)

        // Fetch or create MAR record
        const searchMonthYear = monthYear || currentMonthYear

        const { data: existingMar, error: marError } = await supabase
          .from('mar_records')
          .select('*')
          .eq('admission_id', admission_id)
          .eq('month_year', searchMonthYear)
          .single()

        if (marError && marError.code !== 'PGRST116') {
          console.error('Error fetching MAR record:', marError)
        }

        if (existingMar) {
          setMarRecord(existingMar)
          
          // Fetch medications
          const { data: meds, error: medsError } = await supabase
            .from('mar_medications')
            .select('*')
            .eq('mar_record_id', existingMar.id)
            .order('created_at', { ascending: true })

          if (!medsError && meds) {
            setMedications(meds)

            // Fetch administrations for all medications
            if (meds.length > 0) {
              const { data: adminData, error: adminError } = await supabase
                .from('mar_administration')
                .select('*')
                .eq('mar_record_id', existingMar.id)

              if (!adminError && adminData) {
                setAdministrations(adminData)
              }
            }
          }

          // Fetch vital signs
          const { data: vitals, error: vitalsError } = await supabase
            .from('mar_vital_signs')
            .select('*')
            .eq('mar_record_id', existingMar.id)

          if (!vitalsError && vitals) {
            setVitalSigns(vitals)
          }

          // Fetch PRN records
          const { data: prnData, error: prnError } = await supabase
            .from('mar_prn_not_administered')
            .select('*')
            .eq('mar_record_id', existingMar.id)
            .order('date', { ascending: true })

          if (!prnError && prnData) {
            setPrnRecords(prnData)
          }
        } else {
          // Create new MAR record
          const { data: newMar, error: createError } = await supabase
            .from('mar_records')
            .insert([
              {
                admission_id,
                month_year: searchMonthYear,
                patient_name: `${admission.first_name} ${admission.middle_name || ''} ${admission.last_name}`.trim(),
                date_of_birth: admission.dob,
                sex: admission.sex
              }
            ])
            .select()
            .single()

          if (createError) throw createError
          setMarRecord(newMar)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    if (monthYear || currentMonthYear) {
      fetchData()
    }
  }, [admission_id, monthYear, currentMonthYear])

  const handleMonthYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMonthYear(e.target.value)
    setLoading(true)
  }

  const handleRecordFieldUpdate = async (field: keyof MarRecord, value: string) => {
    if (!marRecord) return

    try {
      const { data, error } = await supabase
        .from('mar_records')
        .update({ [field]: value })
        .eq('id', marRecord.id)
        .select()
        .single()

      if (error) throw error
      setMarRecord(data)
    } catch (error) {
      console.error('Error updating MAR record:', error)
    }
  }

  // Debounced versions for text fields - saves after user stops typing for 500ms
  const [updateTimeout, setUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [medUpdateTimeout, setMedUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [vitalUpdateTimeout, setVitalUpdateTimeout] = useState<NodeJS.Timeout | null>(null)
  const [prnUpdateTimeout, setPrnUpdateTimeout] = useState<NodeJS.Timeout | null>(null)

  const handleRecordFieldUpdateDebounced = (field: keyof MarRecord, value: string) => {
    if (!marRecord) return

    // Update local state immediately for responsive UI
    setMarRecord({ ...marRecord, [field]: value })

    // Clear existing timeout
    if (updateTimeout) {
      clearTimeout(updateTimeout)
    }

    // Set new timeout to save to database
    const timeout = setTimeout(() => {
      handleRecordFieldUpdate(field, value)
    }, 500)
    
    setUpdateTimeout(timeout)
  }

  const handleMedicationUpdateDebounced = (medicationId: string, field: keyof Medication, value: string) => {
    // Update local state immediately for responsive UI
    setMedications(medications.map(m => 
      m.id === medicationId ? { ...m, [field]: value } : m
    ))

    // Clear existing timeout
    if (medUpdateTimeout) {
      clearTimeout(medUpdateTimeout)
    }

    // Set new timeout to save to database
    const timeout = setTimeout(() => {
      handleMedicationUpdate(medicationId, field, value)
    }, 500)
    
    setMedUpdateTimeout(timeout)
  }

  const handleVitalSignUpdateDebounced = (vitalType: string, day: number, value: string) => {
    // Update local state immediately for responsive UI
    const existing = vitalSigns.find(v => v.vital_type === vitalType && v.day_of_month === day)
    if (existing) {
      setVitalSigns(vitalSigns.map(v => 
        v.id === existing.id ? { ...v, value } : v
      ))
    } else if (marRecord) {
      // Create temporary local entry until saved
      const tempVital: VitalSign = {
        id: `temp-${Date.now()}`,
        mar_record_id: marRecord.id,
        vital_type: vitalType,
        day_of_month: day,
        value
      }
      setVitalSigns([...vitalSigns, tempVital])
    }

    // Clear existing timeout
    if (vitalUpdateTimeout) {
      clearTimeout(vitalUpdateTimeout)
    }

    // Set new timeout to save to database
    const timeout = setTimeout(() => {
      handleVitalSignUpdate(vitalType, day, value)
    }, 500)
    
    setVitalUpdateTimeout(timeout)
  }

  const handlePRNUpdateDebounced = (prnId: string, field: keyof PRNRecord, value: string) => {
    // Update local state immediately for responsive UI
    setPrnRecords(prnRecords.map(p => 
      p.id === prnId ? { ...p, [field]: value } : p
    ))

    // Clear existing timeout
    if (prnUpdateTimeout) {
      clearTimeout(prnUpdateTimeout)
    }

    // Set new timeout to save to database
    const timeout = setTimeout(() => {
      handlePRNUpdate(prnId, field, value)
    }, 500)
    
    setPrnUpdateTimeout(timeout)
  }

  const handleAddMedication = async () => {
    if (!marRecord) return

    const newMed: Omit<Medication, 'id' | 'created_at' | 'updated_at'> = {
      mar_record_id: marRecord.id,
      medication_name: '',
      start_date: marRecord.month_year.split('/').reverse().join('-') + '-01', // First day of month
      stop_date: null,
      hour: null
    }

    try {
      const { data, error } = await supabase
        .from('mar_medications')
        .insert([newMed])
        .select()
        .single()

      if (error) throw error
      setMedications([...medications, data])
    } catch (error) {
      console.error('Error adding medication:', error)
    }
  }

  const handleMedicationUpdate = async (medicationId: string, field: keyof Medication, value: string) => {
    try {
      const { data, error } = await supabase
        .from('mar_medications')
        .update({ [field]: value })
        .eq('id', medicationId)
        .select()
        .single()

      if (error) throw error
      setMedications(medications.map(m => m.id === medicationId ? data : m))
    } catch (error) {
      console.error('Error updating medication:', error)
    }
  }

  const handleAdminClick = async (medicationId: string, day: number, currentAdmin: Administration | undefined) => {
    if (!marRecord) return

    // Open modal to get initials
    if (!currentAdmin) {
      setPendingAdmin({ medicationId, day, currentAdmin })
      setShowInitialsModal(true)
      setInitialsInput('')
    } else {
      // For existing admin, prompt for initials or toggle
      setPendingAdmin({ adminId: currentAdmin.id, medicationId, day, currentAdmin })
      setShowInitialsModal(true)
      setInitialsInput(currentAdmin.initials || '')
    }
  }

  const handleInitialsSubmit = async () => {
    if (!pendingAdmin || !marRecord) return

    try {
      if (pendingAdmin.adminId) {
        // Update existing admin
        const { data, error } = await supabase
          .from('mar_administration')
          .update({ initials: initialsInput, given: true })
          .eq('id', pendingAdmin.adminId)
          .select()
          .single()

        if (error) throw error
        setAdministrations(administrations.map(a => a.id === pendingAdmin.adminId ? data : a))
      } else {
        // Create new administration record
        const { data, error } = await supabase
          .from('mar_administration')
          .insert([{
            medication_id: pendingAdmin.medicationId,
            mar_record_id: marRecord.id,
            day_of_month: pendingAdmin.day,
            initials: initialsInput,
            given: true
          }])
          .select()
          .single()

        if (error) throw error
        setAdministrations([...administrations, data])
      }

      setShowInitialsModal(false)
      setPendingAdmin(null)
      setInitialsInput('')
    } catch (error) {
      console.error('Error saving administration:', error)
    }
  }

  const handleInitialsCancel = () => {
    setShowInitialsModal(false)
    setPendingAdmin(null)
    setInitialsInput('')
  }

  const handleDeleteAdmin = async () => {
    if (!pendingAdmin?.adminId) return

    try {
      const { error } = await supabase
        .from('mar_administration')
        .delete()
        .eq('id', pendingAdmin.adminId)

      if (error) throw error
      setAdministrations(administrations.filter(a => a.id !== pendingAdmin.adminId))
      setShowInitialsModal(false)
      setPendingAdmin(null)
      setInitialsInput('')
    } catch (error) {
      console.error('Error deleting administration:', error)
    }
  }

  const handleInitialsUpdate = async (adminId: string, initials: string) => {
    try {
      const { data, error } = await supabase
        .from('mar_administration')
        .update({ initials })
        .eq('id', adminId)
        .select()
        .single()

      if (error) throw error
      setAdministrations(administrations.map(a => a.id === adminId ? data : a))
    } catch (error) {
      console.error('Error updating initials:', error)
    }
  }

  const handleVitalSignUpdate = async (vitalType: string, day: number, value: string) => {
    if (!marRecord) return

    try {
      const existing = vitalSigns.find(v => v.vital_type === vitalType && v.day_of_month === day)
      
      if (existing) {
        const { data, error } = await supabase
          .from('mar_vital_signs')
          .update({ value })
          .eq('id', existing.id)
          .select()
          .single()

        if (error) throw error
        setVitalSigns(vitalSigns.map(v => v.id === existing.id ? data : v))
      } else {
        const { data, error } = await supabase
          .from('mar_vital_signs')
          .insert([{
            mar_record_id: marRecord.id,
            vital_type: vitalType,
            day_of_month: day,
            value
          }])
          .select()
          .single()

        if (error) throw error
        setVitalSigns([...vitalSigns, data])
      }
    } catch (error) {
      console.error('Error updating vital sign:', error)
    }
  }

  const handleAddPRN = async () => {
    if (!marRecord) return

    const newPRN: Omit<PRNRecord, 'id'> = {
      mar_record_id: marRecord.id,
      date: new Date().toISOString().split('T')[0],
      hour: null,
      initials: null,
      medication: '',
      reason: '',
      result: null,
      staff_signature: null
    }

    try {
      const { data, error } = await supabase
        .from('mar_prn_not_administered')
        .insert([newPRN])
        .select()
        .single()

      if (error) throw error
      setPrnRecords([...prnRecords, data])
    } catch (error) {
      console.error('Error adding PRN record:', error)
    }
  }

  const handlePRNUpdate = async (prnId: string, field: keyof PRNRecord, value: string) => {
    try {
      const { data, error } = await supabase
        .from('mar_prn_not_administered')
        .update({ [field]: value })
        .eq('id', prnId)
        .select()
        .single()

      if (error) throw error
      setPrnRecords(prnRecords.map(p => p.id === prnId ? data : p))
    } catch (error) {
      console.error('Error updating PRN:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading MAR...</p>
        </div>
      </div>
    )
  }

  // Generate days array for current month
  const getDaysInMonth = () => {
    const [mm, yyyy] = (monthYear || currentMonthYear).split('/')
    const daysInMonth = new Date(parseInt(yyyy), parseInt(mm), 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }

  const daysInMonth = getDaysInMonth()

  return (
    <>
      <Head>
        <title>Medication Administration Record - MAR</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Medication Administration Record (MAR)
                </h1>
                {marRecord && (
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {marRecord.patient_name || 'Patient Name'}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <Link href={`/dashboard?admission_id=${admission_id}`}>
                  <a className="text-blue-600 dark:text-blue-400 hover:underline">
                    ← Dashboard
                  </a>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('medications')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'medications'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Medications
              </button>
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'vitals'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                Vital Signs
              </button>
              <button
                onClick={() => setActiveTab('prn')}
                className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === 'prn'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                PRN / Not Administered
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-8">
          {activeTab === 'medications' && marRecord && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              {/* Header fields */}
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    MO/YR
                  </label>
                  <input
                    type="text"
                    value={monthYear || currentMonthYear}
                    onChange={handleMonthYearChange}
                    placeholder="MM/YYYY"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Facility Name
                  </label>
                  <input
                    type="text"
                    value={marRecord.facility_name || ''}
                    onChange={(e) => handleRecordFieldUpdateDebounced('facility_name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Medication grid */}
              <div className="overflow-x-auto mb-6 border border-gray-300 rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold sticky left-0 bg-gray-100 dark:bg-gray-700" style={{ minWidth: '200px', zIndex: 10 }}>Medication</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold" style={{ minWidth: '150px' }}>Start/Stop Date</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold" style={{ minWidth: '100px' }}>Hour</th>
                      {daysInMonth.map(day => (
                        <th key={day} className="border border-gray-300 px-1 py-2 text-center font-semibold text-xs" style={{ minWidth: '40px' }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((med) => {
                      const medAdminRecords = administrations.filter(a => a.medication_id === med.id)
                      
                      return (
                        <React.Fragment key={med.id}>
                          {/* Medication Name Row */}
                          <tr>
                            <td className="border border-gray-300 px-3 py-2 sticky left-0 bg-white dark:bg-gray-800" style={{ zIndex: 5 }} rowSpan={2}>
                              <input
                                type="text"
                                value={med.medication_name}
                                onChange={(e) => handleMedicationUpdateDebounced(med.id, 'medication_name', e.target.value)}
                                placeholder="Medication name"
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 bg-transparent"
                              />
                            </td>
                            <td className="border border-gray-300 px-2 py-1">
                              <input
                                type="date"
                                value={med.start_date}
                                onChange={(e) => handleMedicationUpdate(med.id, 'start_date', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                                placeholder="Start"
                              />
                            </td>
                            <td className="border border-gray-300 px-2 py-1" rowSpan={2}>
                              <input
                                type="time"
                                value={med.hour || ''}
                                onChange={(e) => handleMedicationUpdate(med.id, 'hour', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                              />
                            </td>
                            {daysInMonth.map(day => {
                              const admin = medAdminRecords.find(a => a.day_of_month === day)
                              const isGiven = admin?.given
                              
                              return (
                                <td key={day} className="border border-gray-300 p-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdminClick(med.id, day, admin)}
                                    className={`w-full h-8 border border-gray-300 rounded text-xs font-mono hover:ring-2 hover:ring-blue-300 ${
                                      isGiven 
                                        ? 'bg-blue-100 dark:bg-blue-900 border-blue-400' 
                                        : 'bg-gray-50 dark:bg-gray-700'
                                    }`}
                                  >
                                    {admin?.initials || ' '}
                                  </button>
                                </td>
                              )
                            })}
                          </tr>
                          {/* Stop Date Row */}
                          <tr>
                            <td className="border border-gray-300 px-2 py-1">
                              <input
                                type="date"
                                value={med.stop_date || ''}
                                onChange={(e) => handleMedicationUpdate(med.id, 'stop_date', e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                                placeholder="Stop"
                              />
                            </td>
                          </tr>
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add medication button */}
              <button
                onClick={handleAddMedication}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + Add Medication
              </button>

              {/* Patient info footer - matching MAR-1 layout */}
              <div className="mt-8 border-t pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Diagnosis:</label>
                      <textarea
                        value={marRecord.diagnosis || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('diagnosis', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Allergies:</label>
                      <textarea
                        value={marRecord.allergies || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('allergies', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                        rows={2}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">NAME:</label>
                      <p className="text-sm font-semibold">{marRecord.patient_name || '-'}</p>
                    </div>
                  </div>

                  {/* Middle Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        DIET (Special Instructions, e.g. Texture, Bite Size, Position, etc.)
                      </label>
                      <textarea
                        value={marRecord.diet_instructions || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('diet_instructions', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Physician Name</label>
                        <input
                        type="text"
                        value={marRecord.physician_name || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('physician_name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Phone Number</label>
                        <input
                        type="text"
                        value={marRecord.physician_phone || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('physician_phone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Record #</label>
                        <input
                        type="text"
                        value={marRecord.record_number || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('record_number', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Comments</label>
                      <textarea
                        value={marRecord.comments || ''}
                        onChange={(e) => handleRecordFieldUpdateDebounced('comments', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white dark:bg-gray-700"
                        rows={3}
                      />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                      <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">Instructions:</p>
                      <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                        <li><strong>A.</strong> Put initials in appropriate box when medication is given.</li>
                        <li><strong>B.</strong> Circle initials when not given.</li>
                        <li><strong>C.</strong> State reason for refusal / omission on back of form.</li>
                        <li><strong>D.</strong> PRN Medications: Reason given and results must be noted on back of form.</li>
                        <li><strong>E.</strong> Legend: S=School; H = Home visit; W = Work; P = Program.</li>
                      </ul>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Date of Birth:</label>
                      <p className="text-sm">{marRecord.date_of_birth || '-'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Sex:</label>
                      <p className="text-sm">{marRecord.sex || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vitals' && marRecord && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Vital Signs</h2>
                <div className="flex items-center gap-4">
                  <p className="text-gray-600 dark:text-gray-400">Name: {marRecord.patient_name}</p>
                  <p className="text-gray-600 dark:text-gray-400">MO/YR: {monthYear || currentMonthYear}</p>
                </div>
              </div>

              {/* Vital Signs Grid */}
              <div className="overflow-x-auto mb-6 border border-gray-300 rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 px-4 py-3 text-left font-semibold sticky left-0 bg-gray-100 dark:bg-gray-700" style={{ minWidth: '200px', zIndex: 10 }}>VITAL SIGNS</th>
                      {daysInMonth.map(day => (
                        <th key={day} className="border border-gray-300 px-1 py-2 text-center font-semibold text-xs" style={{ minWidth: '60px' }}>
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['TEMPERATURE', 'PULSE', 'RESPIRATION', 'WEIGHT'].map(vitalType => (
                      <tr key={vitalType}>
                        <td className="border border-gray-300 px-4 py-2 sticky left-0 bg-white dark:bg-gray-800 font-semibold" style={{ zIndex: 5 }}>
                          {vitalType}
                        </td>
                        {daysInMonth.map(day => {
                          const vital = vitalSigns.find(v => v.vital_type === vitalType && v.day_of_month === day)
                          
                          return (
                            <td key={day} className="border border-gray-300 p-1">
                              <input
                                type="text"
                                value={vital?.value || ''}
                                onChange={(e) => handleVitalSignUpdateDebounced(vitalType, day, e.target.value)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center bg-transparent focus:ring-2 focus:ring-blue-500"
                                placeholder="-"
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'prn' && marRecord && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">PRN AND MEDICATIONS NOT ADMINISTERED</h2>
                <div className="flex items-center gap-4">
                  <p className="text-gray-600 dark:text-gray-400">Name: {marRecord.patient_name}</p>
                  <p className="text-gray-600 dark:text-gray-400">MO/YR: {monthYear || currentMonthYear}</p>
                </div>
              </div>

              {/* PRN Table */}
              <div className="overflow-x-auto mb-6 border border-gray-300 rounded-lg">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-xs" style={{ width: '40px' }}>#</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Date</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Hour</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Initials</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Medication</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Reason</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Result</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Staff Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prnRecords.map((prn, index) => (
                      <tr key={prn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold">
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="date"
                            value={prn.date}
                            onChange={(e) => handlePRNUpdate(prn.id, 'date', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="time"
                            value={prn.hour || ''}
                            onChange={(e) => handlePRNUpdate(prn.id, 'hour', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={prn.initials || ''}
                            onChange={(e) => handlePRNUpdateDebounced(prn.id, 'initials', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                            placeholder="Initials"
                            maxLength={10}
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={prn.medication}
                            onChange={(e) => handlePRNUpdateDebounced(prn.id, 'medication', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                            placeholder="Medication"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={prn.reason}
                            onChange={(e) => handlePRNUpdateDebounced(prn.id, 'reason', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                            placeholder="Reason"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={prn.result || ''}
                            onChange={(e) => handlePRNUpdateDebounced(prn.id, 'result', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                            placeholder="Result"
                          />
                        </td>
                        <td className="border border-gray-300 px-2 py-2">
                          <input
                            type="text"
                            value={prn.staff_signature || ''}
                            onChange={(e) => handlePRNUpdateDebounced(prn.id, 'staff_signature', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 bg-transparent"
                            placeholder="Signature"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add PRN button */}
              <button
                onClick={handleAddPRN}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + Add PRN Record
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Initials Modal */}
      {showInitialsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Enter Initials</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Please enter your initials for this administration record.
            </p>
            <input
              type="text"
              value={initialsInput}
              onChange={(e) => setInitialsInput(e.target.value.toUpperCase())}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-lg font-mono uppercase focus:ring-2 focus:ring-blue-500 mb-6"
              placeholder="Enter initials"
              maxLength={10}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleInitialsSubmit()
                } else if (e.key === 'Escape') {
                  handleInitialsCancel()
                }
              }}
            />
            <div className="flex gap-3">
              {pendingAdmin?.adminId && (
                <button
                  onClick={handleDeleteAdmin}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              )}
              <button
                onClick={handleInitialsSubmit}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={!initialsInput.trim()}
              >
                Save
              </button>
              <button
                onClick={handleInitialsCancel}
                className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
