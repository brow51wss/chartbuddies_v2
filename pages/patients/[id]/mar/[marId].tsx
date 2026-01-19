import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import TimeInput, { formatTimeDisplay } from '../../../../components/TimeInput'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile, signOut } from '../../../../lib/auth'
import type { MARForm, MARMedication, MARAdministration, MARPRNRecord, MARVitalSigns, MARCustomLegend } from '../../../../types/mar'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// Context for passing drag handle props to children (declared first)
const SortableRowContext = React.createContext<{
  listeners: any
  attributes: any
  setActivatorNodeRef: (node: HTMLElement | null) => void
  isDragging: boolean
} | null>(null)

// Sortable table row wrapper component
function SortableTableRow({ 
  id, 
  children, 
  className,
  onMouseMove,
  onMouseLeave,
}: { 
  id: string
  children: React.ReactNode
  className?: string
  onMouseMove?: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onMouseLeave?: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`${className || ''} ${isDragging ? '!bg-blue-100 dark:!bg-blue-900/50 shadow-lg' : ''}`}
      onMouseMove={isDragging ? undefined : onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      {/* Inject drag handle ref and listeners via context for child components */}
      <SortableRowContext.Provider value={{ listeners, attributes, setActivatorNodeRef, isDragging }}>
        {children}
      </SortableRowContext.Provider>
    </tr>
  )
}

// Hook to get drag handle props in child components
function useDragHandle() {
  const context = React.useContext(SortableRowContext)
  return context
}

