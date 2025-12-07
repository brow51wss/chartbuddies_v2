import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile, signOut } from '../../../../lib/auth'
import type { MARForm, MARMedication, MARAdministration, MARPRNRecord, MARVitalSigns } from '../../../../types/mar'

export default function ViewMARForm() {
  const router = useRouter()
  const { id: patientId, marId } = router.query
  
  // Ensure marId is a string (can be array during SSR)
  const marFormId = Array.isArray(marId) ? marId[0] : marId
  const patientFormId = Array.isArray(patientId) ? patientId[0] : patientId
  const [marForm, setMarForm] = useState<MARForm | null>(null)
  const [medications, setMedications] = useState<MARMedication[]>([])
  const [administrations, setAdministrations] = useState<{ [medId: string]: { [day: number]: MARAdministration } }>({})
  const [prnRecords, setPrnRecords] = useState<MARPRNRecord[]>([])
  const [vitalSigns, setVitalSigns] = useState<{ [day: number]: MARVitalSigns }>({})
  const [staffInitials, setStaffInitials] = useState<{ [initials: string]: string }>({})
  const [dailyInitials, setDailyInitials] = useState<{ [day: number]: string }>({})
  const [dailySignatures, setDailySignatures] = useState<{ [day: number]: string }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [message, setMessage] = useState('')
  // Removed page navigation - everything shows in one table
  const [showAddMedModal, setShowAddMedModal] = useState(false)
  const [showAddPRNModal, setShowAddPRNModal] = useState(false)
  const [showEditPatientInfoModal, setShowEditPatientInfoModal] = useState(false)
  const [showVitalSignsModal, setShowVitalSignsModal] = useState(false)
  const [editingCell, setEditingCell] = useState<{ medId: string; day: number } | null>(null)
  const [editingCellValue, setEditingCellValue] = useState<string>('') // Store the value being edited
  // Always allow editing of day cells
  const [isEditing] = useState(true)
  const [editingComments, setEditingComments] = useState(false)
  const [commentsValue, setCommentsValue] = useState<string>('')
  const [editingPRNField, setEditingPRNField] = useState<{ recordId: string; field: string } | null>(null)
  const [editingPRNValue, setEditingPRNValue] = useState<string>('')
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [showPRNNoteModal, setShowPRNNoteModal] = useState(false)
  const [editingPRNNote, setEditingPRNNote] = useState<{ recordId: string; note: string | null } | null>(null)

  useEffect(() => {
    // Wait for router to be ready
    if (!router.isReady) {
      setLoading(true)
      return
    }
    
    const formId = Array.isArray(router.query.marId) ? router.query.marId[0] : router.query.marId
    if (formId && typeof formId === 'string') {
      loadUserProfile()
      loadMARForm()
    } else if (router.isReady && !formId) {
      // Router is ready but no marId - set error
      setError('MAR form ID not found in URL')
      setLoading(false)
    }
  }, [router.isReady, router.query.marId])

  // Handle browser back button and navigation
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Chrome requires returnValue to be set
      return '' // Some browsers require return value
    }

    // Handle browser back/forward button
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault()
      setShowLeaveConfirmModal(true)
      // Push current state back to prevent navigation
      window.history.pushState(null, '', window.location.href)
    }

    // Push a state to track navigation
    window.history.pushState(null, '', window.location.href)

    // Listen for browser back/forward/refresh
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // Handle Next.js router navigation
  useEffect(() => {
    let shouldBlockNavigation = true

    const handleRouteChangeStart = (url: string) => {
      // Don't show modal if navigating to the same page
      if (url === router.asPath) return
      
      if (shouldBlockNavigation) {
        // Show confirmation modal
        setPendingNavigation(url)
        setShowLeaveConfirmModal(true)
        
        // Prevent navigation
        router.events.emit('routeChangeError', new Error('Navigation cancelled'), url)
        throw 'Navigation cancelled'
      }
    }

    router.events.on('routeChangeStart', handleRouteChangeStart)

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart)
    }
  }, [router, router.asPath])

  const handleConfirmLeave = async () => {
    setShowLeaveConfirmModal(false)
    const navUrl = pendingNavigation
    setPendingNavigation(null)
    
    // Small delay to ensure modal closes before navigation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (navUrl) {
      // Use window.location for external navigation or router.push for internal
      if (navUrl.startsWith('http')) {
        window.location.href = navUrl
      } else {
        // Temporarily disable navigation blocking
        router.push(navUrl)
      }
    } else {
      // Browser back button - go back
      window.history.back()
    }
  }

  const handleCancelLeave = () => {
    setShowLeaveConfirmModal(false)
    setPendingNavigation(null)
  }

  const loadUserProfile = async () => {
    const profile = await getCurrentUserProfile()
    setUserProfile(profile)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const updateAdministration = async (medId: string, day: number, status: string, initials: string = '') => {
    if (!userProfile || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      // Check if administration already exists
      const existingAdmin = administrations[medId]?.[day]
      
      if (status === 'Not Given' && !existingAdmin) {
        // Don't create a record for "Not Given" if it doesn't exist
        setSaving(false)
        return
      }

      if (existingAdmin) {
        // Update existing
        const { error } = await supabase
          .from('mar_administrations')
          .update({
            status,
            initials: initials || userProfile.staff_initials || '',
            administered_at: status === 'Given' ? new Date().toISOString() : null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAdmin.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('mar_administrations')
          .insert({
            mar_medication_id: medId,
            day_number: day,
            status,
            initials: initials || userProfile.staff_initials || '',
            administered_at: status === 'Given' ? new Date().toISOString() : null
          })

        if (error) throw error
      }

      // Refresh data
      const { data: adminData, error: adminError } = await supabase
        .from('mar_administrations')
        .select('*')
        .eq('mar_medication_id', medId)
        .eq('day_number', day)
        .single()

      if (!adminError && adminData) {
        setAdministrations(prev => ({
          ...prev,
          [medId]: {
            ...prev[medId],
            [day]: adminData
          }
        }))
      }

      // If MC (Medication Discontinued) was selected, mark all future days as discontinued
      if (initials === 'MC' && status === 'Given') {
        // Mark all future days (day + 1 to 31) as discontinued
        const futureDays = []
        for (let futureDay = day + 1; futureDay <= 31; futureDay++) {
          futureDays.push({
            mar_medication_id: medId,
            day_number: futureDay,
            status: 'Given',
            initials: 'MC',
            administered_at: null
          })
        }

        if (futureDays.length > 0) {
          // Upsert all future days - this will create new records or update existing ones
          // The unique constraint on (mar_medication_id, day_number) will handle conflicts
          const { error: futureError } = await supabase
            .from('mar_administrations')
            .upsert(futureDays, { 
              onConflict: 'mar_medication_id,day_number',
              ignoreDuplicates: false 
            })

          if (futureError) {
            console.error('Error marking future days as discontinued:', futureError)
            // Don't throw - the main record was saved successfully
          } else {
            // Refresh all administrations for this medication to get updated data
            const { data: allAdminData, error: allAdminError } = await supabase
              .from('mar_administrations')
              .select('*')
              .eq('mar_medication_id', medId)
              .order('day_number', { ascending: true })

            if (!allAdminError && allAdminData) {
              const adminMap: { [day: number]: MARAdministration } = {}
              allAdminData.forEach(admin => {
                adminMap[admin.day_number] = admin
              })
              setAdministrations(prev => ({
                ...prev,
                [medId]: adminMap
              }))
            }
          }
        }
      }

      setMessage('Administration record updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error updating administration:', err)
      setError(err.message || 'Failed to update administration')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const addPRNRecord = async (record: {
    date: string
    hour: string | null
    initials: string | null
    medication: string
    reason: string
    result: string | null
    staffSignature: string | null
  }) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      const nextEntryNumber = prnRecords.length + 1

      const { error } = await supabase
        .from('mar_prn_records')
        .insert({
          mar_form_id: marFormId,
          date: record.date,
          hour: record.hour,
          initials: record.initials,
          medication: record.medication,
          reason: record.reason,
          result: record.result,
          staff_signature: record.staffSignature,
          entry_number: nextEntryNumber
        })

      if (error) throw error

      // Update staff initials legend only if initials and signature are provided
      if (record.initials && record.staffSignature) {
      setStaffInitials(prev => ({
        ...prev,
          [record.initials!]: record.staffSignature!
      }))
      }

      await loadMARForm()
      setMessage('PRN record added successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to add PRN record')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const updatePRNRecord = async (recordId: string, field: 'hour' | 'result' | 'initials' | 'staff_signature' | 'reason' | 'note', value: string | null) => {
    if (!marFormId) return
    
    try {
      setSaving(true)
      
      const updateData: any = { [field]: value }
      
      // If updating initials, also update staff_signature from legend if available
      if (field === 'initials' && value) {
        const initialsUpper = value.trim().toUpperCase()
        if (staffInitials[initialsUpper]) {
          updateData.staff_signature = staffInitials[initialsUpper]
        }
      }
      
      const { error } = await supabase
        .from('mar_prn_records')
        .update(updateData)
        .eq('id', recordId)

      if (error) throw error

      await loadMARForm()
      setMessage('PRN record updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update PRN record')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const handlePRNFieldEdit = (recordId: string, field: string, currentValue: string | null) => {
    setEditingPRNField({ recordId, field })
    
    // Auto-populate initials from user profile if editing initials field
    if (field === 'initials') {
      let userInitials = ''
      if (userProfile?.staff_initials) {
        userInitials = userProfile.staff_initials.toUpperCase()
      } else if (userProfile?.full_name) {
        const names = userProfile.full_name.trim().split(/\s+/)
        if (names.length >= 2) {
          userInitials = (names[0][0] + names[names.length - 1][0]).toUpperCase()
        } else if (names.length === 1) {
          userInitials = names[0][0].toUpperCase()
        }
      }
      setEditingPRNValue(currentValue || userInitials)
    } else {
      setEditingPRNValue(currentValue || '')
    }
  }

  const handlePRNFieldSave = async (recordId: string, field: string) => {
    const record = prnRecords.find(r => r.id === recordId)
    
    // Validation: Initials can only be set if Time and Result are both filled
    if (field === 'initials') {
      if (!record?.hour || !record?.result) {
        setError('Time and Result must be filled before setting Initials')
        setTimeout(() => setError(''), 5000)
        setEditingPRNField(null)
        setEditingPRNValue('')
        return
      }
    }
    
    const dbField = field === 'hour' ? 'hour' : field === 'result' ? 'result' : field === 'initials' ? 'initials' : field === 'reason' ? 'reason' : 'staff_signature'
    await updatePRNRecord(recordId, dbField as 'hour' | 'result' | 'initials' | 'staff_signature' | 'reason', editingPRNValue.trim() || null)
    setEditingPRNField(null)
    setEditingPRNValue('')
  }

  const handlePRNFieldCancel = () => {
    setEditingPRNField(null)
    setEditingPRNValue('')
  }

  const saveComments = async () => {
    if (!marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      const { error } = await supabase
        .from('mar_forms')
        .update({ 
          comments: commentsValue || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', marFormId)

      if (error) throw error

      // Update local state
      setMarForm(prev => prev ? { ...prev, comments: commentsValue || null } : null)
      setEditingComments(false)
      setMessage('Comments saved successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to save comments')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const addMedication = async (medData: {
    medicationName: string
    dosage: string
    startDate: string
    stopDate: string | null
    hour: string
    notes: string | null
    initials: string
    frequency: number
    times?: string[] // Optional array of times for each frequency
  }) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      const frequency = medData.frequency || 1
      const times = medData.times || []
      
      // Create array of medications to insert
      const medicationsToInsert = []
      
      for (let i = 0; i < frequency; i++) {
        // Use provided time for this frequency, or default hour for first one
        const hour = times[i] || (i === 0 ? medData.hour : medData.hour)
        
        medicationsToInsert.push({
          mar_form_id: marFormId,
          medication_name: medData.medicationName,
          dosage: medData.dosage,
          start_date: medData.startDate,
          stop_date: medData.stopDate,
          hour: hour,
          notes: medData.notes
        })
      }
      
      // Insert all medications
      const { data: newMeds, error: medError } = await supabase
        .from('mar_medications')
        .insert(medicationsToInsert)
        .select()

      if (medError) throw medError
      if (!newMeds || newMeds.length === 0) throw new Error('Failed to create medications')

      // Populate initials for the START DATE of each medication
      // If start date is Nov 1, populate column 1
      // If start date is Nov 25, populate column 25
      // This is dynamic based on the start date the nurse selects
      
      // Parse the start date string directly to avoid timezone issues
      // Format: "YYYY-MM-DD" -> extract day number directly
      const startDateParts = medData.startDate.split('-')
      if (startDateParts.length === 3) {
        const startYear = parseInt(startDateParts[0], 10)
        const startMonth = parseInt(startDateParts[1], 10) - 1 // Month is 0-indexed in Date
        const startDay = parseInt(startDateParts[2], 10) // Day of month (1-31)
        
        // Get the form's month/year
        const formMonth = new Date(marForm.month_year + '-01')
        const formYear = formMonth.getFullYear()
        const formMonthIndex = formMonth.getMonth()
        
        // Check if start date is in the same month/year as the form
        if (startYear === formYear && startMonth === formMonthIndex) {
          // Validate that the day exists in this month (e.g., Feb doesn't have day 30)
          try {
            const testDate = new Date(formYear, formMonthIndex, startDay)
            if (testDate.getDate() === startDay && testDate.getMonth() === formMonthIndex) {
              // Create administration records for the start date for each medication
              const adminRecords = newMeds.map(med => ({
                mar_medication_id: med.id,
                day_number: startDay, // Use the parsed day directly
                status: 'Given',
                initials: medData.initials,
                administered_at: new Date().toISOString()
              }))
              
              const { error: adminError } = await supabase
                .from('mar_administrations')
                .insert(adminRecords)

              if (adminError) {
                console.error('Error creating administration for start date:', adminError)
                // Don't throw - medications were created successfully
              }
            }
          } catch (e) {
            console.error('Invalid date for medication start:', e)
          }
        }
      }

      await loadMARForm()
      const displayDay = startDateParts.length === 3 ? parseInt(startDateParts[2], 10) : 'N/A'
      const freqMessage = frequency > 1 ? ` (${frequency} times per day)` : ''
      setMessage(`Medication added successfully${freqMessage}! Initials "${medData.initials}" recorded for start date (day ${displayDay}).`)
      setTimeout(() => setMessage(''), 5000)
    } catch (err: any) {
      console.error('Error adding medication:', err)
      setError(err.message || 'Failed to add medication')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const addVitals = async (vitalsData: {
    notes: string
    initials: string
    startDate: string
    stopDate: string | null
    hour: string
  }) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      // Create a medication entry for vitals so it appears in the same table
      // Use a special naming convention to identify it as a vital sign entry
      const { data: newVital, error: vitalError } = await supabase
        .from('mar_medications')
        .insert({
          mar_form_id: marFormId,
          medication_name: 'VITALS',
          dosage: vitalsData.notes, // Store the vital sign instructions in dosage field
          start_date: vitalsData.startDate,
          stop_date: vitalsData.stopDate,
          hour: vitalsData.hour,
          notes: 'Vital Signs Entry' // Mark as vital sign entry
        })
        .select()
        .single()

      if (vitalError) throw vitalError

      // Populate initials for the START DATE of the vitals entry (same as medications)
      const startDateParts = vitalsData.startDate.split('-')
      if (startDateParts.length === 3 && vitalsData.initials) {
        const startYear = parseInt(startDateParts[0], 10)
        const startMonth = parseInt(startDateParts[1], 10) - 1
        const startDay = parseInt(startDateParts[2], 10)
        
        const formMonth = new Date(marForm.month_year + '-01')
        const formYear = formMonth.getFullYear()
        const formMonthIndex = formMonth.getMonth()
        
        // Check if start date is in the same month as the form
        if (startMonth === formMonthIndex && startYear === formYear) {
          // Create administration record for the start day
          await supabase
            .from('mar_administrations')
            .insert({
              mar_medication_id: newVital.id,
              day_number: startDay,
              status: 'Given',
              initials: vitalsData.initials.trim(), // Keep as-is for vitals (no uppercase)
              administered_at: new Date().toISOString()
            })
        }
      }

      await loadMARForm()
      setMessage('Vital signs entry added successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error adding vitals:', err)
      setError(err.message || 'Failed to add vitals')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const updateVitalSigns = async (day: number, field: string, value: number | string) => {
    if (!userProfile || !marForm || !marFormId) return
    
    // Handle string fields (bowel_movement) differently from numeric fields
    const isStringField = field === 'bowel_movement'
    
    // For string fields, allow empty strings
    if (isStringField) {
      try {
        setSaving(true)
        const existing = vitalSigns[day]
        const updateData: any = {
          mar_form_id: marFormId,
          day_number: day,
          [field]: value || null
        }

        if (existing) {
          const { error } = await supabase
            .from('mar_vital_signs')
            .update(updateData)
            .eq('id', existing.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('mar_vital_signs')
            .insert(updateData)
          if (error) throw error
        }

        await loadMARForm()
      } catch (err: any) {
        console.error('Error updating vital signs:', err)
        setError(err.message || 'Failed to update vital signs')
        setTimeout(() => setError(''), 5000)
      } finally {
        setSaving(false)
      }
      return
    }
    
    // For numeric fields, handle as before
    const numValue = typeof value === 'string' ? parseFloat(value) : value
    if (!numValue || numValue === 0) {
      const existing = vitalSigns[day]
      if (existing) {
        try {
          setSaving(true)
          const updateData: any = {
            mar_form_id: marFormId,
            day_number: day,
            [field]: null
          }
          const { error } = await supabase
            .from('mar_vital_signs')
            .update(updateData)
            .eq('id', existing.id)
          if (error) throw error
          await loadMARForm()
        } catch (err: any) {
          console.error('Error updating vital signs:', err)
        } finally {
          setSaving(false)
        }
      }
      return
    }
    
    try {
      setSaving(true)
      const existing = vitalSigns[day]

      const updateData: any = {
        mar_form_id: marFormId,
        day_number: day,
        [field]: numValue
      }

      if (existing) {
        const { error } = await supabase
          .from('mar_vital_signs')
          .update(updateData)
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('mar_vital_signs')
          .insert(updateData)

        if (error) throw error
      }

      await loadMARForm()
    } catch (err: any) {
      console.error('Error updating vital signs:', err)
      setError(err.message || 'Failed to update vital signs')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const loadMARForm = async () => {
    if (!marFormId || typeof marFormId !== 'string') return
    
    try {
      // Load MAR form
      const { data: formData, error: formError } = await supabase
        .from('mar_forms')
        .select('*')
        .eq('id', marFormId)
        .single()

      if (formError) throw formError
      if (!formData) {
        setError('MAR form not found')
        setLoading(false)
        return
      }
      
      // If patient_name is missing, load it from patients table
      if (!formData.patient_name && formData.patient_id) {
        const { data: patientData } = await supabase
          .from('patients')
          .select('patient_name, record_number, date_of_birth, sex')
          .eq('id', formData.patient_id)
          .single()
        
        if (patientData) {
          formData.patient_name = patientData.patient_name
          formData.record_number = formData.record_number || patientData.record_number
          formData.date_of_birth = formData.date_of_birth || patientData.date_of_birth
          formData.sex = formData.sex || patientData.sex
        }
      }
      
      setMarForm(formData)
      // Initialize comments value
      setCommentsValue(formData.comments || '')

      // Load medications
      const { data: medsData, error: medsError } = await supabase
        .from('mar_medications')
        .select('*')
        .eq('mar_form_id', marFormId)
        .order('created_at', { ascending: true })

      if (medsError) throw medsError
      
      // Sort medications: vitals entries first, then regular medications
      // Group medications with same name, dosage, and dates together
      const sortedMeds = (medsData || []).sort((a, b) => {
        const aIsVitals = a.medication_name === 'VITALS' || a.notes === 'Vital Signs Entry'
        const bIsVitals = b.medication_name === 'VITALS' || b.notes === 'Vital Signs Entry'
        
        if (aIsVitals && !bIsVitals) return -1 // a (vitals) comes first
        if (!aIsVitals && bIsVitals) return 1  // b (vitals) comes first
        
        // For same type, group by medication name, dosage, and dates
        if (!aIsVitals && !bIsVitals) {
          const aKey = `${a.medication_name}|${a.dosage}|${a.start_date}|${a.stop_date || ''}`
          const bKey = `${b.medication_name}|${b.dosage}|${b.start_date}|${b.stop_date || ''}`
          
          if (aKey !== bKey) {
            return aKey.localeCompare(bKey)
          }
          // Same medication group, sort by hour
          return a.hour.localeCompare(b.hour)
        }
        
        return 0
      })
      
      setMedications(sortedMeds)

      // Load administrations for all medications
      if (sortedMeds && sortedMeds.length > 0) {
        const medIds = sortedMeds.map(m => m.id)
        const { data: adminData, error: adminError } = await supabase
          .from('mar_administrations')
          .select('*')
          .in('mar_medication_id', medIds)

        if (adminError) throw adminError

        // Organize by medication and day
        const adminMap: { [medId: string]: { [day: number]: MARAdministration } } = {}
        adminData?.forEach(admin => {
          if (!adminMap[admin.mar_medication_id]) {
            adminMap[admin.mar_medication_id] = {}
          }
          adminMap[admin.mar_medication_id][admin.day_number] = admin
        })
        setAdministrations(adminMap)
      }

      // Load PRN records
      const { data: prnData, error: prnError } = await supabase
        .from('mar_prn_records')
        .select('*')
        .eq('mar_form_id', marFormId)
        .order('entry_number', { ascending: true })

      if (prnError) throw prnError
      setPrnRecords(prnData || [])

      // Build staff initials legend from PRN records
      const initialsMap: { [initials: string]: string } = {}
      prnData?.forEach(prn => {
        if (prn.initials && prn.staff_signature) {
          initialsMap[prn.initials] = prn.staff_signature
        }
      })
      setStaffInitials(initialsMap)

      // Load vital signs
      const { data: vsData, error: vsError } = await supabase
        .from('mar_vital_signs')
        .select('*')
        .eq('mar_form_id', marFormId)

      if (vsError) throw vsError

      const vsMap: { [day: number]: MARVitalSigns } = {}
      vsData?.forEach(vs => {
        vsMap[vs.day_number] = vs
      })
      setVitalSigns(vsMap)

      setLoading(false)
    } catch (err: any) {
      console.error('Error loading MAR form:', err)
      setError(err.message || 'Failed to load MAR form')
      setLoading(false)
    }
  }

  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  // Header component (reusable)
  const Header = () => (
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
              {userProfile?.full_name || 'Loading...'} • {userProfile?.role?.replace('_', ' ').toUpperCase() || ''}
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
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Dashboard
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
  )

  // Show loading state while router is initializing
  if (!router.isReady || loading) {
    return (
      <ProtectedRoute>
        <Head>
          <title>Loading MAR Form - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <Header />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading MAR form...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Show error state
  if (error && !marForm) {
    return (
      <ProtectedRoute>
        <Head>
          <title>Error - MAR Form - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <Header />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
                onClick={() => router.push('/dashboard?module=mar')} 
                className="px-4 py-2 bg-lasso-navy text-white rounded-md"
              >
                Back to MAR Patients
            </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  // Show not found if no marForm after loading
  if (!marForm && !loading) {
    return (
      <ProtectedRoute>
        <Head>
          <title>MAR Form Not Found - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <Header />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">MAR form not found</p>
            <button 
                onClick={() => router.push('/dashboard?module=mar')} 
                className="px-4 py-2 bg-lasso-navy text-white rounded-md"
              >
                Back to MAR Patients
            </button>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!marForm) {
    return (
      <ProtectedRoute>
        <Head>
          <title>Loading MAR Form - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <Header />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
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
        <title>MAR Form - {marForm.month_year} - Lasso</title>
      </Head>
      <div className="min-h-screen">
        <Header />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Navigation */}
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard?module=mar')}
              className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm mb-4"
            >
              ← Back to MAR Patients
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Medication Administration Record (MAR)
              </h1>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowAddMedModal(true)}
                  className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal text-sm font-medium"
                >
                  + Medication
                </button>
                <button
                  onClick={() => setShowVitalSignsModal(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
                >
                  + Vital Signs
                </button>
                <button
                  onClick={() => setShowAddPRNModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  + PRN
                </button>
              </div>
            </div>
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


          {/* Medication Administration Table - Box 1 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
              {/* Form Header */}
              <div className="mb-6 border-b-2 border-gray-300 dark:border-gray-600 pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center space-x-4">
                    <span className="text-2xl">T</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={marForm.month_year}
                        onChange={(e) => {
                          // Update month_year
                          supabase
                            .from('mar_forms')
                            .update({ month_year: e.target.value })
                            .eq('id', marFormId)
                          setMarForm({ ...marForm, month_year: e.target.value })
                        }}
                        placeholder="MO/YR"
                        className="px-2 py-1 border border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    ) : (
                      <span className="text-lg font-medium">{marForm.month_year}</span>
                    )}
                  </div>
                  <div>
                    <button
                      onClick={() => setShowEditPatientInfoModal(true)}
                      className="text-left text-lg font-medium text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      Facility Name: {marForm.facility_name || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Medication Administration Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                  <colgroup>
                    <col className="w-[200px]" /> {/* Medication */}
                    <col className="w-[120px]" /> {/* Start/Stop Date */}
                    <col className="w-[80px]" /> {/* Hour */}
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 sticky left-0 z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500" style={{ minWidth: '200px' }}>
                        Medication
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 sticky left-[200px] z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500" style={{ minWidth: '120px' }}>
                        Start/Stop Date
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 sticky left-[320px] z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500" style={{ minWidth: '80px' }}>
                        Hour
                      </th>
                      {/* Days 1-31 */}
                      {days.map(day => (
                        <th
                          key={day}
                          className="border border-gray-300 dark:border-gray-600 px-1 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300"
                          style={{ minWidth: '40px', width: '40px' }}
                        >
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medications.length === 0 ? (
                      <tr>
                        <td colSpan={34} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          No medications recorded. Click "+ Medication" to add one.
                        </td>
                      </tr>
                    ) : (() => {
                      // Group medications by name, dosage, and dates to calculate rowSpan
                      const medicationGroups: { [key: string]: { meds: typeof medications, rowSpan: number } } = {}
                      medications.forEach((med) => {
                        const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
                        const groupKey = isVitalsEntry 
                          ? `vitals_${med.id}`
                          : `${med.medication_name}|${med.dosage}|${med.start_date}|${med.stop_date || ''}`
                        
                        if (!medicationGroups[groupKey]) {
                          medicationGroups[groupKey] = { meds: [], rowSpan: 0 }
                        }
                        medicationGroups[groupKey].meds.push(med)
                      })
                      
                      Object.keys(medicationGroups).forEach(key => {
                        medicationGroups[key].rowSpan = medicationGroups[key].meds.length
                      })
                      
                      const isFirstInGroup: { [medId: string]: boolean } = {}
                      Object.values(medicationGroups).forEach(group => {
                        if (group.meds.length > 0) {
                          isFirstInGroup[group.meds[0].id] = true
                        }
                      })
                      
                      return medications.map((med) => {
                        const medAdmin = administrations[med.id] || {}
                        const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
                        const groupKey = isVitalsEntry 
                          ? `vitals_${med.id}`
                          : `${med.medication_name}|${med.dosage}|${med.start_date}|${med.stop_date || ''}`
                        const group = medicationGroups[groupKey]
                        const shouldMerge = !isVitalsEntry && group.rowSpan > 1
                        const isFirstRow = isFirstInGroup[med.id] || false
                        
                        return (
                          <tr key={med.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isVitalsEntry ? 'bg-lasso-blue/10 dark:bg-lasso-blue/20' : ''}`}>
                            {shouldMerge && !isFirstRow ? null : (
                              <td 
                                rowSpan={shouldMerge ? group.rowSpan : undefined}
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 align-top sticky left-0 z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-500"
                              >
                                <div className={`font-medium text-sm ${isVitalsEntry ? 'text-lasso-teal dark:text-lasso-blue' : 'text-gray-800 dark:text-white'}`}>
                                {isVitalsEntry ? '📊 VITALS' : med.medication_name}
                              </div>
                                <div className={`text-xs mt-1 ${isVitalsEntry ? 'text-lasso-blue dark:text-lasso-blue italic' : 'text-gray-600 dark:text-gray-400'}`}>
                                  {med.dosage}
                              </div>
                              {med.notes && !isVitalsEntry && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                  {med.notes}
                                </div>
                              )}
                            </td>
                            )}
                            {shouldMerge && !isFirstRow ? null : (
                              <td 
                                rowSpan={shouldMerge ? group.rowSpan : undefined}
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 align-top text-center text-xs sticky left-[200px] z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-500"
                              >
                              <div>Start: {new Date(med.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              {med.stop_date && (
                                <div>Stop: {new Date(med.stop_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              )}
                            </td>
                            )}
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 align-top text-center text-xs sticky left-[320px] z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-500">
                              {isVitalsEntry ? '—' : (
                                  <EditableHourField
                                    medication={med}
                                    onUpdate={async (newHour) => {
                                      try {
                                        setSaving(true)
                                        const { error } = await supabase
                                          .from('mar_medications')
                                          .update({ hour: newHour })
                                          .eq('id', med.id)
                                        
                                        if (error) throw error
                                        
                                        setMedications(prev => prev.map(m => 
                                          m.id === med.id ? { ...m, hour: newHour } : m
                                        ))
                                        
                                        setMessage('Medication time updated successfully')
                                        setTimeout(() => setMessage(''), 2000)
                                      } catch (err) {
                                        console.error('Error updating medication hour:', err)
                                        setError('Failed to update medication time')
                                        setTimeout(() => setError(''), 3000)
                                      } finally {
                                        setSaving(false)
                                      }
                                    }}
                                  />
                              )}
                            </td>
                            {days.map(day => {
                              const admin = medAdmin[day]
                              const status = admin?.status || 'Not Given'
                              const initials = admin?.initials || ''
                              const isNotGiven = status === 'Not Given'
                              const isGiven = status === 'Given'
                              const isPRN = status === 'PRN'
                              const isMC = initials === 'MC'

                              // Check if this day is after an MC (Medication Discontinued) day
                              let isDiscontinued = false
                              let mcDay = null
                              if (!isVitalsEntry) {
                                // Find the earliest day with MC for this medication
                                for (let checkDay = 1; checkDay < day; checkDay++) {
                                  const checkAdmin = medAdmin[checkDay]
                                  if (checkAdmin?.initials === 'MC') {
                                    mcDay = checkDay
                                    isDiscontinued = true
                                    break
                                  }
                                }
                              }
                              
                              let isMedActive = false
                              
                              if (isVitalsEntry) {
                                isMedActive = true
                              } else {
                                const medStartDate = new Date(med.start_date)
                                const medStopDate = med.stop_date ? new Date(med.stop_date) : null
                                const formMonth = new Date(marForm.month_year + '-01')
                                const formYear = formMonth.getFullYear()
                                const formMonthIndex = formMonth.getMonth()
                                const startDayOfMonth = medStartDate.getDate()
                                const isStartInFormMonth = medStartDate.getMonth() === formMonthIndex && medStartDate.getFullYear() === formYear
                                
                                if (isStartInFormMonth) {
                                  try {
                                    const currentDayDate = new Date(formYear, formMonthIndex, day)
                                    if (currentDayDate.getDate() === day && currentDayDate.getMonth() === formMonthIndex) {
                                      if (day >= startDayOfMonth) {
                                        if (!medStopDate || currentDayDate <= medStopDate) {
                                          isMedActive = true
                                        }
                                      }
                                    }
                                  } catch (e) {
                                    isMedActive = false
                                  }
                                }
                              }

                              return (
                                <td
                                  key={day}
                                  className={`border border-gray-300 dark:border-gray-600 px-1 py-2 text-center text-xs relative ${
                                    isDiscontinued ? 'bg-red-50 dark:bg-red-900/20' : ''
                                  } ${
                                    isEditing && isMedActive && !isDiscontinued ? 'cursor-pointer hover:bg-lasso-blue/10 dark:hover:bg-lasso-blue/20' : ''
                                  } ${!isMedActive ? 'bg-gray-100 dark:bg-gray-800' : ''} ${isDiscontinued ? 'cursor-not-allowed' : ''}`}
                                  onDoubleClick={isEditing && isMedActive && !isVitalsEntry && !isDiscontinued ? () => {
                                    if (isGiven) {
                                      updateAdministration(med.id, day, 'Not Given', initials)
                                    }
                                  } : undefined}
                                  title={
                                    isDiscontinued 
                                      ? `Medication discontinued on day ${mcDay}. Cannot edit future days. Add a new medication to continue.`
                                      : isEditing && isMedActive 
                                        ? (isVitalsEntry ? 'Click to add vital signs' : 'Click to add initials, Double-click to mark as not given')
                                        : !isMedActive 
                                          ? (isVitalsEntry ? 'Vital signs entry' : 'Medication not active on this day')
                                          : ''
                                  }
                                >
                                  {/* Red strikethrough line for discontinued days */}
                                  {isDiscontinued && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                      <div className="w-full h-0.5 bg-red-600 dark:bg-red-400"></div>
                                    </div>
                                  )}
                                  {isMedActive ? (
                                    <>
                                      {isDiscontinued ? (
                                        // Discontinued day - only show red line, no MC text (MC only appears on the day it was selected)
                                        <div className="min-h-[24px] flex items-center justify-center">
                                          {/* Empty - red line is shown via the absolute positioned div above */}
                                        </div>
                                      ) : isEditing && (editingCell?.medId === med.id && editingCell?.day === day) ? (
                                        isVitalsEntry ? (
                                        <input
                                          type="text"
                                          autoFocus
                                            value={editingCellValue}
                                            onChange={(e) => setEditingCellValue(e.target.value)}
                                          onBlur={async (e) => {
                                              const enteredValue = e.target.value.trim()
                                              if (enteredValue) {
                                                await updateAdministration(med.id, day, 'Given', enteredValue)
                                            }
                                            setEditingCell(null)
                                              setEditingCellValue('')
                                          }}
                                          onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                const enteredValue = editingCellValue.trim()
                                                if (enteredValue) {
                                                  await updateAdministration(med.id, day, 'Given', enteredValue)
                                              }
                                              setEditingCell(null)
                                                setEditingCellValue('')
                                            } else if (e.key === 'Escape') {
                                              setEditingCell(null)
                                                setEditingCellValue('')
                                            }
                                          }}
                                            placeholder="Enter value"
                                            className="w-full text-center text-xs font-bold border-2 border-lasso-blue rounded px-1 py-1 dark:bg-gray-700 dark:text-white"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        ) : (
                                          (() => {
                                            const getUserInitials = () => {
                                              if (userProfile?.staff_initials) {
                                                return userProfile.staff_initials.toUpperCase()
                                              }
                                              if (userProfile?.full_name) {
                                                const names = userProfile.full_name.trim().split(/\s+/)
                                                if (names.length >= 2) {
                                                  return (names[0][0] + names[names.length - 1][0]).toUpperCase()
                                                } else if (names.length === 1) {
                                                  return names[0][0].toUpperCase()
                                                }
                                              }
                                              return null
                                            }
                                            const userInitials = getUserInitials()
                                            
                                            return (
                                              <select
                                                autoFocus
                                                value={initials || ''}
                                                onChange={async (e) => {
                                                  const selectedValue = e.target.value
                                                  if (selectedValue) {
                                                    await updateAdministration(med.id, day, 'Given', selectedValue)
                                                  }
                                                  setEditingCell(null)
                                                }}
                                                onBlur={() => setEditingCell(null)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Escape') {
                                                    setEditingCell(null)
                                                  }
                                                }}
                                                className="w-full text-center text-xs font-bold border-2 border-lasso-blue rounded px-1 py-1 dark:bg-gray-700 dark:text-white cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                <option value="">Select...</option>
                                                {userInitials && (
                                                  <option value={userInitials}>{userInitials} ({userProfile?.full_name || 'Your Initials'})</option>
                                                )}
                                                <option value="MC">MC (Medication Discontinued)</option>
                                                <option value="G">G (Given)</option>
                                                <option value="NG">NG (Not Given)</option>
                                                <option value="PRN">PRN (As Needed)</option>
                                                <option value="H">H (Held)</option>
                                                <option value="R">R (Refused)</option>
                                              </select>
                                            )
                                          })()
                                        )
                                      ) : (
                                        <div
                                          onClick={isEditing && !isDiscontinued ? () => {
                                            setEditingCell({ medId: med.id, day })
                                            setEditingCellValue(initials || '')
                                          } : undefined}
                                          className={`min-h-[24px] flex items-center justify-center ${
                                            isEditing && !isDiscontinued ? 'cursor-pointer hover:bg-lasso-blue/10 dark:hover:bg-lasso-blue/20' : ''
                                          }`}
                                        >
                                          {isMC && !isDiscontinued && (
                                            <div className="text-red-600 dark:text-red-400 font-bold text-xs">
                                              MC
                                            </div>
                                          )}
                                          {isGiven && !isMC && (
                                            <div className={`font-bold text-gray-800 dark:text-white ${isEditing ? 'cursor-text' : ''}`}>
                                              {initials || '—'}
                                            </div>
                                          )}
                                          {isNotGiven && initials && !isMC && (
                                            <div className="text-red-600 dark:text-red-400 font-bold">
                                              ○{initials}
                                            </div>
                                          )}
                                          {isPRN && (
                                            <div className="text-lasso-blue dark:text-lasso-blue font-bold text-xs">
                                              PRN
                                              {initials && <div className="text-xs">{initials}</div>}
                                            </div>
                                          )}
                                          {isNotGiven && !initials && !isMC && isEditing && (
                                            <div className="text-gray-400 cursor-text">—</div>
                                          )}
                                          {isNotGiven && !initials && !isMC && !isEditing && (
                                            <div className="text-gray-400">—</div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
          </div>

          {/* Patient Information Section - Box 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Row 1: Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Column 1: Diagnosis, Allergies, Name */}
              <div className="space-y-3 p-4 rounded-lg bg-lasso-navy/5 dark:bg-lasso-navy/10">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Diagnosis:</label>
                  <button
                    onClick={() => setShowEditPatientInfoModal(true)}
                    className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {marForm.diagnosis || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                  </button>
              </div>
                  <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Allergies:</label>
                  <button
                    onClick={() => setShowEditPatientInfoModal(true)}
                    className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {marForm.allergies || 'None'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                  </button>
                  </div>
                  <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Name:</label>
                    <div className="text-sm font-medium text-gray-800 dark:text-white">{marForm.patient_name}</div>
                  </div>
                </div>

              {/* Column 2: Diet, Physician Name, Phone Number */}
              <div className="space-y-3 p-4 rounded-lg bg-lasso-teal/5 dark:bg-lasso-teal/10">
                  <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">
                      DIET (Special Instructions, e.g. Texture, Bite Size, Position, etc.):
                    </label>
                  <button
                    onClick={() => setShowEditPatientInfoModal(true)}
                    className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors min-h-[60px]"
                  >
                    {marForm.diet || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Physician Name:</label>
                  <button
                    onClick={() => setShowEditPatientInfoModal(true)}
                    className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {marForm.physician_name || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Phone Number:</label>
                  <button
                    onClick={() => setShowEditPatientInfoModal(true)}
                    className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                  >
                    {marForm.physician_phone || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Four Columns */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {/* Column 1: Comments */}
              <div className="p-4 rounded-lg bg-lasso-blue/5 dark:bg-lasso-blue/10">
                <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Comments:</label>
                {editingComments ? (
                  <div className="space-y-2">
                      <textarea
                      value={commentsValue}
                      onChange={(e) => setCommentsValue(e.target.value)}
                      placeholder="Enter comments or notes..."
                      className="w-full text-sm text-gray-800 dark:text-white min-h-[80px] p-2 border-2 border-lasso-blue rounded dark:bg-gray-700 focus:ring-lasso-teal focus:border-lasso-teal resize-y"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={saveComments}
                        disabled={saving}
                        className="px-3 py-1.5 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded text-xs font-medium hover:from-lasso-teal hover:to-lasso-blue disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingComments(false)
                          setCommentsValue(marForm?.comments || '')
                        }}
                        disabled={saving}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        Cancel
                      </button>
                  </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingComments(true)
                      setCommentsValue(marForm?.comments || '')
                    }}
                    className="text-sm text-gray-800 dark:text-white min-h-[60px] p-2 border border-gray-200 dark:border-gray-600 rounded cursor-pointer hover:border-lasso-blue dark:hover:border-lasso-blue transition-colors"
                  >
                    {marForm?.comments ? (
                      <div className="whitespace-pre-wrap">{marForm.comments}</div>
                    ) : (
                      <span className="text-gray-400 italic">Click to add comments...</span>
                    )}
                  </div>
                )}
                </div>

              {/* Column 2: Instructions */}
              <div className="text-xs text-gray-700 dark:text-gray-300 space-y-1 p-4 rounded-lg bg-lasso-navy/5 dark:bg-lasso-navy/10">
                <div><strong className="font-bold uppercase">Instructions:</strong></div>
                    <div>A. Put initials in appropriate box when medication is given.</div>
                    <div>B. Circle initials when not given.</div>
                    <div>C. State reason for refusal / omission on back of form.</div>
                    <div>D. PRN Medications: Reason given and results must be noted on back of form.</div>
                  </div>

              {/* Column 3: Legend */}
              <div className="text-xs text-gray-700 dark:text-gray-300 p-4 rounded-lg bg-lasso-teal/5 dark:bg-lasso-teal/10">
                <div><strong className="font-bold uppercase">Legend:</strong></div>
                <div className="mt-1 space-y-0.5">
                  {(() => {
                    // Generate user initials from full_name if staff_initials not set
                    const getUserInitials = () => {
                      if (userProfile?.staff_initials) {
                        return userProfile.staff_initials.toUpperCase()
                      }
                      if (userProfile?.full_name) {
                        const names = userProfile.full_name.trim().split(/\s+/)
                        if (names.length >= 2) {
                          return (names[0][0] + names[names.length - 1][0]).toUpperCase()
                        } else if (names.length === 1) {
                          return names[0][0].toUpperCase()
                        }
                      }
                      return null
                    }
                    const userInitials = getUserInitials()
                    
                    return (
                      <>
                        {userInitials && (
                          <div className="font-semibold">{userInitials} = {userProfile?.full_name || 'Your Initials'}</div>
                        )}
                        <div>MC = Medication Discontinued</div>
                        <div>G = Given</div>
                        <div>NG = Not Given</div>
                        <div>PRN = As Needed</div>
                        <div>H = Held</div>
                        <div>R = Refused</div>
                      </>
                    )
                  })()}
                    </div>
              </div>

              {/* Column 4: Date of Birth, Sex */}
              <div className="space-y-3 text-xs p-4 rounded-lg bg-lasso-blue/5 dark:bg-lasso-blue/10">
                    <div>
                  <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Date of Birth:</label>
                      <div className="text-gray-800 dark:text-white">{new Date(marForm.date_of_birth).toLocaleDateString()}</div>
                    </div>
                    <div>
                  <label className="block font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Sex:</label>
                      <div className="text-gray-800 dark:text-white">{marForm.sex}</div>
                    </div>
                  </div>
                </div>
              </div>

          {/* PRN Records Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  PRN Records
                </h2>
                <button
                  onClick={() => setShowAddPRNModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                >
                  + Add PRN Record
                </button>
            </div>

              {prnRecords.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                  No PRN records yet. Click "+ Add PRN Record" to add one.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Entry #</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Date</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Time</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Initials</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Medication</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Reason/Indication</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Result</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Staff Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prnRecords.map((prn) => (
                        <tr key={prn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white">
                            {prn.entry_number || '—'}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white">
                            {new Date(prn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td 
                            className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePRNFieldEdit(prn.id, 'hour', prn.hour)}
                          >
                            {editingPRNField?.recordId === prn.id && editingPRNField?.field === 'hour' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'hour')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'hour')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., 14:00 or 2:00 PM"
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <span>{prn.hour || '—'}</span>
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${
                              prn.hour && prn.result ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={() => {
                              if (prn.hour && prn.result) {
                                // If initials is empty, auto-populate and save immediately
                                if (!prn.initials) {
                                  let userInitials = ''
                                  if (userProfile?.staff_initials) {
                                    userInitials = userProfile.staff_initials.toUpperCase()
                                  } else if (userProfile?.full_name) {
                                    const names = userProfile.full_name.trim().split(/\s+/)
                                    if (names.length >= 2) {
                                      userInitials = (names[0][0] + names[names.length - 1][0]).toUpperCase()
                                    } else if (names.length === 1) {
                                      userInitials = names[0][0].toUpperCase()
                                    }
                                  }
                                  if (userInitials) {
                                    updatePRNRecord(prn.id, 'initials', userInitials)
                                    return
                                  }
                                }
                                handlePRNFieldEdit(prn.id, 'initials', prn.initials)
                              }
                            }}
                            title={!prn.hour || !prn.result ? 'Time and Result must be filled first' : ''}
                          >
                            {editingPRNField?.recordId === prn.id && editingPRNField?.field === 'initials' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value.toUpperCase())}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'initials')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'initials')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., JD"
                                  maxLength={4}
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <span>{prn.initials || '—'}</span>
                            )}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white">
                            {prn.medication || '—'}
                          </td>
                          <td 
                            className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePRNFieldEdit(prn.id, 'reason', prn.reason)}
                          >
                            {editingPRNField?.recordId === prn.id && editingPRNField?.field === 'reason' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'reason')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'reason')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., Headache, Pain, Refused"
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span>{prn.reason || '—'}</span>
                                  {prn.reason && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setEditingPRNNote({ recordId: prn.id, note: prn.note })
                                        setShowPRNNoteModal(true)
                                      }}
                                      className="text-xs px-2 py-1 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-1 whitespace-nowrap"
                                      title={prn.note ? 'Edit note' : 'Add note'}
                                    >
                                      {prn.note ? '📝' : '+'} note
                                    </button>
                                  )}
                                </div>
                                {prn.note && (
                                  <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                                    {prn.note}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td 
                            className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                            onClick={() => handlePRNFieldEdit(prn.id, 'result', prn.result)}
                          >
                            {editingPRNField?.recordId === prn.id && editingPRNField?.field === 'result' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'result')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'result')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., Pain relieved within 30 mins"
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <span>{prn.result || '—'}</span>
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${
                              prn.initials ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50'
                            }`}
                            onClick={() => {
                              if (prn.initials) {
                                handlePRNFieldEdit(prn.id, 'staff_signature', prn.staff_signature)
                              }
                            }}
                            title={!prn.initials ? 'Initials must be set first' : ''}
                          >
                            {editingPRNField?.recordId === prn.id && editingPRNField?.field === 'staff_signature' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'staff_signature')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'staff_signature')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., J. Smith, RN"
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <span>{prn.staff_signature || '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      </div>

      {/* Add Medication/Vitals Modal */}
      {showAddMedModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddMedModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Medication or Vitals</h2>
              <button
                onClick={() => setShowAddMedModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddMedicationOrVitalsForm
              onSubmit={async (data) => {
                try {
                  if (data.type === 'medication') {
                    await addMedication(data.medicationData!)
                    setShowAddMedModal(false)
                  } else {
                    await addVitals(data.vitalsData!)
                  setShowAddMedModal(false)
                  }
                } catch (err) {
                  console.error('Error adding entry:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => setShowAddMedModal(false)}
              defaultStartDate={new Date().toISOString().split('T')[0]}
              defaultHour={new Date().toTimeString().slice(0, 5)}
              defaultInitials={(() => {
                // Generate initials from full_name if staff_initials not set
                if (userProfile?.staff_initials) {
                  return userProfile.staff_initials
                }
                if (userProfile?.full_name) {
                  const names = userProfile.full_name.trim().split(/\s+/)
                  if (names.length >= 2) {
                    return (names[0][0] + names[names.length - 1][0]).toUpperCase()
                  } else if (names.length === 1) {
                    return names[0][0].toUpperCase()
                  }
                }
                return ''
              })()}
            />
          </div>
        </div>
      )}

      {/* Edit Patient Info Modal */}
      {showEditPatientInfoModal && marForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditPatientInfoModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Edit Patient Information</h2>
              <button
                onClick={() => setShowEditPatientInfoModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.currentTarget)
                const updates = {
                  diagnosis: formData.get('diagnosis') as string || null,
                  allergies: formData.get('allergies') as string || 'None',
                  diet: formData.get('diet') as string || null,
                  physician_name: formData.get('physician_name') as string || null,
                  physician_phone: formData.get('physician_phone') as string || null,
                  facility_name: formData.get('facility_name') as string || null
                }
                
                // Update mar_forms table
                const { error: marError } = await supabase
                  .from('mar_forms')
                  .update(updates)
                  .eq('id', marFormId)
                
                if (marError) throw marError
                
                if (marForm) {
                  setMarForm({ ...marForm, ...updates } as MARForm)
                }
                setShowEditPatientInfoModal(false)
                setMessage('Patient information updated successfully!')
                setTimeout(() => setMessage(''), 3000)
              } catch (err: any) {
                setError(err.message || 'Failed to update patient information')
                setTimeout(() => setError(''), 5000)
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diagnosis:</label>
                <input
                  type="text"
                  name="diagnosis"
                  defaultValue={marForm.diagnosis || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allergies:</label>
                <input
                  type="text"
                  name="allergies"
                  defaultValue={marForm.allergies || 'None'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  DIET (Special Instructions):
                </label>
                <textarea
                  name="diet"
                  rows={3}
                  defaultValue={marForm.diet || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physician Name:</label>
                <input
                  type="text"
                  name="physician_name"
                  defaultValue={marForm.physician_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Physician Phone:</label>
                <input
                  type="tel"
                  name="physician_phone"
                  defaultValue={marForm.physician_phone || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Facility Name:</label>
                <input
                  type="text"
                  name="facility_name"
                  defaultValue={marForm.facility_name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditPatientInfoModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* Vital Signs Modal */}
      {showVitalSignsModal && marForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowVitalSignsModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Vital Signs</h2>
              <button
                onClick={() => setShowVitalSignsModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddMedicationOrVitalsForm
              onSubmit={async (data) => {
                try {
                  if (data.type === 'vitals' && data.vitalsData) {
                    await addVitals(data.vitalsData)
                    setShowVitalSignsModal(false)
                  }
                } catch (err) {
                  console.error('Error adding vital signs:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => setShowVitalSignsModal(false)}
              defaultStartDate={new Date().toISOString().split('T')[0]}
              defaultHour={new Date().toTimeString().slice(0, 5)}
              defaultInitials={(() => {
                // Generate initials from full_name if staff_initials not set
                if (userProfile?.staff_initials) {
                  return userProfile.staff_initials
                }
                if (userProfile?.full_name) {
                  const names = userProfile.full_name.trim().split(/\s+/)
                  if (names.length >= 2) {
                    return (names[0][0] + names[names.length - 1][0]).toUpperCase()
                  } else if (names.length === 1) {
                    return names[0][0].toUpperCase()
                  }
                }
                return ''
              })()}
              defaultType="vitals"
            />
          </div>
        </div>
      )}

      {/* Add PRN Record Modal */}
      {showAddPRNModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddPRNModal(false)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add PRN Record</h2>
              <button
                onClick={() => setShowAddPRNModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddPRNRecordForm
              onSubmit={async (prnData) => {
                try {
                  await addPRNRecord(prnData)
                  setShowAddPRNModal(false)
                } catch (err) {
                  console.error('Error adding PRN record:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => setShowAddPRNModal(false)}
              defaultDate={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}

      {/* PRN Note Modal */}
      {showPRNNoteModal && editingPRNNote && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPRNNoteModal(false)
              setEditingPRNNote(null)
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add Note</h2>
              <button
                onClick={() => {
                  setShowPRNNoteModal(false)
                  setEditingPRNNote(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Note for Reason/Indication
              </label>
              <textarea
                value={editingPRNNote.note || ''}
                onChange={(e) => setEditingPRNNote({ ...editingPRNNote, note: e.target.value })}
                placeholder="Enter additional notes about this reason/indication..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowPRNNoteModal(false)
                  setEditingPRNNote(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingPRNNote) {
                    await updatePRNRecord(editingPRNNote.recordId, 'note', editingPRNNote.note?.trim() || null)
                    setShowPRNNoteModal(false)
                    setEditingPRNNote(null)
                  }
                }}
                className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelLeave()
            }
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Leave This Page?</h2>
              <button
                onClick={handleCancelLeave}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to leave this page? Any unsaved changes may be lost.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelLeave}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Stay on Page
              </button>
              <button
                onClick={handleConfirmLeave}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Leave Page
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}

// Add Medication or Vitals Form Component
function AddMedicationOrVitalsForm({ 
  onSubmit, 
  onCancel,
  defaultStartDate,
  defaultHour,
  defaultInitials,
  defaultType = 'medication'
}: { 
  onSubmit: (data: {
    type: 'medication' | 'vitals'
    medicationData?: {
      medicationName: string
      dosage: string
      startDate: string
      stopDate: string | null
      hour: string
      notes: string | null
      initials: string
      frequency: number
      times?: string[]
    }
    vitalsData?: {
      notes: string
      initials: string
      startDate: string
      stopDate: string | null
      hour: string
    }
  }) => Promise<void>
  onCancel: () => void
  defaultStartDate: string
  defaultHour: string
  defaultInitials: string
  defaultType?: 'medication' | 'vitals'
}) {
  const [entryType, setEntryType] = useState<'medication' | 'vitals'>(defaultType)
  const [initialsType, setInitialsType] = useState<'initials' | 'legend'>('initials')
  const [selectedLegend, setSelectedLegend] = useState<string>('')
  const [medicationData, setMedicationData] = useState({
    medicationName: '',
    dosage: '',
    startDate: defaultStartDate,
    stopDate: '',
    hour: defaultHour,
    notes: '',
    initials: defaultInitials,
    frequency: 1, // Number of times per day
    times: [] as string[] // Array of times for each frequency
  })
  const [vitalsData, setVitalsData] = useState({
    notes: '',
    initials: '', // For vitals, this is just a default text value, not initials
    startDate: defaultStartDate,
    stopDate: '',
    hour: defaultHour
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Default legends for MAR forms
  const defaultLegends = [
    { code: 'MC', description: 'Medication Discontinued' },
    { code: 'G', description: 'Given' },
    { code: 'NG', description: 'Not Given' },
    { code: 'PRN', description: 'As Needed' },
    { code: 'H', description: 'Held' },
    { code: 'R', description: 'Refused' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (entryType === 'medication') {
      if (!medicationData.medicationName || !medicationData.dosage || !medicationData.startDate) {
        alert('Please fill in all required fields')
        return
      }
      // Validate times for frequency > 1
      if (medicationData.frequency > 1) {
        // Ensure times array is properly filled
        const times = Array.from({ length: medicationData.frequency }, (_, i) => 
          medicationData.times[i] || ''
        )
        if (times.some(t => !t.trim())) {
          alert('Please enter all administration times')
          return
        }
      } else {
        if (!medicationData.hour) {
          alert('Please enter administration time')
          return
        }
      }
      // Validate initials/legend selection
      if (initialsType === 'initials' && !medicationData.initials.trim()) {
        alert('Please enter initials or select a legend')
        return
      }
      if (initialsType === 'legend' && !selectedLegend) {
        alert('Please select a legend code')
        return
      }
    } else {
      if (!vitalsData.notes.trim() || !vitalsData.startDate || !vitalsData.hour) {
        alert('Please fill in all required fields')
        return
      }
    }

    setIsSubmitting(true)
    try {
      // Determine the final initials value based on selection
      const finalInitials = initialsType === 'initials' 
        ? medicationData.initials.trim().toUpperCase()
        : selectedLegend

      // For vitals, use the text value as-is (no uppercase conversion, no legend)
      const finalVitalsInitials = vitalsData.initials.trim()

      // Collect times for frequency > 1
      const times = medicationData.frequency > 1 
        ? Array.from({ length: medicationData.frequency }, (_, i) => 
            medicationData.times[i] || medicationData.hour
          )
        : undefined

      await onSubmit({
        type: entryType,
        medicationData: entryType === 'medication' ? {
          medicationName: medicationData.medicationName,
          dosage: medicationData.dosage,
          startDate: medicationData.startDate,
          stopDate: medicationData.stopDate || null,
          hour: medicationData.hour,
          notes: medicationData.notes || null,
          initials: finalInitials,
          frequency: medicationData.frequency,
          times: times
        } : undefined,
        vitalsData: entryType === 'vitals' ? {
          notes: vitalsData.notes,
          initials: finalVitalsInitials,
          startDate: vitalsData.startDate,
          stopDate: vitalsData.stopDate || null,
          hour: vitalsData.hour
        } : undefined
      })
      // Reset form
      setMedicationData({
        medicationName: '',
        dosage: '',
        startDate: defaultStartDate,
        stopDate: '',
        hour: defaultHour,
        notes: '',
        initials: defaultInitials,
        frequency: 1,
        times: []
      })
      setVitalsData({
        notes: '',
        initials: '', // Reset to empty for vitals
        startDate: defaultStartDate,
        stopDate: '',
        hour: defaultHour
      })
      setInitialsType('initials')
      setSelectedLegend('')
    } catch (err) {
      console.error('Error submitting entry:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Type *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              name="entryType"
              value="medication"
              checked={entryType === 'medication'}
              onChange={(e) => setEntryType(e.target.value as 'medication' | 'vitals')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Medication</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="entryType"
              value="vitals"
              checked={entryType === 'vitals'}
              onChange={(e) => setEntryType(e.target.value as 'medication' | 'vitals')}
              className="mr-2"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Vitals</span>
          </label>
        </div>
      </div>

      {/* Medication Fields */}
      {entryType === 'medication' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Medication Name *
            </label>
            <input
              type="text"
              value={medicationData.medicationName}
              onChange={(e) => setMedicationData({ ...medicationData, medicationName: e.target.value })}
              required
              placeholder="e.g., Lisinopril 10 mg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Dosage *
            </label>
            <input
              type="text"
              value={medicationData.dosage}
              onChange={(e) => setMedicationData({ ...medicationData, dosage: e.target.value })}
              required
              placeholder="e.g., 10 mg PO daily"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={medicationData.startDate}
                onChange={(e) => setMedicationData({ ...medicationData, startDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stop Date (optional)
              </label>
              <input
                type="date"
                value={medicationData.stopDate}
                onChange={(e) => setMedicationData({ ...medicationData, stopDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Frequency (Times per Day) *
            </label>
            <select
              value={medicationData.frequency}
              onChange={(e) => {
                const freq = parseInt(e.target.value, 10)
                // Initialize times array with current hour or empty strings
                const newTimes = Array.from({ length: freq }, (_, i) => 
                  medicationData.times[i] || (i === 0 ? medicationData.hour : '')
                )
                setMedicationData({ ...medicationData, frequency: freq, times: newTimes })
              }}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num} time{num > 1 ? 's' : ''} per day</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select how many times per day this medication should be given</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Administration Time(s) *
            </label>
            {medicationData.frequency === 1 ? (
              <>
                <input
                  type="text"
                  value={medicationData.hour}
                  onChange={(e) => setMedicationData({ ...medicationData, hour: e.target.value })}
                  required
                  placeholder="e.g., 09:00 or 9:00 AM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: HH:MM or HH:MM AM/PM</p>
              </>
            ) : (
              <div className="space-y-2">
                {Array.from({ length: medicationData.frequency }, (_, i) => (
                  <div key={i}>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Time {i + 1}:
                    </label>
                    <input
                      type="text"
                      value={medicationData.times[i] || ''}
                      onChange={(e) => {
                        const newTimes = [...medicationData.times]
                        newTimes[i] = e.target.value
                        // Ensure array is the right length
                        while (newTimes.length < medicationData.frequency) {
                          newTimes.push('')
                        }
                        setMedicationData({ 
                          ...medicationData, 
                          times: newTimes,
                          hour: i === 0 ? e.target.value : medicationData.hour // Keep first time as default hour
                        })
                      }}
                      required
                      placeholder={`e.g., ${i === 0 ? '09:00' : i === 1 ? '13:00' : i === 2 ? '18:00' : '21:00'}`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter the time for each administration. You can edit these later in the table.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={medicationData.notes}
              onChange={(e) => setMedicationData({ ...medicationData, notes: e.target.value })}
              placeholder="Additional notes about this medication"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Initials or Legend *
            </label>
            
            {/* Radio buttons to choose between Initials or Legend */}
            <div className="flex gap-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="initialsType"
                  value="initials"
                  checked={initialsType === 'initials'}
                  onChange={(e) => {
                    setInitialsType('initials')
                    setSelectedLegend('')
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Initials</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="initialsType"
                  value="legend"
                  checked={initialsType === 'legend'}
                  onChange={(e) => {
                    setInitialsType('legend')
                    setMedicationData({ ...medicationData, initials: '' })
                  }}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Legend</span>
              </label>
            </div>

            {/* Show initials input if "Initials" is selected */}
            {initialsType === 'initials' && (
              <div>
                <input
                  type="text"
                  value={medicationData.initials}
                  onChange={(e) => setMedicationData({ ...medicationData, initials: e.target.value.toUpperCase() })}
                  required
                  placeholder="e.g., JD or JS"
                  maxLength={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This will be used as default when you manually enter initials in individual day cells</p>
              </div>
            )}

            {/* Show legend radio buttons if "Legend" is selected */}
            {initialsType === 'legend' && (
              <div>
                <div className="grid grid-cols-2 gap-3">
                  {defaultLegends.map((legend) => (
                    <label key={legend.code} className="flex items-center p-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        name="selectedLegend"
                        value={legend.code}
                        checked={selectedLegend === legend.code}
                        onChange={(e) => setSelectedLegend(e.target.value)}
                        className="mr-2"
                      />
                      <div className="flex-1">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{legend.code}</span>
                        <span className="text-xs text-gray-600 dark:text-gray-400 ml-2">- {legend.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Select a legend code to use as the default marker</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Vitals Fields */}
      {entryType === 'vitals' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes *
            </label>
            <textarea
              value={vitalsData.notes}
              onChange={(e) => setVitalsData({ ...vitalsData, notes: e.target.value })}
              required
              placeholder="e.g., BP (sprinkle salt on food if BP low <80/60), Temperature, Weight, etc."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Enter vital signs instructions or notes (e.g., BP, Temperature, Weight tracking instructions)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={vitalsData.startDate}
                onChange={(e) => setVitalsData({ ...vitalsData, startDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stop Date (optional)
              </label>
              <input
                type="date"
                value={vitalsData.stopDate}
                onChange={(e) => setVitalsData({ ...vitalsData, stopDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Administration Time *
            </label>
            <input
              type="text"
              value={vitalsData.hour}
              onChange={(e) => setVitalsData({ ...vitalsData, hour: e.target.value })}
              required
              placeholder="e.g., 09:00 or 9:00 AM"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Format: HH:MM or HH:MM AM/PM</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Default Entry Value (Optional)
            </label>
                <input
                  type="text"
                  value={vitalsData.initials}
              onChange={(e) => setVitalsData({ ...vitalsData, initials: e.target.value })}
              placeholder="e.g., 98.6°F, 120/80, 72 bpm, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: Enter a default value. Nurses can enter any text when clicking on day cells.</p>
          </div>
        </>
      )}

      {/* Legends Section */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">MAR Legends</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {defaultLegends.map((legend) => (
            <div key={legend.code} className="flex items-start">
              <span className="font-semibold text-gray-800 dark:text-gray-200 mr-2 min-w-[2rem]">{legend.code}:</span>
              <span className="text-gray-600 dark:text-gray-400">{legend.description}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
          These codes can be used when marking medication administration in the daily grid.
        </p>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : entryType === 'medication' ? 'Add Medication' : 'Add Vitals'}
        </button>
      </div>
    </form>
  )
}

// Editable Hour Field Component
function EditableHourField({ 
  medication, 
  onUpdate 
}: { 
  medication: MARMedication
  onUpdate: (newHour: string) => Promise<void>
}) {
  const [localHour, setLocalHour] = useState(medication.hour || '')
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setLocalHour(medication.hour || '')
  }, [medication.hour])

  const handleBlur = async () => {
    setIsEditing(false)
    const trimmed = localHour.trim()
    if (trimmed !== medication.hour) {
      await onUpdate(trimmed)
    }
  }

  return (
    <input
      type="text"
      value={localHour}
      onChange={(e) => setLocalHour(e.target.value)}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      placeholder="e.g., 09:00"
      className="w-full text-center text-xs border border-gray-300 rounded px-1 py-1 dark:bg-gray-700 dark:text-white dark:border-gray-600"
      onClick={(e) => e.stopPropagation()}
    />
  )
}

// Add PRN Record Form Component
function AddPRNRecordForm({ 
  onSubmit, 
  onCancel,
  defaultDate
}: { 
  onSubmit: (data: {
    date: string
    hour: string | null
    initials: string | null
    medication: string
    reason: string
    result: string | null
    staffSignature: string | null
  }) => Promise<void>
  onCancel: () => void
  defaultDate: string
}) {
  const [formData, setFormData] = useState({
    date: defaultDate,
    medication: '',
    reason: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.date || !formData.medication || !formData.reason) {
      alert('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        date: formData.date,
        hour: null,
        medication: formData.medication,
        reason: formData.reason,
        result: null,
        initials: null,
        staffSignature: null
      })
      // Reset form
      setFormData({
        date: defaultDate,
        medication: '',
        reason: ''
      })
    } catch (err) {
      console.error('Error submitting PRN record:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date *
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Medication Name *
        </label>
        <input
          type="text"
          value={formData.medication}
          onChange={(e) => setFormData({ ...formData, medication: e.target.value })}
          required
          placeholder="e.g., Tylenol 500 mg"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Reason/Indication *
        </label>
        <input
          type="text"
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          required
          placeholder="e.g., Headache, Pain, Refused"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : 'Add PRN Record'}
        </button>
      </div>
    </form>
  )
}