// Drag handle button component that uses context
function DragHandleButton({ medId }: { medId: string }) {
  const dragContext = useDragHandle()
  
  if (!dragContext) return null
  
  const { listeners, attributes, setActivatorNodeRef, isDragging } = dragContext
  
  return (
    <div
      ref={setActivatorNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-all touch-none ${isDragging ? 'cursor-grabbing' : ''}`}
      title="Drag to reorder"
      aria-label="Drag to reorder row"
    >
      {/* 6-dot grip icon - standard drag handle pattern */}
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </div>
  )
}

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
  const [showMedicationParameterModal, setShowMedicationParameterModal] = useState(false)
  const [editingMedicationParameter, setEditingMedicationParameter] = useState<{ medicationId: string; parameter: string | null } | null>(null)
  // Row hover state for add-between-rows feature
  const [rowHover, setRowHover] = useState<{ rowId: string; position: 'top' | 'bottom' } | null>(null)
  // Insert position for adding medication/vitals between rows
  const [insertPosition, setInsertPosition] = useState<{ targetMedId: string; position: 'above' | 'below' } | null>(null)
  // Delete confirmation state
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState<{ id: string; name: string; dosage: string; isVitals: boolean } | null>(null)
  const [showAdministrationNoteModal, setShowAdministrationNoteModal] = useState(false)
  const [editingAdministrationNote, setEditingAdministrationNote] = useState<{ medId: string; day: number; note: string | null } | null>(null)
  const [customLegends, setCustomLegends] = useState<Array<{ id: string; code: string; description: string }>>([])
  const [showCustomLegendModal, setShowCustomLegendModal] = useState(false)
  const [editingCustomLegend, setEditingCustomLegend] = useState<{ id: string | null; code: string; description: string } | null>(null)
  const allowNavigationRef = useRef(false)

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
      // If navigation is allowed (user confirmed), don't block
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false // Reset after allowing navigation
        return
      }
      
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
    const handleRouteChangeStart = (url: string) => {
      // Don't show modal if navigating to the same page
      if (url === router.asPath) return
      
      // If navigation is allowed (user confirmed), don't block
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false // Reset after allowing navigation
        return
      }
      
      // Show confirmation modal
      setPendingNavigation(url)
      setShowLeaveConfirmModal(true)
      
      // Prevent navigation
      router.events.emit('routeChangeError', new Error('Navigation cancelled'), url)
      throw 'Navigation cancelled'
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
    
    // Allow navigation to proceed
    allowNavigationRef.current = true
    
    // Small delay to ensure modal closes before navigation
    await new Promise(resolve => setTimeout(resolve, 100))
    
    if (navUrl) {
      // Use window.location for external navigation or router.push for internal
      if (navUrl.startsWith('http')) {
        window.location.href = navUrl
      } else {
        // Navigation will be allowed because allowNavigationRef.current is true
        router.push(navUrl)
      }
    } else {
      // Browser back button - go back
      // Remove the popstate listener temporarily to allow navigation
      window.history.back()
    }
  }

  const handleCancelLeave = () => {
    setShowLeaveConfirmModal(false)
    setPendingNavigation(null)
  }

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddMedModal) {
          setShowAddMedModal(false)
        } else if (showEditPatientInfoModal) {
          setShowEditPatientInfoModal(false)
        } else if (showVitalSignsModal) {
          setShowVitalSignsModal(false)
        } else if (showAddPRNModal) {
          setShowAddPRNModal(false)
        } else if (showPRNNoteModal) {
          setShowPRNNoteModal(false)
          setEditingPRNNote(null)
        } else if (showMedicationParameterModal) {
          setShowMedicationParameterModal(false)
          setEditingMedicationParameter(null)
        } else if (showAdministrationNoteModal) {
          setShowAdministrationNoteModal(false)
          setEditingAdministrationNote(null)
        } else if (showCustomLegendModal) {
          setShowCustomLegendModal(false)
          setEditingCustomLegend(null)
        } else if (showDeleteConfirmModal) {
          setShowDeleteConfirmModal(false)
          setDeletingEntry(null)
        } else if (showLeaveConfirmModal) {
          handleCancelLeave()
        }
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [showAddMedModal, showEditPatientInfoModal, showVitalSignsModal, showAddPRNModal, showPRNNoteModal, showMedicationParameterModal, showAdministrationNoteModal, showCustomLegendModal, showDeleteConfirmModal, showLeaveConfirmModal])

  const loadUserProfile = async () => {
    const profile = await getCurrentUserProfile()
    setUserProfile(profile)
  }

  const loadCustomLegends = async () => {
    if (!userProfile?.id) return
    
    try {
      const { data, error } = await supabase
        .from('mar_custom_legends')
        .select('*')
        .eq('user_id', userProfile.id)
        .order('code', { ascending: true })

      if (error) throw error
      setCustomLegends(data || [])
    } catch (err) {
      console.error('Error loading custom legends:', err)
    }
  }

  // Load custom legends when userProfile changes
  useEffect(() => {
    if (userProfile?.id) {
      loadCustomLegends()
    }
  }, [userProfile?.id])

  const saveCustomLegend = async (code: string, description: string, id: string | null = null) => {
    if (!userProfile?.id) return

    try {
      if (id) {
        // Update existing
        const { error } = await supabase
          .from('mar_custom_legends')
          .update({ code: code.toUpperCase(), description, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('user_id', userProfile.id)

        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('mar_custom_legends')
          .insert({ user_id: userProfile.id, code: code.toUpperCase(), description })

        if (error) throw error
      }

      await loadCustomLegends()
      setShowCustomLegendModal(false)
      setEditingCustomLegend(null)
    } catch (err: any) {
      console.error('Error saving custom legend:', err)
      alert(err.message || 'Failed to save custom legend')
    }
  }

  const deleteCustomLegend = async (id: string) => {
    if (!userProfile?.id) return

    if (!confirm('Are you sure you want to delete this custom legend?')) return

    try {
      const { error } = await supabase
        .from('mar_custom_legends')
        .delete()
        .eq('id', id)
        .eq('user_id', userProfile.id)

      if (error) throw error
      await loadCustomLegends()
    } catch (err: any) {
      console.error('Error deleting custom legend:', err)
      alert(err.message || 'Failed to delete custom legend')
    }
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

      // If DC (Discontinued) was selected, mark all future days as discontinued
      if (initials === 'DC' && status === 'Given') {
        // Mark all future days (day + 1 to 31) as discontinued
        const futureDays = []
        for (let futureDay = day + 1; futureDay <= 31; futureDay++) {
          futureDays.push({
            mar_medication_id: medId,
            day_number: futureDay,
            status: 'Given',
            initials: 'DC',
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

  const updateMedicationParameter = async (medicationId: string, parameter: string | null) => {
    if (!marFormId) return
    
    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('mar_medications')
        .update({ parameter: parameter?.trim() || null })
        .eq('id', medicationId)

      if (error) throw error

      await loadMARForm()
      setMessage('Medication parameter updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update medication parameter')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const updateAdministrationNote = async (medId: string, day: number, note: string | null) => {
    if (!marFormId) return
    
    try {
      setSaving(true)
      
      const existingAdmin = administrations[medId]?.[day]
      
      if (existingAdmin) {
        const { error } = await supabase
          .from('mar_administrations')
          .update({ notes: note?.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', existingAdmin.id)

        if (error) throw error
      } else {
        // If no administration exists, we need to create one with "R" status
        // This shouldn't normally happen, but handle it just in case
        const { error } = await supabase
          .from('mar_administrations')
          .insert({
            mar_medication_id: medId,
            day_number: day,
            status: 'Given',
            initials: 'R',
            notes: note?.trim() || null
          })

        if (error) throw error
      }

      await loadMARForm()
      setMessage('Administration note updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update administration note')
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
    route: string | null
    frequencyDisplay: string | null
  }, position?: { targetMedId: string; position: 'above' | 'below' } | null) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      const frequency = medData.frequency || 1
      const times = medData.times || []
      
      // Calculate display_order based on insert position
      let displayOrder: number
      if (position) {
        // First, ensure ALL existing medications have display_order set
        // This prevents sorting issues when mixing entries with and without display_order
        const medsNeedingOrder = medications.filter(m => m.display_order == null)
        if (medsNeedingOrder.length > 0) {
          // Assign display_order to all existing meds based on their CURRENT visual order
          // (which is the order in the medications array)
          const updates = medications.map((med, index) => ({
            id: med.id,
            display_order: (index + 1) * 10
          }))
          
          // Update all medications with their display_order
          for (const update of updates) {
            await supabase
              .from('mar_medications')
              .update({ display_order: update.display_order })
              .eq('id', update.id)
          }
          
          // Update local state to reflect new display_orders
          medications.forEach((med, index) => {
            med.display_order = (index + 1) * 10
          })
        }
        
        const targetMed = medications.find(m => m.id === position.targetMedId)
        if (targetMed) {
          const targetOrder = targetMed.display_order || 0
          
          if (position.position === 'above') {
            // Find the medication above the target (if any) to calculate the midpoint
            const sortedMeds = [...medications].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            const targetIndex = sortedMeds.findIndex(m => m.id === position.targetMedId)
            const prevMed = targetIndex > 0 ? sortedMeds[targetIndex - 1] : null
            const prevOrder = prevMed?.display_order || 0
            displayOrder = Math.floor((prevOrder + targetOrder) / 2)
            // If there's no gap, we need to renumber (for now, just use target - 1)
            if (displayOrder === prevOrder || displayOrder === targetOrder) {
              displayOrder = targetOrder - 1
            }
          } else {
            // Below - find the next medication
            const sortedMeds = [...medications].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            const targetIndex = sortedMeds.findIndex(m => m.id === position.targetMedId)
            const nextMed = targetIndex < sortedMeds.length - 1 ? sortedMeds[targetIndex + 1] : null
            const nextOrder = nextMed?.display_order || targetOrder + 20
            displayOrder = Math.floor((targetOrder + nextOrder) / 2)
            // If there's no gap, use target + 1
            if (displayOrder === targetOrder || displayOrder === nextOrder) {
              displayOrder = targetOrder + 1
            }
          }
        } else {
          // Fallback: add at the end
          const maxOrder = Math.max(...medications.map(m => m.display_order || 0), 0)
          displayOrder = maxOrder + 10
        }
      } else {
        // No position specified - add at the end
        const maxOrder = Math.max(...medications.map(m => m.display_order || 0), 0)
        displayOrder = maxOrder + 10
      }
      
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
          notes: medData.notes,
          route: medData.route,
          frequency: frequency,
          frequency_display: medData.frequencyDisplay,
          display_order: displayOrder + i // Each frequency gets consecutive orders
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
      setMessage(`Medication added successfully${freqMessage}!`)
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
    hour: string | null
  }, position?: { targetMedId: string; position: 'above' | 'below' } | null) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      // Calculate display_order based on insert position
      let displayOrder: number
      if (position) {
        // First, ensure ALL existing medications have display_order set
        const medsNeedingOrder = medications.filter(m => m.display_order == null)
        if (medsNeedingOrder.length > 0) {
          // Assign display_order to all existing meds based on their CURRENT visual order
          const updates = medications.map((med, index) => ({
            id: med.id,
            display_order: (index + 1) * 10
          }))
          
          // Update all medications with their display_order
          for (const update of updates) {
            await supabase
              .from('mar_medications')
              .update({ display_order: update.display_order })
              .eq('id', update.id)
          }
          
          // Update local state to reflect new display_orders
          medications.forEach((med, index) => {
            med.display_order = (index + 1) * 10
          })
        }
        
        const targetMed = medications.find(m => m.id === position.targetMedId)
        if (targetMed) {
          const targetOrder = targetMed.display_order || 0
          
          if (position.position === 'above') {
            const sortedMeds = [...medications].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            const targetIndex = sortedMeds.findIndex(m => m.id === position.targetMedId)
            const prevMed = targetIndex > 0 ? sortedMeds[targetIndex - 1] : null
            const prevOrder = prevMed?.display_order || 0
            displayOrder = Math.floor((prevOrder + targetOrder) / 2)
            if (displayOrder === prevOrder || displayOrder === targetOrder) {
              displayOrder = targetOrder - 1
            }
          } else {
            const sortedMeds = [...medications].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            const targetIndex = sortedMeds.findIndex(m => m.id === position.targetMedId)
            const nextMed = targetIndex < sortedMeds.length - 1 ? sortedMeds[targetIndex + 1] : null
            const nextOrder = nextMed?.display_order || targetOrder + 20
            displayOrder = Math.floor((targetOrder + nextOrder) / 2)
            if (displayOrder === targetOrder || displayOrder === nextOrder) {
              displayOrder = targetOrder + 1
            }
          }
        } else {
          // Target not found, add at the TOP for vitals
          const minOrder = Math.min(...medications.map(m => m.display_order || 0), 10)
          displayOrder = minOrder - 10
        }
      } else {
        // No position specified - vitals go to the TOP
        if (medications.length === 0) {
          displayOrder = 10
        } else {
          const minOrder = Math.min(...medications.map(m => m.display_order || 0), 10)
          displayOrder = minOrder - 10
        }
      }
      
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
          hour: null, // Vitals don't have administration time
          notes: 'Vital Signs Entry', // Mark as vital sign entry
          display_order: displayOrder
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

  // Delete medication or vitals entry
  const deleteMedicationEntry = async (medId: string) => {
    if (!userProfile || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      // First, delete all administration records for this medication
      const { error: adminError } = await supabase
        .from('mar_administrations')
        .delete()
        .eq('mar_medication_id', medId)
      
      if (adminError) {
        console.error('Error deleting administrations:', adminError)
        // Continue anyway - the medication delete might still work due to CASCADE
      }
      
      // Delete the medication entry
      const { error: medError } = await supabase
        .from('mar_medications')
        .delete()
        .eq('id', medId)
      
      if (medError) throw medError
      
      // Reload the form to reflect changes
      await loadMARForm()
      
      setMessage('Entry deleted successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error deleting entry:', err)
      setError(err.message || 'Failed to delete entry')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
      setShowDeleteConfirmModal(false)
      setDeletingEntry(null)
    }
  }

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for row reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = medications.findIndex((med) => med.id === active.id)
      const newIndex = medications.findIndex((med) => med.id === over.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        // Reorder locally first for immediate UI feedback
        const newMedications = arrayMove(medications, oldIndex, newIndex)
        setMedications(newMedications)

        // Update display_order in database for all rows
        try {
          setSaving(true)
          const updates = newMedications.map((med, index) => ({
            id: med.id,
            display_order: (index + 1) * 10
          }))

          // Update all medications with their new display_order
          for (const update of updates) {
            await supabase
              .from('mar_medications')
              .update({ display_order: update.display_order })
              .eq('id', update.id)
          }

          setMessage('Row order updated!')
          setTimeout(() => setMessage(''), 2000)
        } catch (err: any) {
          console.error('Error updating row order:', err)
          setError('Failed to save row order')
          setTimeout(() => setError(''), 3000)
          // Reload to restore original order
          await loadMARForm()
        } finally {
          setSaving(false)
        }
      }
    }
  }

  // Handle moving row up or down (backup for arrow buttons)
  const handleMoveRow = async (medId: string, direction: 'up' | 'down') => {
    const currentIndex = medications.findIndex((med) => med.id === medId)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= medications.length) return

    // Swap positions locally for immediate UI feedback
    const newMedications = [...medications]
    const temp = newMedications[currentIndex]
    newMedications[currentIndex] = newMedications[newIndex]
    newMedications[newIndex] = temp
    setMedications(newMedications)

    // Update display_order in database
    try {
      setSaving(true)
      
      // Update both affected rows
      const updates = [
        { id: newMedications[currentIndex].id, display_order: (currentIndex + 1) * 10 },
        { id: newMedications[newIndex].id, display_order: (newIndex + 1) * 10 }
      ]

      for (const update of updates) {
        await supabase
          .from('mar_medications')
          .update({ display_order: update.display_order })
          .eq('id', update.id)
      }

      setMessage('Row moved!')
      setTimeout(() => setMessage(''), 1500)
    } catch (err: any) {
      console.error('Error moving row:', err)
      setError('Failed to move row')
      setTimeout(() => setError(''), 3000)
      // Reload to restore original order
      await loadMARForm()
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
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })

      if (medsError) throw medsError
      
      // Sort medications by display_order (primary), falling back to original grouping logic
      const sortedMeds = (medsData || []).sort((a, b) => {
        // If both have display_order, use that
        if (a.display_order != null && b.display_order != null) {
          return a.display_order - b.display_order
        }
        
        // If only one has display_order, prioritize the one that has it
        if (a.display_order != null) return -1
        if (b.display_order != null) return 1
        
        // Fallback: original sorting logic for backward compatibility
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
                  onClick={() => {
                    setInsertPosition(null) // Clear position when using regular add button
                    setShowAddMedModal(true)
                  }}
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
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={medications.map(m => m.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <tbody>
                    {medications.length === 0 ? (
                      <tr>
                        <td colSpan={35} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500 dark:text-gray-400">
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
                          <SortableTableRow 
                            key={med.id}
                            id={med.id}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isVitalsEntry ? 'bg-lasso-blue/10 dark:bg-lasso-blue/20' : ''}`}
                            onMouseMove={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const mouseY = e.clientY - rect.top
                              const rowHeight = rect.height
                              const edgeZone = 10 // pixels from edge to trigger
                              
                              if (mouseY < edgeZone) {
                                if (rowHover?.rowId !== med.id || rowHover?.position !== 'top') {
                                  setRowHover({ rowId: med.id, position: 'top' })
                                }
                              } else if (mouseY > rowHeight - edgeZone) {
                                if (rowHover?.rowId !== med.id || rowHover?.position !== 'bottom') {
                                  setRowHover({ rowId: med.id, position: 'bottom' })
                                }
                              } else {
                                if (rowHover?.rowId === med.id) {
                                  setRowHover(null)
                                }
                              }
                            }}
                            onMouseLeave={() => {
                              if (rowHover?.rowId === med.id) {
                                setRowHover(null)
                              }
                            }}
                          >
                            {shouldMerge && !isFirstRow ? null : (
                              <td 
                                rowSpan={shouldMerge ? group.rowSpan : undefined}
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 align-top sticky left-0 z-10 bg-white dark:bg-gray-800 border-r-2 border-gray-400 dark:border-gray-500 relative"
                              >
                                {/* Add Row Indicator - Top */}
                                {rowHover?.rowId === med.id && rowHover?.position === 'top' && (
                                  <div 
                                    className="absolute left-0 right-0 -top-1 h-2 bg-lasso-teal z-50 flex items-center cursor-pointer hover:bg-lasso-blue transition-colors"
                                    style={{ width: '5000px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setInsertPosition({ targetMedId: med.id, position: 'above' })
                                      setShowAddMedModal(true)
                                    }}
                                    onMouseEnter={() => setRowHover({ rowId: med.id, position: 'top' })}
                                  >
                                    <div className="ml-4 bg-lasso-teal text-white text-xs px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap font-medium">
                                      <span className="text-sm font-bold">+</span> Add above
                                    </div>
                                  </div>
                                )}
                                {/* Add Row Indicator - Bottom */}
                                {rowHover?.rowId === med.id && rowHover?.position === 'bottom' && (
                                  <div 
                                    className="absolute left-0 right-0 -bottom-1 h-2 bg-lasso-teal z-50 flex items-center cursor-pointer hover:bg-lasso-blue transition-colors"
                                    style={{ width: '5000px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setInsertPosition({ targetMedId: med.id, position: 'below' })
                                      setShowAddMedModal(true)
                                    }}
                                    onMouseEnter={() => setRowHover({ rowId: med.id, position: 'bottom' })}
                                  >
                                    <div className="ml-4 bg-lasso-teal text-white text-xs px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap font-medium">
                                      <span className="text-sm font-bold">+</span> Add below
                                    </div>
                                  </div>
                                )}
                                <div className="flex flex-col gap-1 group/medcell">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      {/* Drag Handle */}
                                      <DragHandleButton medId={med.id} />
                                      <div className={`font-medium text-sm ${isVitalsEntry ? 'text-lasso-teal dark:text-lasso-blue' : 'text-gray-800 dark:text-white'}`}>
                                        {isVitalsEntry ? '📊 VITALS' : med.medication_name}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {!isVitalsEntry && med.medication_name && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingMedicationParameter({ medicationId: med.id, parameter: med.parameter })
                                            setShowMedicationParameterModal(true)
                                          }}
                                          className="text-xs px-2 py-1 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-1 whitespace-nowrap"
                                          title={med.parameter ? 'Edit parameter' : 'Add parameter'}
                                        >
                                          {med.parameter ? '📝' : '+'} parameter
                                        </button>
                                      )}
                                      {/* Delete button - shows on hover */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setDeletingEntry({
                                            id: med.id,
                                            name: med.medication_name,
                                            dosage: med.dosage,
                                            isVitals: isVitalsEntry
                                          })
                                          setShowDeleteConfirmModal(true)
                                        }}
                                        className="opacity-0 group-hover/medcell:opacity-100 text-xs px-2 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-all flex items-center justify-center whitespace-nowrap"
                                        title="Delete entry"
                                        aria-label="Delete entry"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  <div className={`text-xs mt-1 ${isVitalsEntry ? 'text-lasso-blue dark:text-lasso-blue italic' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {med.dosage}
                                  </div>
                                  {/* Route - shown under dosage for medications only */}
                                  {!isVitalsEntry && med.route && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 italic">
                                      {med.route}
                                    </div>
                                  )}
                                  {med.frequency && med.frequency > 0 && !isVitalsEntry && (
                                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                                      {med.frequency_display || `${med.frequency} time${med.frequency > 1 ? 's' : ''} per day`}
                                    </div>
                                  )}
                              {med.notes && !isVitalsEntry && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
                                  {med.notes}
                                </div>
                              )}
                                  {med.parameter && !isVitalsEntry && (
                                    <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                                      {med.parameter}
                                    </div>
                                  )}
                                </div>
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
                              {/* Vitals don't have administration time - show dash */}
                              {isVitalsEntry ? (
                                <span className="text-gray-400">—</span>
                              ) : (
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
                                      console.error('Error updating hour:', err)
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
                              const initials = (admin?.initials || '').trim().toUpperCase()
                              const notes = admin?.notes || null
                              const isNotGiven = status === 'Not Given'
                              const isGiven = status === 'Given'
                              const isPRN = status === 'PRN'
                              const isDC = initials === 'DC'
                              const isRefused = initials === 'R'
                              const isHeld = initials === 'H'
                              const hasParameter = !!med.parameter

                              // Check if this day is after a DC (Discontinued) day
                              let isDiscontinued = false
                              let dcDay = null
                              if (!isVitalsEntry) {
                                // Find the earliest day with DC for this medication
                                for (let checkDay = 1; checkDay < day; checkDay++) {
                                  const checkAdmin = medAdmin[checkDay]
                                  if (checkAdmin?.initials === 'DC') {
                                    dcDay = checkDay
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
                                      ? `Medication discontinued on day ${dcDay}. Cannot edit future days. Add a new medication to continue.`
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
                                        // Discontinued day - only show red line, no DC text (DC only appears on the day it was selected)
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
                                                <option value="DC">DC (Discontinued)</option>
                                                <option value="NG">NG (Not Given)</option>
                                                <option value="PRN">PRN (As Needed)</option>
                                                <option value="H">H (Held)</option>
                                                <option value="R">R (Refused)</option>
                                                {customLegends.map(legend => (
                                                  <option key={legend.id} value={legend.code}>
                                                    {legend.code} ({legend.description})
                                                  </option>
                                                ))}
                                              </select>
                                            )
                                          })()
                                        )
                                      ) : (
                                        <div className="flex flex-col gap-1 w-full">
                                          <div
                                            onClick={isEditing && !isDiscontinued ? () => {
                                              setEditingCell({ medId: med.id, day })
                                              setEditingCellValue(initials || '')
                                            } : undefined}
                                          className={`min-h-[24px] flex items-center justify-center gap-1 ${
                                              isEditing && !isDiscontinued ? 'cursor-pointer hover:bg-lasso-blue/10 dark:hover:bg-lasso-blue/20' : ''
                                            }`}
                                          >
                                            {isDC && !isDiscontinued && (
                                              hasParameter ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className="text-red-600 dark:text-red-400 font-bold text-xs">
                                                      DC
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                        setShowAdministrationNoteModal(true)
                                                      }}
                                                      className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                      title={notes ? 'Edit note' : 'Add note'}
                                                    >
                                                      {notes ? '📝' : '+'} note
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="text-red-600 dark:text-red-400 font-bold text-xs">
                                                  DC
                                                </div>
                                              )
                                            )}
                                            {isRefused && !isDC && (
                                              <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                <div className="flex items-center justify-center gap-1">
                                                  <div className="font-bold text-red-600 dark:text-red-400">
                                                    R
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                      setShowAdministrationNoteModal(true)
                                                    }}
                                                    className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                    title={notes ? 'Edit note' : 'Add note'}
                                                  >
                                                    {notes ? '📝' : '+'} note
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            {isHeld && !isDC && (
                                              <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                <div className="flex items-center justify-center gap-1">
                                                  <div className="font-bold text-orange-600 dark:text-orange-400">
                                                    H
                                                  </div>
                                                  <button
                                                    onClick={(e) => {
                                                      e.stopPropagation()
                                                      setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                      setShowAdministrationNoteModal(true)
                                                    }}
                                                    className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                    title={notes ? 'Edit note' : 'Add note'}
                                                  >
                                                    {notes ? '📝' : '+'} note
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            {isGiven && !isDC && !isRefused && !isHeld && (
                                              hasParameter && initials ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className={`font-bold text-gray-800 dark:text-white ${isEditing ? 'cursor-text' : ''}`}>
                                                      {initials}
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                        setShowAdministrationNoteModal(true)
                                                      }}
                                                      className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                      title={notes ? 'Edit note' : 'Add note'}
                                                    >
                                                      {notes ? '📝' : '+'} note
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className={`font-bold text-gray-800 dark:text-white ${isEditing ? 'cursor-text' : ''}`}>
                                                  {initials || '—'}
                                                </div>
                                              )
                                          )}
                                            {isNotGiven && initials && !isDC && !isRefused && !isHeld && (
                                              hasParameter ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className="text-red-600 dark:text-red-400 font-bold">
                                                      ○{initials}
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                        setShowAdministrationNoteModal(true)
                                                      }}
                                                      className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                      title={notes ? 'Edit note' : 'Add note'}
                                                    >
                                                      {notes ? '📝' : '+'} note
                                                    </button>
                                                  </div>
                                                </div>
                                              ) : (
                                                <div className="text-red-600 dark:text-red-400 font-bold">
                                                  ○{initials}
                                                </div>
                                              )
                                          )}
                                          {isPRN && (
                                              hasParameter ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className="text-lasso-blue dark:text-lasso-blue font-bold text-xs">
                                                      PRN
                                                    </div>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        setEditingAdministrationNote({ medId: med.id, day, note: notes })
                                                        setShowAdministrationNoteModal(true)
                                                      }}
                                                      className="text-[10px] px-1.5 py-0.5 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors flex items-center gap-0.5 whitespace-nowrap relative z-0"
                                                      title={notes ? 'Edit note' : 'Add note'}
                                                    >
                                                      {notes ? '📝' : '+'} note
                                                    </button>
                                                  </div>
                                                  {initials && <div className="text-xs text-lasso-blue">{initials}</div>}
                                                </div>
                                              ) : (
                                                <div className="text-lasso-blue dark:text-lasso-blue font-bold text-xs">
                                                  PRN
                                                  {initials && <div className="text-xs">{initials}</div>}
                                                </div>
                                              )
                                          )}
                                            {isNotGiven && !initials && !isDC && isEditing && (
                                            <div className="text-gray-400 cursor-text">—</div>
                                          )}
                                            {isNotGiven && !initials && !isDC && !isEditing && (
                                            <div className="text-gray-400">—</div>
                                            )}
                                          </div>
                                          {isRefused && notes && (
                                            <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600 px-1">
                                              {notes}
                                            </div>
                                          )}
                                          {isHeld && notes && (
                                            <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600 px-1">
                                              {notes}
                                            </div>
                                          )}
                                          {hasParameter && !isRefused && !isHeld && !isDC && notes && (
                                            <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600 px-1">
                                              {notes}
                                            </div>
                                          )}
                                          {hasParameter && isDC && !isDiscontinued && notes && (
                                            <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1 pt-1 border-t border-gray-200 dark:border-gray-600 px-1">
                                              {notes}
                                            </div>
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
                          </SortableTableRow>
                        )
                      })
                    })()}
                      </tbody>
                    </SortableContext>
                  </DndContext>
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
                        <div>DC = Discontinued</div>
                        <div>NG = Not Given</div>
                        <div>PRN = As Needed</div>
                        <div>H = Held</div>
                        <div>R = Refused</div>
                        {customLegends.map(legend => (
                          <div key={legend.id} className="flex items-center justify-between group">
                            <span className="text-gray-700 dark:text-gray-300">
                              {legend.code} = {legend.description}
                            </span>
                            <button
                              onClick={() => {
                                setEditingCustomLegend({ id: legend.id, code: legend.code, description: legend.description })
                                setShowCustomLegendModal(true)
                              }}
                              className="opacity-0 group-hover:opacity-100 text-xs px-2 py-0.5 text-lasso-blue hover:text-lasso-teal transition-opacity"
                              title="Edit"
                            >
                              ✏️
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setEditingCustomLegend({ id: null, code: '', description: '' })
                            setShowCustomLegendModal(true)
                          }}
                          className="mt-2 text-xs px-2 py-1 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors"
                        >
                          + Add Custom Legend
                        </button>
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
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <TimeInput
                                  value={editingPRNValue}
                                  onChange={async (newTime) => {
                                    setEditingPRNValue(newTime)
                                    // Save directly with the new value (don't rely on state)
                                    await updatePRNRecord(prn.id, 'hour', newTime.trim() || null)
                                    setEditingPRNField(null)
                                    setEditingPRNValue('')
                                  }}
                                  compact
                                />
                                <button
                                  type="button"
                                  onClick={() => handlePRNFieldCancel()}
                                  className="text-xs text-gray-500 hover:text-gray-700"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <span>{prn.hour ? formatTimeDisplay(prn.hour) : '—'}</span>
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
                    await addMedication(data.medicationData!, insertPosition)
                    setShowAddMedModal(false)
                    setInsertPosition(null) // Clear insert position after use
                  } else {
                    await addVitals(data.vitalsData!, insertPosition)
                    setShowAddMedModal(false)
                    setInsertPosition(null) // Clear insert position after use
                  }
                } catch (err) {
                  console.error('Error adding entry:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => {
                setShowAddMedModal(false)
                setInsertPosition(null) // Clear insert position on cancel
              }}
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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

      {/* Medication Parameter Modal */}
      {showMedicationParameterModal && editingMedicationParameter && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add/Edit Parameter</h2>
              <button
                onClick={() => {
                  setShowMedicationParameterModal(false)
                  setEditingMedicationParameter(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parameter for Medication
              </label>
              <textarea
                value={editingMedicationParameter.parameter || ''}
                onChange={(e) => setEditingMedicationParameter({ ...editingMedicationParameter, parameter: e.target.value })}
                placeholder="Enter parameters for this medication..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMedicationParameterModal(false)
                  setEditingMedicationParameter(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingMedicationParameter) {
                    await updateMedicationParameter(editingMedicationParameter.medicationId, editingMedicationParameter.parameter?.trim() || null)
                    setShowMedicationParameterModal(false)
                    setEditingMedicationParameter(null)
                  }
                }}
                className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal"
              >
                Save Parameter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Administration Note Modal (for R - Refused and H - Held) */}
      {showAdministrationNoteModal && editingAdministrationNote && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add/Edit Note</h2>
              <button
                onClick={() => {
                  setShowAdministrationNoteModal(false)
                  setEditingAdministrationNote(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Administration Note
              </label>
              <textarea
                value={editingAdministrationNote.note || ''}
                onChange={(e) => setEditingAdministrationNote({ ...editingAdministrationNote, note: e.target.value })}
                placeholder="Enter notes about the medication administration..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAdministrationNoteModal(false)
                  setEditingAdministrationNote(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingAdministrationNote) {
                    await updateAdministrationNote(editingAdministrationNote.medId, editingAdministrationNote.day, editingAdministrationNote.note?.trim() || null)
                    setShowAdministrationNoteModal(false)
                    setEditingAdministrationNote(null)
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

      {/* Custom Legend Modal */}
      {showCustomLegendModal && editingCustomLegend && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingCustomLegend.id ? 'Edit Custom Legend' : 'Add Custom Legend'}
              </h2>
              <button
                onClick={() => {
                  setShowCustomLegendModal(false)
                  setEditingCustomLegend(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (editingCustomLegend) {
                  await saveCustomLegend(
                    editingCustomLegend.code,
                    editingCustomLegend.description,
                    editingCustomLegend.id
                  )
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  value={editingCustomLegend.code}
                  onChange={(e) => setEditingCustomLegend({
                    ...editingCustomLegend,
                    code: e.target.value.toUpperCase()
                  })}
                  required
                  maxLength={10}
                  placeholder="e.g., ABC"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Short code (max 10 characters)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={editingCustomLegend.description}
                  onChange={(e) => setEditingCustomLegend({
                    ...editingCustomLegend,
                    description: e.target.value
                  })}
                  required
                  placeholder="e.g., Absent from Care"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomLegendModal(false)
                    setEditingCustomLegend(null)
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                >
                  {editingCustomLegend.id ? 'Update' : 'Add'} Legend
                </button>
              </div>
            </form>
            {editingCustomLegend.id && (
              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <button
                  onClick={async () => {
                    if (editingCustomLegend.id) {
                      await deleteCustomLegend(editingCustomLegend.id)
                      setShowCustomLegendModal(false)
                      setEditingCustomLegend(null)
                    }
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  Delete Legend
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Entry Confirmation Modal */}
      {showDeleteConfirmModal && deletingEntry && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-red-600 dark:text-red-400">
                Delete {deletingEntry.isVitals ? 'Vital Signs Entry' : 'Medication'}?
              </h2>
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false)
                  setDeletingEntry(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-6">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                <p className="font-medium text-gray-800 dark:text-white">
                  {deletingEntry.isVitals ? '📊 VITALS' : deletingEntry.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {deletingEntry.dosage}
                </p>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400">
                ⚠️ This will permanently delete this entry and all its administration records. This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false)
                  setDeletingEntry(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMedicationEntry(deletingEntry.id)}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Confirmation Modal */}
      {showLeaveConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
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
      route: string | null
      frequencyDisplay: string | null
    }
    vitalsData?: {
      notes: string
      initials: string
      startDate: string
      stopDate: string | null
      hour: string | null
    }
  }) => Promise<void>
  onCancel: () => void
  defaultStartDate: string
  defaultHour: string
  defaultInitials: string
  defaultType?: 'medication' | 'vitals'
}) {
  const [entryType, setEntryType] = useState<'medication' | 'vitals'>(defaultType)
  const [medicationData, setMedicationData] = useState({
    medicationName: '',
    dosage: '',
    startDate: defaultStartDate,
    stopDate: '',
    hour: defaultHour,
    notes: '',
    initials: '', // No longer collected from form, will be empty
    frequency: 1, // Number of times per day
    times: [] as string[], // Array of times for each frequency
    route: '', // Route of administration
    frequencyDisplay: '1 time per day' // Custom frequency display text (e.g., "Daily 3x", "TID") - auto-populated with default
  })
  const [vitalsData, setVitalsData] = useState({
    notes: '',
    initials: '', // For vitals, this is just a default text value, not initials
    startDate: defaultStartDate,
    stopDate: '',
    hour: defaultHour
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

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
      // No longer validating initials/legend - they are optional
    } else {
      if (!vitalsData.notes.trim() || !vitalsData.startDate) {
        alert('Please fill in all required fields')
        return
      }
    }

    setIsSubmitting(true)
    try {
      // Initials are no longer collected from form - use empty string
      const finalInitials = ''

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
          times: times,
          route: medicationData.route || null,
          frequencyDisplay: medicationData.frequencyDisplay || null
        } : undefined,
        vitalsData: entryType === 'vitals' ? {
          notes: vitalsData.notes,
          initials: finalVitalsInitials,
          startDate: vitalsData.startDate,
          stopDate: vitalsData.stopDate || null,
          hour: null // Vitals don't have administration time
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
        initials: '', // Reset to empty
        frequency: 1,
        times: [],
        route: '',
        frequencyDisplay: '1 time per day'
      })
      setVitalsData({
        notes: '',
        initials: '', // Reset to empty for vitals
        startDate: defaultStartDate,
        stopDate: '',
        hour: defaultHour
      })
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Route
            </label>
            <input
              type="text"
              value={medicationData.route}
              onChange={(e) => setMedicationData({ ...medicationData, route: e.target.value })}
              placeholder="e.g., PO, IV, IM, SubQ"
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
                // Auto-populate frequency display with default format
                const defaultDisplay = `${freq} time${freq > 1 ? 's' : ''} per day`
                setMedicationData({ 
                  ...medicationData, 
                  frequency: freq, 
                  times: newTimes,
                  frequencyDisplay: medicationData.frequencyDisplay || defaultDisplay
                })
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
              Frequency Display Text (Optional)
            </label>
            <input
              type="text"
              value={medicationData.frequencyDisplay}
              onChange={(e) => setMedicationData({ ...medicationData, frequencyDisplay: e.target.value })}
              placeholder="e.g., Daily 3x, TID, Q8H, 3 times per day"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Custom frequency text to display in the chart. Leave empty to use default format.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Administration Time(s) *
            </label>
            {medicationData.frequency === 1 ? (
              <>
                <TimeInput
                  value={medicationData.hour}
                  onChange={(newTime) => setMedicationData({ ...medicationData, hour: newTime })}
                  required
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Select hour, minute, and AM/PM</p>
              </>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: medicationData.frequency }, (_, i) => (
                  <div key={i}>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Time {i + 1}:
                    </label>
                    <TimeInput
                      value={medicationData.times[i] || ''}
                      onChange={(newTime) => {
                        const newTimes = [...medicationData.times]
                        newTimes[i] = newTime
                        // Ensure array is the right length
                        while (newTimes.length < medicationData.frequency) {
                          newTimes.push('')
                        }
                        setMedicationData({ 
                          ...medicationData, 
                          times: newTimes,
                          hour: i === 0 ? newTime : medicationData.hour // Keep first time as default hour
                        })
                      }}
                      required
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
  // Track if user has interacted to prevent auto-updates on load
  const [userInteracted, setUserInteracted] = useState(false)

  const handleChange = async (newTime: string) => {
    // Only update database if user has actually interacted
    if (userInteracted) {
      await onUpdate(newTime)
    }
  }

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation()
        setUserInteracted(true)
      }}
    >
      <TimeInput
        value={medication.hour || ''}
        onChange={handleChange}
        compact
      />
    </div>
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
