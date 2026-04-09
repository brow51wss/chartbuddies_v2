import React, { Fragment, useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import AppHeader from '../../../../components/AppHeader'
import PatientStickyBar from '../../../../components/PatientStickyBar'
import TimeInput, { formatTimeDisplay } from '../../../../components/TimeInput'
import {
  upsertProgressNoteFromPRNRecord,
  upsertProgressNoteFromMarPrnRecordId,
  isPrnRecordSignedForProgressNote,
} from '../../../../lib/prn-progress-notes'

const SIGNATURE_FONTS_LINK_ID = 'mar-signature-fonts-link'
function ensureSignatureFontsLoaded(font: string) {
  if (typeof document === 'undefined' || !font) return
  if (document.getElementById(SIGNATURE_FONTS_LINK_ID)) return
  const link = document.createElement('link')
  link.id = SIGNATURE_FONTS_LINK_ID
  link.href = 'https://fonts.googleapis.com/css2?family=Allura&family=Caveat:wght@400;700&family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Sacramento&display=swap'
  link.rel = 'stylesheet'
  document.head.appendChild(link)
}

/** Renders initials or signature: text with chosen font when available, else image or plain text. Used on MAR. */
function InitialsOrSignatureDisplay({
  value,
  variant = 'initials',
  userProfile = null
}: {
  value: string | null
  variant?: 'initials' | 'signature'
  userProfile?: UserProfile | null
}) {
  if (!value) return <span>—</span>
  const font = userProfile?.staff_signature_font || 'Dancing Script'
  const initialsMatchProfile =
    !!userProfile?.staff_initials_text &&
    (value === userProfile?.staff_initials ||
      value?.trim().toUpperCase() === userProfile?.staff_initials_text?.trim().toUpperCase())
  const signatureMatchProfile =
    !!userProfile?.staff_signature_text &&
    (value === userProfile?.staff_signature ||
      value?.trim().toUpperCase() === userProfile?.staff_signature_text?.trim().toUpperCase())
  const showAsTextWithFont =
    variant === 'initials' ? initialsMatchProfile : signatureMatchProfile
  const displayText = variant === 'initials' ? userProfile?.staff_initials_text : userProfile?.staff_signature_text
  if (showAsTextWithFont && displayText) {
    ensureSignatureFontsLoaded(font)
    return (
      <span
        style={{
          fontFamily: `"${font}", cursive`,
          fontSize: variant === 'initials' ? '1.35em' : '1.4em',
          verticalAlign: 'middle'
        }}
      >
        {displayText}
      </span>
    )
  }
  if (value.startsWith('data:image')) {
    return (
      <img
        src={value}
        alt={variant === 'initials' ? 'Initials' : 'Signature'}
        style={{ maxHeight: variant === 'initials' ? '3em' : '3em', maxWidth: variant === 'initials' ? '7em' : '7em', verticalAlign: 'middle', display: 'inline-block' }}
      />
    )
  }
  return <span>{value}</span>
}

/** Current user's initials for matching PRN rows (when signed_by is null). Prefer profile text, else derive from name. */
function currentUserInitialsForMatch(userProfile: UserProfile | null): string {
  if (!userProfile) return ''
  if (userProfile.staff_initials && !userProfile.staff_initials.startsWith('data:image')) return userProfile.staff_initials.trim().toUpperCase()
  const first = (userProfile as any).first_name?.trim()?.[0] || ''
  const last = (userProfile as any).last_name?.trim()?.[0] || ''
  if (first && last) return `${first}${last}`.toUpperCase()
  const full = userProfile.full_name?.trim().split(/\s+/) || []
  if (full.length >= 2) return (full[0][0] + full[full.length - 1][0]).toUpperCase()
  if (full.length === 1 && full[0].length >= 2) return full[0].slice(0, 2).toUpperCase()
  return ''
}

import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile, signOut } from '../../../../lib/auth'
import { useReadOnly } from '../../../../contexts/ReadOnlyContext'
import type { UserProfile, Patient } from '../../../../types/auth'
import {
  PatientProfileFormFields,
  type PatientProfileFormValues,
} from '../../../../components/PatientProfileFormFields'
import { parsePatientNameParts, computeAgeFromISODate } from '../../../../lib/patientName'
import { missingFieldsForPatientProfileWizardStep1 } from '../../../../lib/patientProfileWizardValidation'
import type { MARForm, MARMedication, MARAdministration, MARPRNRecord, MARVitalSigns, MARCustomLegend, MARPRNMedication } from '../../../../types/mar'
import {
  DndContext,
  closestCenter,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  defaultAnimateLayoutChanges,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  type SortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * Do not translate table rows while dragging. Multi-time meds use several `<tr>`s but only one sortable id;
 * `verticalListSortingStrategy` would shift other groups and visually split rowSpan stacks. Preview is handled
 * by `DragOverlay` + hidden source rows.
 */
const marGroupReorderNoLayoutShiftStrategy: SortingStrategy = () => null

/** One logical MAR row group (shared med cell / rowSpan). Must match grouping in table body and `handleDragEnd`. */
function getMarMedicationGroupKey(med: MARMedication): string {
  const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
  return isVitalsEntry
    ? `vitals|${med.dosage}|${med.start_date}|${med.stop_date || ''}`
    : `${med.medication_name}|${med.dosage}|${med.start_date}|${med.stop_date || ''}`
}

/** Floating preview so multi-time meds show all hours while dragging (not just the first `<tr>`). */
function MarMedicationGroupDragPreview({ meds }: { meds: MARMedication[] }) {
  if (!meds.length) return null
  const first = meds[0]
  const isVitalsEntry = first.medication_name === 'VITALS' || first.notes === 'Vital Signs Entry'
  const title = isVitalsEntry ? '📊 VITALS' : first.medication_name
  return (
    <div className="bg-white dark:bg-gray-800 border-2 border-lasso-teal rounded-lg shadow-2xl p-3 min-w-[300px] max-w-md cursor-grabbing">
      <div className="font-semibold text-sm text-gray-900 dark:text-white">{title}</div>
      {first.dosage && !isVitalsEntry && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">{first.dosage}</div>
      )}
      <div className="mt-2 space-y-1 border-t border-gray-200 dark:border-gray-600 pt-2">
        {meds.map((m) => (
          <div key={m.id} className="text-xs text-gray-800 dark:text-gray-200 flex justify-between gap-4">
            <span className="font-medium text-gray-500 dark:text-gray-400">Time</span>
            <span>{m.hour ? formatTimeDisplay(m.hour) : '—'}</span>
          </div>
        ))}
      </div>
      {meds.length > 1 && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 pt-1 border-t border-dashed border-gray-200 dark:border-gray-600">
          {meds.length} administration time rows — moving as one group
        </div>
      )}
    </div>
  )
}

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
  sortableDisabled,
}: { 
  id: string
  children: React.ReactNode
  className?: string
  onMouseMove?: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onMouseLeave?: () => void
  /** When true, row is not draggable (e.g. MAR table filtered to a subset). */
  sortableDisabled?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: sortableDisabled,
    // Avoid shifting only the first `<tr>` of a multi-time med (nested rows stay put) while dragging.
    animateLayoutChanges: (args) => {
      if (args.isSorting) return false
      return defaultAnimateLayoutChanges(args)
    },
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    position: 'relative',
    zIndex: isDragging ? 1000 : 'auto',
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={className || ''}
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

/**
 * Multi-time meds use several `<tr>`s; only the first is a @dnd-kit sortable item so the drop indicator
 * appears between whole groups, not between nested time rows.
 */
function MarMedTableRow({
  sortableId,
  sortableDisabled,
  className,
  onMouseMove,
  onMouseLeave,
  children,
}: {
  sortableId: string | null
  sortableDisabled?: boolean
  className?: string
  onMouseMove?: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onMouseLeave?: () => void
  children: React.ReactNode
}) {
  if (sortableId != null) {
    return (
      <SortableTableRow
        id={sortableId}
        sortableDisabled={sortableDisabled}
        className={className}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </SortableTableRow>
    )
  }
  return (
    <tr className={className || ''} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
      {children}
    </tr>
  )
}

// Hook to get drag handle props in child components
function useDragHandle() {
  const context = React.useContext(SortableRowContext)
  return context
}

// Drag handle button component that uses context
function DragHandleButton({ medId, readOnly, reorderLocked }: { medId: string; readOnly?: boolean; reorderLocked?: boolean }) {
  const dragContext = useDragHandle()
  if (readOnly || reorderLocked) return null
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
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#000000] dark:text-white" viewBox="0 0 24 24" fill="currentColor">
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
  /** On-screen MAR grid only; print always uses full `medications`. PRN-only filter not implemented yet. */
  type MarTableViewFilter = 'all' | 'routine_meds' | 'vitals_only'
  const [marTableViewFilter, setMarTableViewFilter] = useState<MarTableViewFilter>('all')
  const displayMedications = useMemo(() => {
    const isVitalsRow = (m: MARMedication) => m.medication_name === 'VITALS' || m.notes === 'Vital Signs Entry'
    if (marTableViewFilter === 'routine_meds') return medications.filter((m) => !isVitalsRow(m))
    if (marTableViewFilter === 'vitals_only') return medications.filter((m) => isVitalsRow(m))
    return medications
  }, [medications, marTableViewFilter])
  /** First `<tr>` id per medication group — only these register as sortable (extended backlog #14). */
  const marSortableFirstRowIds = useMemo(() => {
    const ids: string[] = []
    let prevKey: string | null = null
    for (const m of displayMedications) {
      const gk = getMarMedicationGroupKey(m)
      if (gk !== prevKey) {
        ids.push(m.id)
        prevKey = gk
      }
    }
    return ids
  }, [displayMedications])
  const [administrations, setAdministrations] = useState<{ [medId: string]: { [day: number]: MARAdministration } }>({})
  const [prnRecords, setPrnRecords] = useState<MARPRNRecord[]>([])
  const [prnMedicationList, setPrnMedicationList] = useState<MARPRNMedication[]>([])
  const [vitalSigns, setVitalSigns] = useState<{ [day: number]: MARVitalSigns }>({})
  const [staffInitials, setStaffInitials] = useState<{ [initials: string]: string }>({})
  const [dailyInitials, setDailyInitials] = useState<{ [day: number]: string }>({})
  const [dailySignatures, setDailySignatures] = useState<{ [day: number]: string }>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [facilityNameFromProfile, setFacilityNameFromProfile] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // Removed page navigation - everything shows in one table
  const [showAddMedModal, setShowAddMedModal] = useState(false)
  const [showAddPRNModal, setShowAddPRNModal] = useState(false)
  const [showAddPRNRecordModal, setShowAddPRNRecordModal] = useState(false)
  const [showEditPatientInfoModal, setShowEditPatientInfoModal] = useState(false)
  const [editPatientFormDraft, setEditPatientFormDraft] = useState<PatientProfileFormValues | null>(null)
  const [editPatientAge, setEditPatientAge] = useState('')
  const [editPatientLoading, setEditPatientLoading] = useState(false)
  const [editPatientSaving, setEditPatientSaving] = useState(false)
  const [editPatientModalError, setEditPatientModalError] = useState('')
  const [editPatientStep, setEditPatientStep] = useState<1 | 2>(1)
  const [editPatientTouchedFields, setEditPatientTouchedFields] = useState<Partial<Record<keyof PatientProfileFormValues, boolean>>>({})
  const [showVitalSignsModal, setShowVitalSignsModal] = useState(false)
  const [editingCell, setEditingCell] = useState<{ medId: string; day: number } | null>(null)
  const [editingCellValue, setEditingCellValue] = useState<string>('') // Store the value being edited
  const { isReadOnly } = useReadOnly()
  const readOnly = isReadOnly
  const marRowReorderLocked = readOnly || marTableViewFilter !== 'all'
  // Always allow editing of day cells (unless read-only view)
  const [isEditingBase] = useState(true)
  const isEditing = isEditingBase && !readOnly
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
  const [showMedicationNotesModal, setShowMedicationNotesModal] = useState(false)
  const [editingMedicationNotes, setEditingMedicationNotes] = useState<{ medicationId: string; notes: string | null } | null>(null)
  // Edit medication/vitals - uses the same modal as add but with editingEntry populated
  // For medications with multiple administration times, ids/times hold all rows in the group
  const [editingEntry, setEditingEntry] = useState<{
    id: string
    isVitals: boolean
    medication_name: string
    dosage: string
    route: string | null
    start_date: string
    stop_date: string | null
    frequency: number | null
    frequency_display: string | null
    notes: string | null
    hour: string | null
    /** All row ids in this medication group (when frequency > 1). Otherwise undefined. */
    ids?: string[]
    /** Administration time for each row in group, same order as ids. */
    times?: string[]
  } | null>(null)
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
  const editPatientSaveInFlightRef = useRef(false)
  const marTableScrollRef = useRef<HTMLDivElement>(null)
  const marHeaderScrollRef = useRef<HTMLDivElement>(null)
  const [printRowHeights, setPrintRowHeights] = useState<number[]>([])
  const marMeasureTbodyRef = useRef<HTMLTableSectionElement>(null)
  const marMeasureTbodyRef2 = useRef<HTMLTableSectionElement>(null)

  const resetMarEditPatientModal = useCallback(() => {
    setShowEditPatientInfoModal(false)
    setEditPatientFormDraft(null)
    setEditPatientAge('')
    setEditPatientModalError('')
    setEditPatientLoading(false)
    setEditPatientStep(1)
    setEditPatientTouchedFields({})
  }, [])

  const closeMarEditPatientInfoModal = useCallback(() => {
    if (editPatientSaving) return
    resetMarEditPatientModal()
  }, [editPatientSaving, resetMarEditPatientModal])

  const openMarEditPatientModal = async () => {
    if (!marForm?.patient_id) {
      setEditPatientModalError('This MAR is not linked to a patient record.')
      setShowEditPatientInfoModal(true)
      setEditPatientFormDraft(null)
      setEditPatientStep(1)
      return
    }
    setShowEditPatientInfoModal(true)
    setEditPatientModalError('')
    setEditPatientLoading(true)
    setEditPatientFormDraft(null)
    setEditPatientAge('')
    setEditPatientStep(1)
    setEditPatientTouchedFields({})
    try {
      const { data: p, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', marForm.patient_id)
        .single()
      if (error) throw error
      if (!p) throw new Error('Patient not found')
      const patient = p as Patient
      const nameParts = parsePatientNameParts(patient.patient_name)
      setEditPatientFormDraft({
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        dateOfBirth: patient.date_of_birth?.slice(0, 10) || '',
        sex: patient.sex || '',
        dateOfAdmission:
          patient.admission_date?.slice(0, 10) || patient.date_of_birth?.slice(0, 10) || '',
        streetAddress: patient.street_address || '',
        city: patient.city || '',
        state: patient.state || '',
        homePhone: patient.home_phone || '',
        email: patient.email || '',
        diagnosis: patient.diagnosis || '',
        diet: patient.diet || '',
        allergies: patient.allergies || '',
        physicianName: patient.physician_name || '',
        physicianPhone: patient.physician_phone || '',
      })
      setEditPatientAge(computeAgeFromISODate(patient.date_of_birth?.slice(0, 10) || ''))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load patient'
      setEditPatientModalError(msg)
    } finally {
      setEditPatientLoading(false)
    }
  }

  const handleMarEditPatientFieldChange = (field: keyof PatientProfileFormValues, value: string) => {
    setEditPatientFormDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (field === 'dateOfBirth') {
        setEditPatientAge(computeAgeFromISODate(value))
      }
      return next
    })
    setEditPatientTouchedFields((prev) => ({ ...prev, [field]: true }))
  }

  const handleMarEditPatientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    handleMarEditPatientFieldChange(name as keyof PatientProfileFormValues, value)
  }

  const goToMarEditPatientStep2 = () => {
    if (!editPatientFormDraft) return
    setEditPatientModalError('')
    const missing = missingFieldsForPatientProfileWizardStep1(editPatientFormDraft)
    if (missing.length) {
      setEditPatientModalError(`Please complete: ${missing.join(', ')}.`)
      return
    }
    setEditPatientStep(2)
  }

  const handleSaveMarPatientEdits = async () => {
    if (!marForm?.patient_id || !editPatientFormDraft) return
    if (editPatientSaveInFlightRef.current) return
    const form = editPatientFormDraft

    const firstName = form.firstName.trim()
    const middleName = form.middleName.trim()
    const lastName = form.lastName.trim()
    const patientName = [firstName, middleName, lastName].filter(Boolean).join(' ').trim()

    if (!firstName || !lastName) {
      setEditPatientModalError('First name and last name are required.')
      return
    }
    if (!patientName) {
      setEditPatientModalError('Patient name cannot be blank.')
      return
    }
    const missingStep1 = missingFieldsForPatientProfileWizardStep1(form)
    if (missingStep1.length) {
      setEditPatientModalError(`Please complete: ${missingStep1.join(', ')}.`)
      setEditPatientStep(1)
      return
    }

    editPatientSaveInFlightRef.current = true
    setEditPatientSaving(true)
    setEditPatientModalError('')
    try {
      const facilityName = facilityNameFromProfile?.trim() || null
      const payload = {
        patient_name: patientName,
        date_of_birth: form.dateOfBirth,
        sex: form.sex as Patient['sex'],
        diagnosis: form.diagnosis.trim() || null,
        diet: form.diet.trim() || null,
        allergies: form.allergies.trim() || 'None',
        physician_name: form.physicianName.trim() || 'TBD',
        physician_phone: form.physicianPhone.trim() || null,
        facility_name: facilityName,
        street_address: form.streetAddress.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        home_phone: form.homePhone.trim() || null,
        email: form.email.trim() || null,
        admission_date: form.dateOfAdmission || null,
      }

      const { data: updatedPatient, error: patientError } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', marForm.patient_id)
        .select('*')
        .single()

      if (patientError) throw patientError
      if (!updatedPatient) throw new Error('No updated patient returned from server.')

      const marSyncPayload = {
        patient_name: payload.patient_name,
        date_of_birth: payload.date_of_birth,
        sex: payload.sex,
        diagnosis: payload.diagnosis,
        diet: payload.diet,
        allergies: payload.allergies,
        physician_name: payload.physician_name,
        physician_phone: payload.physician_phone,
        facility_name: facilityName || payload.facility_name,
      }
      const { error: marSyncError } = await supabase
        .from('mar_forms')
        .update(marSyncPayload)
        .eq('patient_id', marForm.patient_id)

      if (marSyncError) {
        throw new Error(`Patient saved, but failed to sync MAR forms: ${marSyncError.message}`)
      }

      setMarForm((prev) =>
        prev
          ? {
              ...prev,
              ...marSyncPayload,
            }
          : null
      )
      setMessage('Patient information updated.')
      setTimeout(() => setMessage(''), 3000)
      resetMarEditPatientModal()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update patient information'
      setEditPatientModalError(msg)
    } finally {
      setEditPatientSaving(false)
      editPatientSaveInFlightRef.current = false
    }
  }

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
      if (readOnly) return // No unsaved changes in read-only
      e.preventDefault()
      e.returnValue = '' // Chrome requires returnValue to be set
      return '' // Some browsers require return value
    }

    // Handle browser back/forward button
    const handlePopState = (e: PopStateEvent) => {
      if (readOnly) return // Allow leaving without confirmation in read-only
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
  }, [readOnly])

  // Handle Next.js router navigation
  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      // Don't show modal if navigating to the same page
      if (url === router.asPath) return
      // In read-only, allow navigation without confirmation
      if (readOnly) return
      
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
  }, [router, router.asPath, readOnly])

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
          closeMarEditPatientInfoModal()
        } else if (showVitalSignsModal) {
          setShowVitalSignsModal(false)
        } else if (showAddPRNModal) {
          setShowAddPRNModal(false)
        } else if (showAddPRNRecordModal) {
          setShowAddPRNRecordModal(false)
        } else if (showPRNNoteModal) {
          setShowPRNNoteModal(false)
          setEditingPRNNote(null)
        } else if (showMedicationParameterModal) {
          setShowMedicationParameterModal(false)
          setEditingMedicationParameter(null)
        } else if (showMedicationNotesModal) {
          setShowMedicationNotesModal(false)
          setEditingMedicationNotes(null)
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
  }, [showAddMedModal, showEditPatientInfoModal, showVitalSignsModal, showAddPRNModal, showAddPRNRecordModal, showPRNNoteModal, showMedicationParameterModal, showMedicationNotesModal, showAdministrationNoteModal, showCustomLegendModal, showDeleteConfirmModal, showLeaveConfirmModal, closeMarEditPatientInfoModal])

  const loadUserProfile = async () => {
    const profile = await getCurrentUserProfile()
    setUserProfile(profile)
    if (profile?.hospital_id) {
      const { data: hospital } = await supabase
        .from('hospitals')
        .select('name')
        .eq('id', profile.hospital_id)
        .single()
      setFacilityNameFromProfile(hospital?.name ?? null)
    } else {
      setFacilityNameFromProfile(null)
    }
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

  // Sync MAR form facility_name from logged-in user's profile when form has none
  useEffect(() => {
    if (!marFormId || !marForm || !facilityNameFromProfile) return
    if (marForm.facility_name?.trim()) return
    supabase
      .from('mar_forms')
      .update({ facility_name: facilityNameFromProfile })
      .eq('id', marFormId)
      .then(({ error }) => {
        if (!error && marForm) setMarForm({ ...marForm, facility_name: facilityNameFromProfile })
      })
  }, [marFormId, marForm?.id, facilityNameFromProfile, marForm?.facility_name])

  // Scroll MAR table so "today" (for current MAR month) is first visible day after Hour.
  // For non-current MAR months, fall back to last filled day (or day 1).
  useEffect(() => {
    if (loading || !marForm) return
    let lastFilledDay = 0
    for (const medId of Object.keys(administrations)) {
      for (const dayStr of Object.keys(administrations[medId] || {})) {
        const d = parseInt(dayStr, 10)
        if (d > lastFilledDay) lastFilledDay = d
      }
    }
    const parsed = parseMARMonthYear(marForm.month_year)
    const now = new Date()
    const todayInThisMarMonth =
      parsed && parsed.y === now.getFullYear() && parsed.m === now.getMonth() + 1
        ? Math.min(31, now.getDate())
        : null
    const dayToScroll = todayInThisMarMonth ?? (lastFilledDay > 0 ? Math.min(31, lastFilledDay) : 1)
    const scrollLeft = Math.max(0, (dayToScroll - 1) * MAR_COL.day)
    const applyScroll = () => {
      if (marTableScrollRef.current) marTableScrollRef.current.scrollLeft = scrollLeft
      if (marHeaderScrollRef.current) marHeaderScrollRef.current.scrollLeft = scrollLeft
    }
    requestAnimationFrame(() => {
      applyScroll()
      if (!marTableScrollRef.current || !marHeaderScrollRef.current) setTimeout(applyScroll, 50)
    })
  }, [loading, marForm, readOnly])

  // Sync horizontal scroll between sticky header and body so they stay aligned (header outside overflow so sticky works)
  useEffect(() => {
    const body = marTableScrollRef.current
    const header = marHeaderScrollRef.current
    if (!body || !header) return
    let syncing = false
    const syncHeader = () => {
      if (syncing) return
      syncing = true
      header.scrollLeft = body.scrollLeft
      requestAnimationFrame(() => { syncing = false })
    }
    const syncBody = () => {
      if (syncing) return
      syncing = true
      body.scrollLeft = header.scrollLeft
      requestAnimationFrame(() => { syncing = false })
    }
    body.addEventListener('scroll', syncHeader)
    header.addEventListener('scroll', syncBody)
    return () => {
      body.removeEventListener('scroll', syncHeader)
      header.removeEventListener('scroll', syncBody)
    }
  }, [loading])

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

  /** Keep Progress Notes in sync with MAR PRN table rows (one progress note row per PRN record). */
  const syncPrnRecordToProgressNotes = async (recordId: string) => {
    if (!marForm?.patient_id || !userProfile?.id) return
    try {
      await upsertProgressNoteFromMarPrnRecordId(supabase, {
        recordId,
        patientId: marForm.patient_id,
        physicianName: marForm.physician_name ?? null,
        createdBy: userProfile.id,
      })
    } catch (e: any) {
      console.error('PRN → Progress Notes sync failed:', e)
      const msg = e?.message || 'Progress Notes sync failed'
      setError(`MAR PRN saved, but ${msg}`)
      setTimeout(() => setError(''), 8000)
    }
  }

  const addPRNRecord = async (record: {
    date: string
    hour: string | null
    initials: string | null
    medication: string
    dosage: string | null
    reason: string
    result: string | null
    staffSignature: string | null
    startDate: string | null
  }) => {
    if (!userProfile || !marForm || !marFormId) return

    if (!isPrnDateInMarMonth(record.date, marForm.month_year)) {
      setError('PRN date must fall within this MAR month.')
      setTimeout(() => setError(''), 5000)
      return
    }

    try {
      setSaving(true)
      const nextEntryNumber = prnRecords.length + 1

      const { data: inserted, error } = await supabase
        .from('mar_prn_records')
        .insert({
          mar_form_id: marFormId,
          start_date: record.startDate,
          date: record.date,
          hour: record.hour,
          initials: record.initials,
          medication: record.medication,
          dosage: record.dosage?.trim() || null,
          reason: record.reason,
          result: record.result,
          staff_signature: record.staffSignature,
          signed_by: record.staffSignature ? userProfile.id : null,
          entry_number: nextEntryNumber
        })
        .select('*')
        .single()

      if (error) throw error

      if (inserted && marForm.patient_id && isPrnRecordSignedForProgressNote(inserted as MARPRNRecord)) {
        try {
          await upsertProgressNoteFromPRNRecord(supabase, {
            patientId: marForm.patient_id,
            record: inserted as MARPRNRecord,
            physicianName: marForm.physician_name ?? null,
            createdBy: userProfile.id,
          })
        } catch (e: any) {
          console.error('PRN → Progress Notes sync failed:', e)
          const msg = e?.message || 'Progress Notes sync failed'
          setError(`PRN record added, but ${msg}`)
          setTimeout(() => setError(''), 8000)
        }
      }

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

  const addPRNMedication = async (item: {
    date: string
    medication: string
    dosage: string | null
    reason: string
  }) => {
    if (!userProfile || !marFormId) return

    try {
      setSaving(true)
      const { error } = await supabase
        .from('mar_prn_medications')
        .insert({
          mar_form_id: marFormId,
          start_date: item.date,
          medication: item.medication.trim(),
          dosage: item.dosage?.trim() || null,
          reason: item.reason.trim(),
          created_by: userProfile.id,
        })

      if (error) throw error
      await loadMARForm()
      setMessage('PRN medication added to list successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      if (err.message?.includes('does not exist')) {
        setError('PRN list table is not available yet. Please run the latest database migration first.')
      } else {
        setError(err.message || 'Failed to add PRN medication to list')
      }
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const updatePRNRecordBatch = async (recordId: string, updates: Partial<MARPRNRecord>) => {
    try {
      setSaving(true)
      const { error } = await supabase
        .from('mar_prn_records')
        .update(updates)
        .eq('id', recordId)
      if (error) throw error
      if (marForm?.patient_id && userProfile?.id) {
        await syncPrnRecordToProgressNotes(recordId)
      }
      return true
    } catch (err: any) {
      setError(err.message || 'Failed to update PRN record')
      setTimeout(() => setError(''), 5000)
      return false
    } finally {
      setSaving(false)
    }
  }

  const updatePRNRecord = async (recordId: string, field: 'hour' | 'result' | 'initials' | 'staff_signature' | 'reason' | 'note' | 'dosage' | 'date' | 'medication' | 'start_date', value: string | null): Promise<boolean> => {
    if (!marFormId) return false
    
    try {
      setSaving(true)
      
      const updateData: any = { [field]: value }
      
      // When setting/clearing staff_signature, set signed_by so we can show current profile signature for that user
      if (field === 'staff_signature') {
        updateData.signed_by = value ? (userProfile?.id ?? null) : null
      }
      
      // DB column is VARCHAR(10); never send data URL or >10 chars
      if (field === 'initials' && typeof value === 'string') {
        updateData.initials = value.startsWith('data:image') ? '' : value.slice(0, 10)
      }
      
      // If updating initials, also update staff_signature from legend if available
      if (field === 'initials' && updateData.initials) {
        const initialsUpper = updateData.initials.trim().toUpperCase()
        if (staffInitials[initialsUpper]) {
          updateData.staff_signature = staffInitials[initialsUpper]
        }
      }
      
      const { error } = await supabase
        .from('mar_prn_records')
        .update(updateData)
        .eq('id', recordId)

      if (error) throw error

      if (marForm?.patient_id && userProfile?.id) {
        await syncPrnRecordToProgressNotes(recordId)
      }

      // Do not refetch MAR form here: it overwrites optimistic state with stale data and makes initials/signature disappear
      setMessage('PRN record updated successfully!')
      setTimeout(() => setMessage(''), 3000)
      return true
    } catch (err: any) {
      setError(err.message || 'Failed to update PRN record')
      setTimeout(() => setError(''), 5000)
      return false
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

  const updateMedicationNotes = async (medicationId: string, notes: string | null) => {
    if (!marFormId) return
    
    try {
      setSaving(true)
      
      const { error } = await supabase
        .from('mar_medications')
        .update({ notes: notes?.trim() || null })
        .eq('id', medicationId)

      if (error) throw error

      await loadMARForm()
      setMessage('Medication notes updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || 'Failed to update medication notes')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  const updateMedicationEntry = async (entry: {
    ids: string[]
    isVitals: boolean
    medication_name: string
    dosage: string
    route: string | null
    start_date: string
    stop_date: string | null
    frequency: number | null
    frequency_display: string | null
    notes: string | null
    times: (string | null)[]
  }) => {
    if (!marFormId) return
    if (!entry.ids.length) return

    try {
      setSaving(true)

      const baseData: any = {
        medication_name: entry.medication_name.trim(),
        dosage: entry.dosage.trim(),
        start_date: entry.start_date,
        stop_date: entry.stop_date || null,
        frequency: entry.frequency,
        frequency_display: entry.frequency_display?.trim() || null,
      }

      if (!entry.isVitals) {
        baseData.route = entry.route?.trim() || null
        baseData.notes = entry.notes?.trim() || null
      } else {
        baseData.notes = 'Vital Signs Entry'
        baseData.route = entry.route?.trim() || null
      }

      // Update existing rows
      for (let i = 0; i < entry.ids.length; i++) {
        const id = entry.ids[i]
        const updateData = { ...baseData }
        if (i < entry.times.length) {
          updateData.hour = entry.times[i] ?? null
        }
        const { error } = await supabase
          .from('mar_medications')
          .update(updateData)
          .eq('id', id)
        if (error) throw error
      }

      // If form has more times than existing rows (e.g. frequency 3 but only 2 rows), insert missing rows
      if (entry.times.length > entry.ids.length) {
        let baseOrder = 0
        if (entry.ids.length > 0) {
          const { data: existing } = await supabase
            .from('mar_medications')
            .select('display_order')
            .in('id', entry.ids)
          // Use the SAME display_order as the first row in the group so they stay together
          baseOrder = existing?.length && existing[0].display_order != null
            ? existing[0].display_order
            : 0
        } else {
          const { data: maxRow } = await supabase
            .from('mar_medications')
            .select('display_order')
            .eq('mar_form_id', marFormId)
            .order('display_order', { ascending: false })
            .limit(1)
            .single()
          baseOrder = (maxRow?.display_order ?? 0) + 10
        }
        const toInsert = []
        for (let i = entry.ids.length; i < entry.times.length; i++) {
          toInsert.push({
            mar_form_id: marFormId,
            ...baseData,
            hour: entry.times[i] ?? null,
            display_order: baseOrder,
          })
        }
        const { error: insertError } = await supabase
          .from('mar_medications')
          .insert(toInsert)
        if (insertError) throw insertError
      }

      await loadMARForm()
      setMessage(`${entry.isVitals ? 'Vitals' : 'Medication'} entry updated successfully!`)
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      setError(err.message || `Failed to update ${entry.isVitals ? 'vitals' : 'medication'} entry`)
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  /** Parse MAR month_year (e.g. "2026-02", "02/2026", or "February 2026") to { year, month }. */
  const parseMARMonthYear = (monthYear: string): { y: number; m: number } | null => {
    const raw = String(monthYear || '').trim()
    const normalized = raw.replace(/\//g, '-')
    const parts = normalized.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
    let y = parts[0]
    let m = parts[1]
    if (parts.length >= 2 && m > 12) {
      [y, m] = [m, y]
    }
    if (y && m && m >= 1 && m <= 12) return { y, m }
    const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december']
    const lower = raw.toLowerCase()
    for (let i = 0; i < monthNames.length; i++) {
      if (lower.includes(monthNames[i])) {
        const match = raw.match(/\b(19|20)\d{2}\b/)
        const year = match ? parseInt(match[0], 10) : new Date().getFullYear()
        return { y: year, m: i + 1 }
      }
    }
    return null
  }

  /** First/last calendar day of the MAR month as YYYY-MM-DD for `<input type="date">`. */
  const getMarMonthDateRangeISO = (monthYear: string): { min: string; max: string } | null => {
    const parsed = parseMARMonthYear(monthYear)
    if (!parsed) return null
    const { y, m } = parsed
    const min = `${y}-${String(m).padStart(2, '0')}-01`
    const lastDay = new Date(y, m, 0).getDate()
    const max = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    return { min, max }
  }

  /** Human-readable MAR period; never editable in UI (month/year is fixed when the MAR is created). */
  const formatMarMonthYearDisplay = (monthYear: string): string => {
    const parsed = parseMARMonthYear(monthYear)
    if (!parsed) return monthYear?.trim() || '—'
    return new Date(parsed.y, parsed.m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const isPrnDateInMarMonth = (dateStr: string | null | undefined, monthYear: string | undefined): boolean => {
    if (!dateStr || !monthYear?.trim()) return false
    const range = getMarMonthDateRangeISO(monthYear)
    if (!range) return false
    const d = dateStr.includes('T') ? dateStr.slice(0, 10) : dateStr.slice(0, 10)
    if (d.length < 10) return false
    return d >= range.min && d <= range.max
  }

  const clampDateToMarMonth = (dateStr: string, monthYear: string | undefined): string => {
    if (!monthYear?.trim()) return dateStr
    const range = getMarMonthDateRangeISO(monthYear)
    if (!range) return dateStr
    const d = dateStr.slice(0, 10)
    if (d < range.min) return range.min
    if (d > range.max) return range.max
    return d
  }

  /** Day number for "today" only when the viewed MAR is the current month; otherwise null. */
  const todayDayInViewedMar = React.useMemo(() => {
    if (!marForm?.month_year) return null
    const parsed = parseMARMonthYear(marForm.month_year)
    if (!parsed) return null
    const now = new Date()
    if (parsed.y !== now.getFullYear() || parsed.m !== now.getMonth() + 1) return null
    return Math.min(31, now.getDate())
  }, [marForm?.month_year])

  /** Return plain text for a day cell for print (no buttons/links). */
  const getDayCellPrintText = (
    med: MARMedication,
    day: number,
    medAdmin: { [day: number]: MARAdministration },
    isVitalsEntry: boolean
  ): string => {
    const admin = medAdmin[day]
    const status = admin?.status || 'Not Given'
    const rawInitials = admin?.initials ?? ''
    const initialsForLogic = rawInitials.startsWith('data:image') ? '' : rawInitials.trim().toUpperCase()
    const initials = rawInitials.startsWith('data:image') ? '' : rawInitials
    const isNotGiven = status === 'Not Given'
    const isGiven = status === 'Given'
    const isPRN = status === 'PRN'
    const isDC = initialsForLogic === 'DC'
    const isRefused = initialsForLogic === 'R'
    const isHeld = initialsForLogic === 'H'
    let isDiscontinued = false
    if (!isVitalsEntry) {
      for (let checkDay = 1; checkDay < day; checkDay++) {
        const checkAdmin = medAdmin[checkDay]
        const checkRaw = checkAdmin?.initials ?? ''
        if (!checkRaw.startsWith('data:image') && checkRaw.trim().toUpperCase() === 'DC') {
          isDiscontinued = true
          break
        }
      }
    }
    if (isDiscontinued && !isDC) return '—'
    if (isDC) return 'DC'
    if (isRefused) return 'R'
    if (isHeld) return 'H'
    if (isGiven && initials) return initials
    if (isNotGiven && initials) return `○${initials}`
    if (isPRN) return 'PRN'
    return '—'
  }

  /** Sync MAR day note to Progress Notes Page 1. Includes time so each administration can be updated in place. */
  const syncMARNoteToProgressNotes = async (
    patientId: string,
    monthYear: string,
    day: number,
    note: string | null,
    timeLabel?: string
  ) => {
    if (!userProfile?.id) throw new Error('User profile not loaded; cannot sync to Progress Notes.')
    const parsed = parseMARMonthYear(monthYear)
    if (!parsed) throw new Error(`Invalid MAR month/year: ${monthYear}`)
    const { y, m } = parsed
    const lastDay = new Date(y, m, 0).getDate()
    const safeDay = Math.min(Math.max(1, day), lastDay)
    const noteDate = `${y}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`

    const { data: existing, error: fetchError } = await supabase
      .from('progress_note_entries')
      .select('id, notes')
      .eq('patient_id', patientId)
      .eq('note_date', noteDate)
      .limit(1)
      .maybeSingle()

    if (fetchError) throw new Error(`Progress note lookup failed: ${fetchError.message}`)

    const prefixWithTime = timeLabel ? `(from MAR, ${timeLabel})` : '(from MAR)'

    const removeLinesForTime = (text: string, label: string): string => {
      const prefix = `(from MAR, ${label})`
      const lines = text.split(/\n/)
      const kept = lines.filter((line) => !line.trim().startsWith(prefix))
      return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
    }

    if (note?.trim()) {
      const marBlock = `${prefixWithTime} ${note.trim()}`
      if (existing) {
        let prev = (existing.notes || '').trim()
        if (timeLabel) prev = removeLinesForTime(prev, timeLabel)
        const newNotes = prev ? `${prev}\n\n${marBlock}` : marBlock
        const { error: updateError } = await supabase
          .from('progress_note_entries')
          .update({ notes: newNotes, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
        if (updateError) throw new Error(`Progress note update failed: ${updateError.message}`)
      } else {
        const { error: insertError } = await supabase.from('progress_note_entries').insert({
          patient_id: patientId,
          note_date: noteDate,
          notes: marBlock,
          signature: null,
          physician_name: marForm?.physician_name ?? null,
          is_addendum: false,
          created_by: userProfile.id
        })
        if (insertError) throw new Error(`Progress note insert failed: ${insertError.message}`)
      }
    } else if (existing?.notes?.includes('(from MAR)')) {
      let prev = (existing.notes || '').trim()
      if (timeLabel) {
        prev = removeLinesForTime(prev, timeLabel)
      } else {
        prev = prev.split('(from MAR)')[0].trim()
      }
      const newNotes = prev || ''
      const { error: updateError } = await supabase
        .from('progress_note_entries')
        .update({ notes: newNotes, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (updateError) throw new Error(`Progress note update failed: ${updateError.message}`)
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

      if (marForm?.patient_id && marForm?.month_year) {
        const med = medications.find((m) => m.id === medId)
        const timeLabel = med?.hour ? formatTimeDisplay(med.hour) : undefined
        await syncMARNoteToProgressNotes(marForm.patient_id, marForm.month_year, day, note ?? null, timeLabel)
      }

      await loadMARForm()
      setMessage(note?.trim() ? 'Administration note saved and synced to Progress Notes.' : 'Administration note updated successfully!')
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
    
    // Date input expects YYYY-MM-DD
    if (field === 'date' && currentValue) {
      setEditingPRNValue(currentValue.includes('T') ? currentValue.slice(0, 10) : currentValue)
      return
    }
    // Auto-populate initials from user profile if editing initials field
    if (field === 'initials') {
      const isDrawn = currentValue?.startsWith('data:image')
      if (isDrawn) {
        setEditingPRNValue('') // Don't put data URL in text input; show placeholder
        return
      }
      let userInitials = ''
      if (userProfile?.staff_initials && !userProfile.staff_initials.startsWith('data:image')) {
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
    } else if (field === 'medication') {
      const record = prnRecords.find(r => r.id === recordId)
      const matched = prnMedicationList.find(
        (m) =>
          m.medication === (record?.medication || '') &&
          (m.dosage || '') === (record?.dosage || '') &&
          m.reason === (record?.reason || '')
      )
      setEditingPRNValue(matched?.id || '')
    } else if (field === 'staff_signature' && currentValue?.startsWith('data:image')) {
      setEditingPRNValue('') // Don't put data URL in text input
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
    
    const dbField = field === 'hour' ? 'hour' : field === 'result' ? 'result' : field === 'initials' ? 'initials' : field === 'reason' ? 'reason' : field === 'dosage' ? 'dosage' : field === 'date' ? 'date' : field === 'medication' ? 'medication' : field === 'start_date' ? 'start_date' : 'staff_signature'
    let valueToSave = editingPRNValue.trim() || null
    if (field === 'date' && !valueToSave && record) valueToSave = record.date
    if (field === 'start_date' && !valueToSave && record) valueToSave = record.start_date || null
    if (field === 'medication' && !valueToSave && record) valueToSave = record.medication || null
    if ((field === 'initials' || field === 'staff_signature') && !valueToSave && record) {
      const existing = field === 'initials' ? record.initials : record.staff_signature
      if (existing?.startsWith('data:image')) valueToSave = existing
    }
    if (dbField === 'date' && valueToSave && marForm?.month_year && !isPrnDateInMarMonth(valueToSave, marForm.month_year)) {
      setError('PRN date must fall within this MAR month.')
      setTimeout(() => setError(''), 5000)
      setEditingPRNField(null)
      setEditingPRNValue('')
      return
    }
    
    // Special handling for start_date: update all records with the same medication
    if (field === 'start_date' && record) {
      const medicationName = record.medication
      const recordsToUpdate = prnRecords.filter(r => r.medication === medicationName)
      
      try {
        setSaving(true)
        const { error } = await supabase
          .from('mar_prn_records')
          .update({ start_date: valueToSave })
          .eq('mar_form_id', marFormId)
          .eq('medication', medicationName)
        
        if (error) throw error
        
        // Update local state for all matching records
        setPrnRecords(prev => prev.map(r => 
          r.medication === medicationName ? { ...r, start_date: valueToSave } : r
        ))
        
        setMessage(`Start date updated for all ${recordsToUpdate.length} record(s) of ${medicationName}`)
        setTimeout(() => setMessage(''), 3000)
      } catch (err: any) {
        setError(err.message || 'Failed to update start date')
        setTimeout(() => setError(''), 5000)
      } finally {
        setSaving(false)
      }
      
      setEditingPRNField(null)
      setEditingPRNValue('')
      return
    }
    
    const ok = await updatePRNRecord(recordId, dbField as 'hour' | 'result' | 'initials' | 'staff_signature' | 'reason' | 'dosage' | 'date' | 'medication' | 'start_date', valueToSave)
    if (ok) {
      setPrnRecords(prev => prev.map(r => r.id === recordId ? { ...r, [dbField]: valueToSave } : r))
    }
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
        
        const formParsed = parseMARMonthYear(marForm.month_year)
        const formYear = formParsed?.y
        const formMonthIndex = formParsed != null ? formParsed.m - 1 : -1
        
        // Check if start date is in the same month/year as the form
        if (formYear != null && formMonthIndex >= 0 && startYear === formYear && startMonth === formMonthIndex) {
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
    frequency?: number
    times?: string[]
    frequencyDisplay?: string | null
  }, position?: { targetMedId: string; position: 'above' | 'below' } | null) => {
    if (!userProfile || !marForm || !marFormId) return
    
    try {
      setSaving(true)
      setError('')
      
      const frequency = vitalsData.frequency || 1
      const times = vitalsData.times && vitalsData.times.length > 0 ? vitalsData.times : [vitalsData.hour || null]
      
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
      
      // Create vital sign entries (one for each time if multiple times per day)
      const vitalRowsToInsert = Array.from({ length: frequency }, (_, i) => ({
        mar_form_id: marFormId,
        medication_name: 'VITALS',
        dosage: vitalsData.notes,
        start_date: vitalsData.startDate,
        stop_date: vitalsData.stopDate,
        hour: times[i] || null,
        notes: 'Vital Signs Entry',
        route: vitalsData.initials || null,
        frequency: frequency,
        frequency_display: vitalsData.frequencyDisplay || null,
        display_order: displayOrder
      }))

      const { data: newVitals, error: vitalError } = await supabase
        .from('mar_medications')
        .insert(vitalRowsToInsert)
        .select()

      if (vitalError) throw vitalError

      // Populate initials for the START DATE of the vitals entry (only for the first row)
      if (newVitals && newVitals.length > 0) {
        const firstVital = newVitals[0]
        const startDateParts = vitalsData.startDate.split('-')
        if (startDateParts.length === 3 && vitalsData.initials) {
          const startYear = parseInt(startDateParts[0], 10)
          const startMonth = parseInt(startDateParts[1], 10) - 1
          const startDay = parseInt(startDateParts[2], 10)
          
          const formParsed = parseMARMonthYear(marForm.month_year)
          const formYear = formParsed?.y
          const formMonthIndex = formParsed != null ? formParsed.m - 1 : -1
          
          if (formYear != null && formMonthIndex >= 0 && startMonth === formMonthIndex && startYear === formYear) {
            // Create administration record for the start day (only for the first vitals row)
            await supabase
              .from('mar_administrations')
              .insert({
                mar_medication_id: firstVital.id,
                day_number: startDay,
                status: 'Given',
                initials: vitalsData.initials.trim(),
                administered_at: new Date().toISOString()
              })
          }
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

  /** While dragging, table rows in this group are hidden and `DragOverlay` shows the full block. */
  const [activeMarDragId, setActiveMarDragId] = useState<string | null>(null)
  const marDragPreviewGroupMeds = useMemo(() => {
    if (!activeMarDragId) return [] as MARMedication[]
    const m = medications.find((x) => x.id === activeMarDragId)
    if (!m) return []
    const gk = getMarMedicationGroupKey(m)
    return medications.filter((x) => getMarMedicationGroupKey(x) === gk)
  }, [activeMarDragId, medications])
  const draggingGroupMedIdSet = useMemo(
    () => new Set(marDragPreviewGroupMeds.map((x) => x.id)),
    [marDragPreviewGroupMeds]
  )

  /** Full-width line showing where the dragged parent group will land (no row transforms — avoids splitting rowSpan stacks). */
  const [marReorderDropIndicator, setMarReorderDropIndicator] = useState<
    { mode: 'before' | 'after'; medId: string } | null
  >(null)

  const handleMarDragOver = useCallback(
    (event: DragOverEvent) => {
      if (marRowReorderLocked) return
      const { active, over } = event
      if (!over?.id) {
        setMarReorderDropIndicator(null)
        return
      }
      const activeId = String(active.id)
      const overId = String(over.id)
      const draggedMed = displayMedications.find((m) => m.id === activeId)
      const targetMed = displayMedications.find((m) => m.id === overId)
      if (!draggedMed || !targetMed) {
        setMarReorderDropIndicator(null)
        return
      }
      const draggedGroupKey = getMarMedicationGroupKey(draggedMed)
      const targetGroupKey = getMarMedicationGroupKey(targetMed)
      if (draggedGroupKey === targetGroupKey) {
        setMarReorderDropIndicator(null)
        return
      }
      const draggedGroupMeds = displayMedications.filter((m) => getMarMedicationGroupKey(m) === draggedGroupKey)
      const targetGroupMeds = displayMedications.filter((m) => getMarMedicationGroupKey(m) === targetGroupKey)
      const draggedFirstIndex = displayMedications.findIndex((m) => m.id === draggedGroupMeds[0].id)
      const targetIndex = displayMedications.findIndex((m) => m.id === overId)
      if (draggedFirstIndex === -1 || targetIndex === -1) {
        setMarReorderDropIndicator(null)
        return
      }
      const insertBeforeTargetGroup = draggedFirstIndex > targetIndex
      if (insertBeforeTargetGroup) {
        setMarReorderDropIndicator({ mode: 'before', medId: targetGroupMeds[0].id })
      } else {
        setMarReorderDropIndicator({
          mode: 'after',
          medId: targetGroupMeds[targetGroupMeds.length - 1].id,
        })
      }
    },
    [displayMedications, marRowReorderLocked]
  )

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
      // Find the dragged medication and its group
      const draggedMed = medications.find(m => m.id === active.id)
      const targetMed = medications.find(m => m.id === over.id)
      
      if (!draggedMed || !targetMed) return

      const draggedGroupKey = getMarMedicationGroupKey(draggedMed)
      const targetGroupKey = getMarMedicationGroupKey(targetMed)

      // Get all medications in the dragged group
      const draggedGroupMeds = medications.filter(m => getMarMedicationGroupKey(m) === draggedGroupKey)
      const targetGroupMeds = medications.filter(m => getMarMedicationGroupKey(m) === targetGroupKey)
      
      // Get the indices of the first med in each group
      const draggedFirstIndex = medications.findIndex(m => m.id === draggedGroupMeds[0].id)
      const targetIndex = medications.findIndex(m => m.id === over.id)

      if (draggedFirstIndex === -1 || targetIndex === -1) return

      // Remove all meds from dragged group from the array
      let newMedications = medications.filter(m => getMarMedicationGroupKey(m) !== draggedGroupKey)
      
      // If target was in the dragged group, just restore original order
      if (draggedGroupKey === targetGroupKey) return

      // Find the new target index after removal (`over` is always first row of target group in UI)
      const newTargetIndex = newMedications.findIndex(m => m.id === over.id)
      
      if (newTargetIndex === -1) {
        return
      }

      // Insert before the whole target group, or after all of its rows (never inside multi-time stacks)
      const insertBeforeTargetGroup = draggedFirstIndex > targetIndex
      const insertIndex = insertBeforeTargetGroup
        ? newTargetIndex
        : newTargetIndex + targetGroupMeds.length

      // Insert all dragged group meds at the new position
      newMedications = [
        ...newMedications.slice(0, insertIndex),
        ...draggedGroupMeds,
        ...newMedications.slice(insertIndex)
      ]

      // Update local state for immediate UI feedback
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

      // Load PRN medication library (used by Add PRN Record medication dropdown)
      const { data: prnMedsData, error: prnMedsError } = await supabase
        .from('mar_prn_medications')
        .select('*')
        .eq('mar_form_id', marFormId)
        .order('created_at', { ascending: false })

      if (prnMedsError) {
        // Allow app to function before migration is applied.
        if (prnMedsError.message?.includes('does not exist')) {
          setPrnMedicationList([])
        } else {
          throw prnMedsError
        }
      } else {
        setPrnMedicationList((prnMedsData || []) as MARPRNMedication[])
      }

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
  const MAR_COL = { med: 200, startStop: 120, hour: 150, day: 100 } as const
  const hourColWidth = readOnly ? 90 : MAR_COL.hour

  /** Key so print view remounts when MAR data changes and shows current state in print preview. */
  const printDataKey = [
    medications.map((m) => m.id).join(','),
    Object.entries(administrations)
      .map(([id, daysByDay]) =>
        Object.entries(daysByDay)
          .map(([d, a]) => `${d}:${a?.status ?? ''}:${(a?.initials ?? '').slice(0, 10)}`)
          .sort((a, b) => Number(a.split(':')[0]) - Number(b.split(':')[0]))
          .join(';')
      )
      .sort()
      .join('|')
  ].join('::')

  /** Print pagination: group keys in order and row ranges so we can chunk by pixel height. Order matches MAR page; multi-time medications and vitals are grouped (never split). */
  const printGroupInfo = React.useMemo(() => {
    const medicationGroups: { [key: string]: { meds: MARMedication[]; rowSpan: number } } = {}
    medications.forEach((med) => {
      const gk = getMarMedicationGroupKey(med)
      if (!medicationGroups[gk]) medicationGroups[gk] = { meds: [], rowSpan: 0 }
      medicationGroups[gk].meds.push(med)
    })
    Object.keys(medicationGroups).forEach((k) => { medicationGroups[k].rowSpan = medicationGroups[k].meds.length })
    const isFirstInGroup: { [medId: string]: boolean } = {}
    Object.values(medicationGroups).forEach((g) => { if (g.meds.length > 0) isFirstInGroup[g.meds[0].id] = true })
    const groupKeysInOrder: string[] = []
    const seen: { [k: string]: boolean } = {}
    medications.forEach((med) => {
      const gk = getMarMedicationGroupKey(med)
      if (!seen[gk]) { groupKeysInOrder.push(gk); seen[gk] = true }
    })
    const groupRanges: { start: number; end: number }[] = []
    let row = 0
    groupKeysInOrder.forEach((gk) => {
      const span = medicationGroups[gk].rowSpan
      groupRanges.push({ start: row, end: row + span })
      row += span
    })
    return { medicationGroups, isFirstInGroup, groupKeysInOrder, groupRanges }
  }, [medications])

  /** Measure each row height (px) for both half-month tables; use max so chunking fits both halves (rows with notes on 16–31 are taller there). */
  useLayoutEffect(() => {
    const tbody1 = marMeasureTbodyRef.current
    const tbody2 = marMeasureTbodyRef2.current
    if (!tbody1 || medications.length === 0) {
      if (medications.length === 0) setPrintRowHeights([])
      return
    }
    const trs1 = Array.from(tbody1.querySelectorAll<HTMLTableRowElement>('tr'))
    if (trs1.length !== medications.length) return
    const heights1 = trs1.map((tr) => tr.offsetHeight)
    let heights2: number[] = heights1
    if (tbody2) {
      const trs2 = Array.from(tbody2.querySelectorAll<HTMLTableRowElement>('tr'))
      if (trs2.length === medications.length) {
        heights2 = trs2.map((tr) => tr.offsetHeight)
      }
    }
    const maxHeights = heights1.map((h, i) => Math.max(h, heights2[i] ?? 0))
    setPrintRowHeights(maxHeights)
  }, [medications.length, printDataKey])

  /** Paper and print area in pixels (CSS: 96px = 1in). Landscape: short side is height. */
  const PRINT_PAGE_HEIGHT_PX = 8.5 * 96
  const PRINT_MARGIN_PX = 0.5 * 96 * 2
  const PRINT_BROWSER_HEADER_FOOTER_PX = 120
  const PRINT_MAR_HEADER_PX = 72 // MAR title + Patient | DOB | Sex | Month/Year | Facility line + padding (p-4 pb-2)
  const PRINT_TABLE_HEADER_ROW_PX = 28
  const PRINT_ROW_BORDER_PX = 1
  const PRINT_SAFETY_BUFFER_PX = 80 // leave room so rows never spill; print can differ from measured layout
  const PRINT_AVAILABLE_TBODY_PX = Math.max(100, PRINT_PAGE_HEIGHT_PX - PRINT_MARGIN_PX - PRINT_BROWSER_HEADER_FOOTER_PX - PRINT_MAR_HEADER_PX - PRINT_TABLE_HEADER_ROW_PX - PRINT_SAFETY_BUFFER_PX)

  /** Chunk by pixel height so each page fits; never split a multi-time medication across pages. Order matches MAR (VITALS stay in page order). */
  const printMedicationChunks = React.useMemo((): MARMedication[][] => {
    const { groupKeysInOrder, groupRanges, medicationGroups } = printGroupInfo
    if (medications.length === 0) return [[]]
    if (printRowHeights.length !== medications.length) {
      const fallbackRowsPerPage = Math.max(1, Math.floor(PRINT_AVAILABLE_TBODY_PX / 40))
      const chunks: MARMedication[][] = []
      for (let i = 0; i < medications.length; i += fallbackRowsPerPage) chunks.push(medications.slice(i, i + fallbackRowsPerPage))
      return chunks.length ? chunks : [[]]
    }
    const groupHeights = groupRanges.map(({ start, end }) => {
      let h = 0
      for (let r = start; r < end; r++) h += printRowHeights[r] + PRINT_ROW_BORDER_PX
      return h
    })
    const chunks: MARMedication[][] = []
    let current: MARMedication[] = []
    let currentH = 0
    for (let g = 0; g < groupKeysInOrder.length; g++) {
      const need = groupHeights[g]
      if (current.length > 0 && currentH + need > PRINT_AVAILABLE_TBODY_PX) {
        chunks.push(current)
        current = []
        currentH = 0
      }
      const groupMeds = medicationGroups[groupKeysInOrder[g]]?.meds ?? []
      current.push(...groupMeds)
      currentH += need
    }
    if (current.length > 0) chunks.push(current)
    return chunks
  }, [medications, printRowHeights, printGroupInfo])

  /** Defer print so React has committed latest state and browser has painted the print view. */
  const handlePrint = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print()
      })
    })
  }

  /** Renders MAR table body rows for print/measure (shared by measurement table and print pages). When rowHeights + startIndex are passed, each <tr> gets that height so first-half and second-half pages match. */
  const renderMarPrintRows = (meds: MARMedication[], daySubset: number[], startIndex?: number, rowHeights?: number[]) => {
    const { medicationGroups, isFirstInGroup } = printGroupInfo
    if (meds.length === 0) {
      return (
        <tr>
          <td colSpan={3 + daySubset.length} className="border border-gray-400 px-2 py-4 text-left text-gray-500">No medications recorded.</td>
        </tr>
      )
    }
    return meds.map((med, i) => {
      const medAdmin = administrations[med.id] || {}
      const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
      const groupKey = getMarMedicationGroupKey(med)
      const group = medicationGroups[groupKey]
      const shouldMerge = group && group.rowSpan > 1
      const isFirstRow = isFirstInGroup[med.id] || false
      const rowSpan = shouldMerge ? group.rowSpan : undefined
      const rowHeightPx = rowHeights != null && startIndex != null ? rowHeights[startIndex + i] : undefined
      return (
        <tr
          key={med.id}
          className={isVitalsEntry ? 'bg-blue-50' : ''}
          style={rowHeightPx != null ? { height: rowHeightPx, minHeight: rowHeightPx } : undefined}
        >
          {(shouldMerge && !isFirstRow) ? null : (
            <td rowSpan={rowSpan} className="border border-gray-400 px-2 py-1.5 align-top">
              <div className="font-medium text-gray-900">{med.medication_name}</div>
              {med.dosage && <div className="text-gray-600">{med.dosage}</div>}
              {!isVitalsEntry && med.route && <div className="text-gray-500 italic text-xs">{med.route}</div>}
              {!isVitalsEntry && med.frequency != null && med.frequency > 0 && (
                <div className="text-gray-500 text-xs">{med.frequency_display || `${med.frequency} time${med.frequency > 1 ? 's' : ''} per day`}</div>
              )}
              {!isVitalsEntry && med.notes && <div className="text-gray-500 text-xs">{med.notes}</div>}
              {!isVitalsEntry && med.parameter && <div className="italic text-gray-500 text-xs border-t border-gray-300 mt-0.5 pt-0.5">{med.parameter}</div>}
            </td>
          )}
          {(shouldMerge && !isFirstRow) ? null : (
            <td rowSpan={rowSpan} className="border border-gray-400 px-0.5 py-1.5 text-left align-top">
              <div className="font-semibold">Start</div>
              <div>
                {new Date(med.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              {med.stop_date && (
                <div className="mt-1.5">
                  <div className="font-semibold">Stop</div>
                  <div>
                    {new Date(med.stop_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              )}
            </td>
          )}
          <td className="border border-gray-400 px-0.5 py-1.5 text-left">{isVitalsEntry ? '—' : (med.hour ? formatTimeDisplay(med.hour) : '—')}</td>
          {daySubset.map((day) => {
            const admin = medAdmin[day]
            const note = admin?.notes?.trim() || null
            const initialsDataUrl = admin?.initials?.startsWith('data:image') ? admin.initials : null
            const status = admin?.status || 'Not Given'
            const isGiven = status === 'Given'
            const isNotGiven = status === 'Not Given'
            const showImageInitials = initialsDataUrl && (isGiven || isNotGiven)
            return (
              <td key={day} className="border border-gray-400 px-1 py-1 text-center align-top">
                <div>
                  {showImageInitials ? (
                    <>
                      {isNotGiven && <span className="text-red-600 font-bold">○ </span>}
                      <img
                        src={initialsDataUrl!}
                        alt="Initials"
                        style={{ maxHeight: '1.25em', maxWidth: '3em', display: 'inline-block', verticalAlign: 'middle' }}
                      />
                    </>
                  ) : (
                    getDayCellPrintText(med, day, medAdmin, isVitalsEntry)
                  )}
                </div>
                {note && <div className="text-xs text-gray-600 mt-0.5 break-words leading-tight">{note}</div>}
              </td>
            )
          })}
        </tr>
      )
    })
  }

  // Show loading state while router is initializing
  if (!router.isReady || loading) {
    return (
      <ProtectedRoute>
        <Head>
          <title>Loading MAR Form - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <AppHeader
              userProfile={userProfile}
              onLogout={handleLogout}
              patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
              patientName={undefined}
            />
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
          <AppHeader
              userProfile={userProfile}
              onLogout={handleLogout}
              patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
              patientName={undefined}
            />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button 
                onClick={() => router.push(typeof patientId === 'string' ? `/patients/${patientId}/forms` : Array.isArray(patientId) && patientId[0] ? `/patients/${patientId[0]}/forms` : '/dashboard')} 
                className="px-4 py-2 bg-lasso-navy text-white rounded-md"
              >
                Back to MAR Forms
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
          <AppHeader
              userProfile={userProfile}
              onLogout={handleLogout}
              patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
              patientName={undefined}
            />
          <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <p className="text-red-600 mb-4">MAR form not found</p>
            <button 
                onClick={() => router.push(typeof patientId === 'string' ? `/patients/${patientId}/forms` : Array.isArray(patientId) && patientId[0] ? `/patients/${patientId[0]}/forms` : '/dashboard')} 
                className="px-4 py-2 bg-lasso-navy text-white rounded-md"
              >
                Back to MAR Forms
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
          <AppHeader
              userProfile={userProfile}
              onLogout={handleLogout}
              patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
              patientName={undefined}
            />
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
        <style dangerouslySetInnerHTML={{ __html: `
          .mar-print-view { display: none; }
          @media print {
            .no-print { display: none !important; }
            body * { visibility: hidden; }
            .mar-print-view, .mar-print-view * { visibility: visible; }
            .mar-print-view { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @page { size: landscape; margin: 0.5in; }
            .mar-print-measure { display: none !important; }
          }
          .mar-print-measure { position: absolute; left: -9999px; top: 0; width: 960px; visibility: hidden; pointer-events: none; }
        `}} />
      </Head>
      <div className="min-h-screen">
        <div className="no-print">
          <AppHeader
              userProfile={userProfile}
              onLogout={handleLogout}
              patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
              patientName={marForm?.patient_name}
            />
        </div>
        <PatientStickyBar
          patientName={marForm?.patient_name}
          dateOfBirth={marForm?.date_of_birth}
          sex={marForm?.sex}
          allergies={marForm?.allergies}
          recordNumber={marForm?.record_number}
        />

        {/* Main Content - 95vw with min 1000px so the white MAR card uses almost the full screen */}
        <div className="no-print w-[95vw] min-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Navigation */}
          <div className="mb-6">
            <button
              onClick={() => router.push(marForm?.patient_id ? `/patients/${marForm.patient_id}/forms` : '/dashboard')}
              className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm mb-4"
            >
              ← Back to MAR Forms
            </button>
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                Medication Administration Record (MAR)
              </h1>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm font-medium"
                >
                  Print
                </button>
                {!readOnly && (
                  <>
                    <button
                      onClick={() => {
                        setInsertPosition(null) // Clear position when using regular add button
                        setEditingEntry(null) // Clear editing entry to ensure add mode
                        setShowAddMedModal(true)
                      }}
                      className="px-4 py-2 bg-lasso-teal text-white rounded-md hover:brightness-90 text-sm font-medium"
                    >
                      + Medication
                    </button>
                    <button
                      onClick={() => setShowVitalSignsModal(true)}
                      className="px-4 py-2 bg-purple-700 text-white rounded-md hover:brightness-90 text-sm font-medium"
                    >
                      + Vital Signs
                    </button>
                    <button
                      onClick={() => setShowAddPRNModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                    >
                      + PRN
                    </button>
                  </>
                )}
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
                  <div className="flex items-center">
                    <span className="text-lg font-medium text-gray-800 dark:text-white select-none cursor-default">
                      {formatMarMonthYearDisplay(marForm.month_year)}
                    </span>
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-800 dark:text-white">
                      Facility Name: {facilityNameFromProfile ?? marForm.facility_name ?? 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">From your profile (assigned facility)</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Filter MAR table rows"
                  >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Show</span>
                  {([
                    { id: 'all' as const, label: 'All' },
                    { id: 'routine_meds' as const, label: 'Routine meds' },
                    { id: 'vitals_only' as const, label: 'Vitals' },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMarTableViewFilter(id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        marTableViewFilter === id
                          ? 'bg-lasso-teal text-white border-lasso-teal shadow-sm'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  </div>
                  {/* Hidden for now - will be re-enabled when PRN records are integrated into MAR chart
                  <button
                    type="button"
                    onClick={() => setShowAddPRNRecordModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
                  >
                    + Add PRN Record
                  </button>
                  */}
                </div>
              </div>

              {/* Medication Administration Table - sticky header OUTSIDE overflow so it sticks to viewport; body has overflow-x for horizontal scroll */}
              <div className="relative overflow-visible">
                {/* Sticky header: no overflow on sticky div so it sticks to viewport; inner div handles horizontal scroll sync */}
                <div className="sticky top-[35px] z-30 bg-white dark:bg-gray-800 overflow-visible" style={{ marginBottom: -1 }}>
                  <div ref={marHeaderScrollRef} className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <table className="min-w-full border border-gray-300 dark:border-gray-600 border-b-0" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: MAR_COL.med, minWidth: MAR_COL.med }} />
                      <col style={{ width: MAR_COL.startStop, minWidth: MAR_COL.startStop }} />
                      <col style={{ width: hourColWidth, minWidth: hourColWidth }} />
                      {days.map((_, i) => <col key={`sc-${i}`} style={{ width: MAR_COL.day, minWidth: MAR_COL.day }} />)}
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-700">
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 sticky left-0 z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#f3f4f6] dark:shadow-[4px_0_0_0_#374151]" style={{ width: MAR_COL.med, minWidth: MAR_COL.med, maxWidth: MAR_COL.med }}>
                          Medication
                        </th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 sticky z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#f3f4f6] dark:shadow-[4px_0_0_0_#374151]" style={{ width: MAR_COL.startStop, minWidth: MAR_COL.startStop, maxWidth: MAR_COL.startStop, left: MAR_COL.med }}>
                          Start/Stop Date
                        </th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-center text-xs font-medium text-gray-700 dark:text-gray-300 sticky z-20 bg-gray-100 dark:bg-gray-700 border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#f3f4f6] dark:shadow-[4px_0_0_0_#374151]" style={{ width: hourColWidth, minWidth: hourColWidth, maxWidth: hourColWidth, left: MAR_COL.med + MAR_COL.startStop }}>
                          Hour
                        </th>
                        {days.map(day => (
                          <th
                            key={day}
                            className={`border border-gray-300 dark:border-gray-600 px-1 py-2 text-center text-xs font-medium ${
                              day === todayDayInViewedMar
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                            style={{ width: MAR_COL.day, minWidth: MAR_COL.day, maxWidth: MAR_COL.day }}
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  </table>
                  </div>
                </div>
                <div ref={marTableScrollRef} className="overflow-x-auto overflow-y-visible bg-white dark:bg-gray-800 pb-8">
                <table className="min-w-full border border-gray-300 dark:border-gray-600" style={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: MAR_COL.med, minWidth: MAR_COL.med }} />
                    <col style={{ width: MAR_COL.startStop, minWidth: MAR_COL.startStop }} />
                    <col style={{ width: hourColWidth, minWidth: hourColWidth }} />
                    {days.map((_, i) => <col key={i} style={{ width: MAR_COL.day, minWidth: MAR_COL.day }} />)}
                  </colgroup>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={(e: DragStartEvent) => {
                      setActiveMarDragId(String(e.active.id))
                      setMarReorderDropIndicator(null)
                    }}
                    onDragOver={handleMarDragOver}
                    onDragCancel={() => {
                      setActiveMarDragId(null)
                      setMarReorderDropIndicator(null)
                    }}
                    onDragEnd={(e) => {
                      setMarReorderDropIndicator(null)
                      void handleDragEnd(e)
                      window.setTimeout(() => setActiveMarDragId(null), 200)
                    }}
                  >
                    <SortableContext
                      items={marSortableFirstRowIds}
                      strategy={marGroupReorderNoLayoutShiftStrategy}
                    >
                      <tbody>
                    {displayMedications.length === 0 ? (
                      <tr>
                        <td colSpan={3 + days.length} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                          {medications.length === 0
                            ? 'No medications recorded. Click "+ Medication" to add one.'
                            : marTableViewFilter === 'routine_meds'
                              ? 'No routine medications in this view. Choose All or Vitals.'
                              : 'No vital signs rows in this view. Choose All or Routine meds.'}
                        </td>
                      </tr>
                    ) : (() => {
                      // Group medications by name, dosage, and dates to calculate rowSpan
                      const medicationGroups: { [key: string]: { meds: typeof displayMedications, rowSpan: number } } = {}
                      displayMedications.forEach((med) => {
                        const groupKey = getMarMedicationGroupKey(med)
                        
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
                      
                      return displayMedications.map((med, medIndex) => {
                        const medAdmin = administrations[med.id] || {}
                        const isVitalsEntry = med.medication_name === 'VITALS' || med.notes === 'Vital Signs Entry'
                        const groupKey = getMarMedicationGroupKey(med)
                        const group = medicationGroups[groupKey]
                        const shouldMerge = group && group.rowSpan > 1
                        const isFirstRow = isFirstInGroup[med.id] || false
                        const isFirstTableRow = medIndex === 0
                        
                        const marDropLineColSpan = 3 + days.length
                        const showDropLineBefore =
                          marReorderDropIndicator?.mode === 'before' && marReorderDropIndicator.medId === med.id
                        const showDropLineAfter =
                          marReorderDropIndicator?.mode === 'after' && marReorderDropIndicator.medId === med.id

                        return (
                          <Fragment key={med.id}>
                            {showDropLineBefore ? (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={marDropLineColSpan} className="p-0 border-0 leading-none">
                                  <div className="h-1.5 w-full bg-sky-500 dark:bg-sky-400 z-[25] shadow-sm rounded-sm" />
                                </td>
                              </tr>
                            ) : null}
                            <MarMedTableRow 
                            sortableId={isFirstInGroup[med.id] ? med.id : null}
                            sortableDisabled={marRowReorderLocked}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              draggingGroupMedIdSet.has(med.id) ? 'opacity-0 pointer-events-none' : ''
                            }`}
                            onMouseMove={(e) => {
                              // Use medication cell rect when hovered (spans multiple rows) so Add below triggers only near actual bottom; else use row rect
                              const medCell = (e.target as HTMLElement).closest?.('[data-medication-cell]') as HTMLElement | null
                              const rect = medCell?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect()
                              const mouseY = e.clientY - rect.top
                              const height = rect.height
                              const edgeZone = 8 // pixels from edge to trigger (same as Add above - must be near actual top/bottom of the box)
                              
                              if (mouseY >= 0 && mouseY < edgeZone) {
                                if (rowHover?.rowId !== med.id || rowHover?.position !== 'top') {
                                  setRowHover({ rowId: med.id, position: 'top' })
                                }
                              } else if (mouseY > height - edgeZone && mouseY <= height) {
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
                                data-medication-cell
                                className={`border border-gray-300 dark:border-gray-600 px-3 py-2 align-top sticky left-0 ${
                                  isVitalsEntry 
                                    ? 'bg-[#ecdcfa] dark:bg-[#3d2254] hover:brightness-90' 
                                    : 'bg-[#d7f0f7] dark:bg-[#1a4a52] hover:brightness-90'
                                } border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#cbd5e1] dark:shadow-[4px_0_0_0_#334155] relative overflow-visible ${rowHover?.rowId === med.id ? 'z-20' : 'z-10'}`}
                                style={{ width: MAR_COL.med, minWidth: MAR_COL.med, maxWidth: MAR_COL.med }}
                              >
                                {/* Add Row Indicator - Top: for first row keep pill inside cell so it's not clipped by scroll container */}
                                {!readOnly && rowHover?.rowId === med.id && rowHover?.position === 'top' && (
                                  <div 
                                    className={`absolute left-0 right-0 min-h-[2rem] z-50 flex items-center cursor-pointer hover:bg-lasso-teal/20 transition-colors ${isFirstTableRow ? 'top-0' : '-top-7 pt-5 bg-transparent'}`}
                                    style={{ width: '5000px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setInsertPosition({ targetMedId: med.id, position: 'above' })
                                      setEditingEntry(null) // Clear editing entry to ensure add mode
                                      setShowAddMedModal(true)
                                    }}
                                    onMouseEnter={() => setRowHover({ rowId: med.id, position: 'top' })}
                                  >
                                    <div className="ml-4 bg-lasso-teal text-white text-xs px-3 py-1 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap font-medium">
                                      <span className="text-sm font-bold">+</span> Add above
                                    </div>
                                  </div>
                                )}
                                {/* Add Row Indicator - Bottom */}
                                {!readOnly && rowHover?.rowId === med.id && rowHover?.position === 'bottom' && (
                                  <div 
                                    className="absolute left-0 right-0 -bottom-1 min-h-[2rem] py-1 bg-lasso-teal z-50 flex items-center cursor-pointer hover:bg-lasso-blue transition-colors"
                                    style={{ width: '5000px' }}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setInsertPosition({ targetMedId: med.id, position: 'below' })
                                      setEditingEntry(null) // Clear editing entry to ensure add mode
                                      setShowAddMedModal(true)
                                    }}
                                    onMouseEnter={() => setRowHover({ rowId: med.id, position: 'bottom' })}
                                  >
                                    <div className="ml-4 bg-lasso-teal text-white text-xs px-3 py-0.5 rounded-full shadow-lg flex items-center gap-1 whitespace-nowrap font-medium">
                                      <span className="text-sm font-bold">+</span> Add below
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2 group/medcell">
                                  {/* Left column: drag handle + action icons (vertically stacked, aligned) */}
                                  <div className="flex flex-col items-start gap-1 shrink-0">
                                    <DragHandleButton medId={med.id} readOnly={readOnly} reorderLocked={marRowReorderLocked} />
                                    {!readOnly && (
                                    <div className="flex flex-col items-start gap-1">
                                      {/* Add parameter - first (always showing) */}
                                      {!isVitalsEntry && med.medication_name && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setEditingMedicationParameter({ medicationId: med.id, parameter: med.parameter })
                                            setShowMedicationParameterModal(true)
                                          }}
                                          className="w-6 h-6 min-w-6 min-h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-all cursor-pointer text-[#000000] dark:text-white flex items-center justify-center group/param relative"
                                        >
                                          {med.parameter ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                                            </svg>
                                          ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                            </svg>
                                          )}
<span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover/param:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          {med.parameter ? 'Edit parameter' : 'Add parameter'}
                                        </span>
                                        </button>
                                      )}
                                      {/* Edit medication - second */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const isMulti = group && group.rowSpan > 1
                                          const sortedMeds = isMulti
                                            ? [...group.meds].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                                            : [med]
                                          const ids = sortedMeds.map(m => m.id)
                                          const times = sortedMeds.map(m => (m.hour != null && m.hour !== '') ? m.hour : '')
                                          setEditingEntry({
                                            id: med.id,
                                            isVitals: isVitalsEntry,
                                            medication_name: med.medication_name,
                                            dosage: med.dosage,
                                            route: med.route,
                                            start_date: med.start_date,
                                            stop_date: med.stop_date,
                                            frequency: med.frequency ?? (isMulti ? sortedMeds.length : 1),
                                            frequency_display: med.frequency_display,
                                            notes: med.notes,
                                            hour: med.hour ?? '',
                                            ...(isMulti ? { ids, times } : {})
                                          })
                                          setInsertPosition(null)
                                          setShowAddMedModal(true)
                                        }}
                                        className="opacity-0 group-hover/medcell:opacity-100 w-6 h-6 min-w-6 min-h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-all flex items-center justify-center cursor-pointer text-[#000000] dark:text-white group/edit relative"
                                        aria-label="Edit entry"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover/edit:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          Edit {isVitalsEntry ? 'vitals' : 'medication'}
                                        </span>
                                      </button>
                                      {/* Delete button */}
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
                                        className="opacity-0 group-hover/medcell:opacity-100 w-6 h-6 min-w-6 min-h-6 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-all flex items-center justify-center cursor-pointer text-[#000000] dark:text-white group/delete relative"
                                        aria-label="Delete entry"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover/delete:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          Delete {isVitalsEntry ? 'vitals' : 'medication'}
                                        </span>
                                      </button>
                                    </div>
                                    )}
                                  </div>
                                  {/* Right column: medication name + details (vertically aligned) */}
                                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                    <div className={`font-medium text-sm ${isVitalsEntry ? 'text-lasso-teal dark:text-lasso-blue' : 'text-gray-800 dark:text-white'}`}>
                                      {isVitalsEntry ? '📊 VITALS' : med.medication_name}
                                    </div>
                                    <div className={`text-xs ${isVitalsEntry ? 'text-gray-600 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                      {med.dosage}
                                    </div>
                                    {!isVitalsEntry && med.route && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                                        {med.route}
                                      </div>
                                    )}
                                    {med.frequency && med.frequency > 1 && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500">
                                        {med.frequency_display || `${med.frequency} time${med.frequency > 1 ? 's' : ''} per day`}
                                      </div>
                                    )}
                                    {isVitalsEntry && med.route && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                                        Default: {med.route}
                                      </div>
                                    )}
                                    {med.notes && !isVitalsEntry && (
                                      <div className="text-xs text-gray-500 dark:text-gray-500 italic">
                                        {med.notes}
                                      </div>
                                    )}
                                    {med.parameter && !isVitalsEntry && (
                                      <div className="text-xs text-gray-600 dark:text-gray-400 italic pt-1 mt-0.5 border-t border-gray-200 dark:border-gray-600">
                                        {med.parameter}
                                      </div>
                                    )}
                                  </div>
                                </div>
                            </td>
                            )}
                            {shouldMerge && !isFirstRow ? null : (
                              <td 
                                rowSpan={shouldMerge ? group.rowSpan : undefined}
                                className={`border border-gray-300 dark:border-gray-600 px-3 py-2 align-top text-center text-xs sticky left-[200px] z-10 ${
                                  isVitalsEntry 
                                    ? 'bg-[#ecdcfa] dark:bg-[#3d2254] hover:brightness-90' 
                                    : 'bg-[#d7f0f7] dark:bg-[#1a4a52] hover:brightness-90'
                                } border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#cbd5e1] dark:shadow-[4px_0_0_0_#334155]`}
                                style={{ width: MAR_COL.startStop, minWidth: MAR_COL.startStop, maxWidth: MAR_COL.startStop }}
                              >
                              <div>Start: {new Date(med.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              {med.stop_date && (
                                <div>Stop: {new Date(med.stop_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                              )}
                            </td>
                            )}
                            <td className={`border border-gray-300 dark:border-gray-600 px-3 py-2 align-top text-center text-xs sticky left-[320px] z-10 ${
                              isVitalsEntry 
                                ? 'bg-[#ecdcfa] dark:bg-[#3d2254] hover:brightness-90' 
                                : 'bg-[#d7f0f7] dark:bg-[#1a4a52] hover:brightness-90'
                            } border-r-2 border-gray-400 dark:border-gray-500 shadow-[4px_0_0_0_#cbd5e1] dark:shadow-[4px_0_0_0_#334155]`} style={{ width: hourColWidth, minWidth: hourColWidth, maxWidth: hourColWidth }}>
                              {readOnly ? (
                                <span className="text-gray-800 dark:text-white">{med.hour ? formatTimeDisplay(med.hour) : '—'}</span>
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
                                      
                                      setMessage(`${isVitalsEntry ? 'Vitals' : 'Medication'} time updated successfully`)
                                      setTimeout(() => setMessage(''), 2000)
                                    } catch (err) {
                                      console.error('Error updating hour:', err)
                                      setError(`Failed to update ${isVitalsEntry ? 'vitals' : 'medication'} time`)
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
                              const rawInitials = admin?.initials ?? ''
                              const initialsForLogic = rawInitials.startsWith('data:image') ? '' : rawInitials.trim().toUpperCase()
                              const initials = rawInitials
                              const notes = admin?.notes || null
                              const isNotGiven = status === 'Not Given'
                              const isGiven = status === 'Given'
                              const isPRN = status === 'PRN'
                              const isDC = initialsForLogic === 'DC'
                              const isRefused = initialsForLogic === 'R'
                              const isHeld = initialsForLogic === 'H'
                              const hasParameter = !!med.parameter

                              // Check if this day is after a DC (Discontinued) day
                              let isDiscontinued = false
                              let dcDay = null
                              if (!isVitalsEntry) {
                                // Find the earliest day with DC for this medication
                                for (let checkDay = 1; checkDay < day; checkDay++) {
                                  const checkAdmin = medAdmin[checkDay]
                                  const checkRaw = checkAdmin?.initials ?? ''
                                  if (!checkRaw.startsWith('data:image') && checkRaw.trim().toUpperCase() === 'DC') {
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
                                const parsed = parseMARMonthYear(marForm.month_year)
                                if (parsed) {
                                  const { y: formYear, m: formM } = parsed
                                  const formMonthIndex = formM - 1
                                  const startDayOfMonth = medStartDate.getDate()
                                  const isStartInFormMonth = medStartDate.getMonth() === formMonthIndex && medStartDate.getFullYear() === formYear
                                  const isStartBeforeFormMonth = medStartDate.getFullYear() < formYear || (medStartDate.getFullYear() === formYear && medStartDate.getMonth() < formMonthIndex)
                                  try {
                                    const currentDayDate = new Date(formYear, formMonthIndex, day)
                                    if (currentDayDate.getDate() !== day || currentDayDate.getMonth() !== formMonthIndex) {
                                      // skip invalid day
                                    } else if (isStartInFormMonth) {
                                      if (day >= startDayOfMonth && (!medStopDate || currentDayDate <= medStopDate)) {
                                        isMedActive = true
                                      }
                                    } else if (isStartBeforeFormMonth) {
                                      if (!medStopDate || currentDayDate <= medStopDate) {
                                        isMedActive = true
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
                                  style={{ width: MAR_COL.day, minWidth: MAR_COL.day, maxWidth: MAR_COL.day }}
                                  className={`border border-gray-300 dark:border-gray-600 px-1 py-2 text-center text-xs relative ${
                                    isDiscontinued ? 'bg-red-50 dark:bg-red-900/20' : ''
                                  } ${
                                    isEditing && isMedActive && !isDiscontinued ? 'cursor-pointer hover:bg-lasso-blue/10 dark:hover:bg-lasso-blue/20' : ''
                                  } ${
                                    day === todayDayInViewedMar
                                      ? 'bg-amber-50 dark:bg-amber-900/20'
                                      : !isMedActive
                                        ? 'bg-gray-100 dark:bg-gray-800'
                                        : ''
                                  } ${isDiscontinued ? 'cursor-not-allowed' : ''}`}
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
                                            const getUserInitials = (): { value: string; label: string } | null => {
                                              if (userProfile?.staff_initials) {
                                                if (userProfile.staff_initials.startsWith('data:image')) {
                                                  return { value: userProfile.staff_initials, label: 'Your Initials' }
                                                }
                                                return { value: userProfile.staff_initials.toUpperCase(), label: `${userProfile.staff_initials.toUpperCase()} (${userProfile?.full_name || 'Your Initials'})` }
                                              }
                                              if (userProfile?.full_name) {
                                                const names = userProfile.full_name.trim().split(/\s+/)
                                                if (names.length >= 2) {
                                                  const val = (names[0][0] + names[names.length - 1][0]).toUpperCase()
                                                  return { value: val, label: `${val} (${userProfile.full_name})` }
                                                } else if (names.length === 1) {
                                                  const val = names[0][0].toUpperCase()
                                                  return { value: val, label: val }
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
                                                  <option value={userInitials.value}>{userInitials.label}</option>
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
                                              hasParameter && !readOnly ? (
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
                                              readOnly ? (
                                                <div className="font-bold text-red-600 dark:text-red-400">R</div>
                                              ) : (
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
                                              )
                                            )}
                                            {isHeld && !isDC && (
                                              readOnly ? (
                                                <div className="font-bold text-orange-600 dark:text-orange-400">H</div>
                                              ) : (
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
                                              )
                                            )}
                                            {isGiven && !isDC && !isRefused && !isHeld && (
                                              hasParameter && initials && !readOnly ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className={`font-bold text-gray-800 dark:text-white ${isEditing ? 'cursor-text' : ''}`}>
                                                      <InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} />
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
                                                  <InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} />
                                                </div>
                                              )
                                          )}
                                            {isNotGiven && initials && !isDC && !isRefused && !isHeld && (
                                              hasParameter && !readOnly ? (
                                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                                  <div className="flex items-center justify-center gap-1">
                                                    <div className="text-red-600 dark:text-red-400 font-bold">
                                                      ○<InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} />
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
                                                  ○<InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} />
                                                </div>
                                              )
                                          )}
                                          {isPRN && (
                                              hasParameter && !readOnly ? (
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
                                                  {initials && <div className="text-xs text-lasso-blue"><InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} /></div>}
                                                </div>
                                              ) : (
                                                <div className="text-lasso-blue dark:text-lasso-blue font-bold text-xs">
                                                  PRN
                                                  {initials && <div className="text-xs"><InitialsOrSignatureDisplay value={initials} variant="initials" userProfile={userProfile} /></div>}
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
                          </MarMedTableRow>
                            {showDropLineAfter ? (
                              <tr aria-hidden className="pointer-events-none">
                                <td colSpan={marDropLineColSpan} className="p-0 border-0 leading-none">
                                  <div className="h-1.5 w-full bg-sky-500 dark:bg-sky-400 z-[25] shadow-sm rounded-sm" />
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        )
                      })
                    })()}
                      </tbody>
                    </SortableContext>
                    <DragOverlay zIndex={2000} dropAnimation={{ duration: 180, easing: 'ease' }}>
                      {marDragPreviewGroupMeds.length > 0 ? (
                        <MarMedicationGroupDragPreview meds={marDragPreviewGroupMeds} />
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                </table>
                </div>
              </div>
          </div>

          {/* Patient info, Comments, Instructions, Legend, PRN - keep original max-width so they don't stretch */}
          <div className="max-w-7xl mx-auto">
          {/* Patient Information Section - Box 2 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            {/* Row 1: Two Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Column 1: Diagnosis, Allergies, Name */}
              <div className="space-y-3 p-4 rounded-lg bg-lasso-navy/5 dark:bg-lasso-navy/10">
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Diagnosis:</label>
                  {readOnly ? (
                    <div className="w-full text-left text-sm text-gray-800 dark:text-white p-2 rounded border border-transparent">
                      {marForm.diagnosis || 'N/A'}
                    </div>
                  ) : (
                    <button
                      onClick={() => void openMarEditPatientModal()}
                      className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      {marForm.diagnosis || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  )}
              </div>
                  <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Allergies:</label>
                  {readOnly ? (
                    <div className="w-full text-left text-sm text-gray-800 dark:text-white p-2 rounded border border-transparent">
                      {marForm.allergies || 'None'}
                    </div>
                  ) : (
                    <button
                      onClick={() => void openMarEditPatientModal()}
                      className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      {marForm.allergies || 'None'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  )}
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
                  {readOnly ? (
                    <div className="w-full text-left text-sm text-gray-800 dark:text-white p-2 rounded border border-transparent min-h-[60px]">
                      {marForm.diet || 'N/A'}
                    </div>
                  ) : (
                    <button
                      onClick={() => void openMarEditPatientModal()}
                      className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors min-h-[60px]"
                    >
                      {marForm.diet || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Physician Name:</label>
                  {readOnly ? (
                    <div className="w-full text-left text-sm text-gray-800 dark:text-white p-2 rounded border border-transparent">
                      {marForm.physician_name || 'N/A'}
                    </div>
                  ) : (
                    <button
                      onClick={() => void openMarEditPatientModal()}
                      className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      {marForm.physician_name || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-gray-700 dark:text-gray-300 mb-1">Phone Number:</label>
                  {readOnly ? (
                    <div className="w-full text-left text-sm text-gray-800 dark:text-white p-2 rounded border border-transparent">
                      {marForm.physician_phone || 'N/A'}
                    </div>
                  ) : (
                    <button
                      onClick={() => void openMarEditPatientModal()}
                      className="w-full text-left text-sm text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      {marForm.physician_phone || 'N/A'} <span className="text-lasso-blue dark:text-lasso-blue text-xs">(edit)</span>
                    </button>
                  )}
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
                    onClick={readOnly ? undefined : () => {
                      setEditingComments(true)
                      setCommentsValue(marForm?.comments || '')
                    }}
                    className={`text-sm text-gray-800 dark:text-white min-h-[60px] p-2 border border-gray-200 dark:border-gray-600 rounded ${readOnly ? '' : 'cursor-pointer hover:border-lasso-blue dark:hover:border-lasso-blue transition-colors'}`}
                  >
                    {marForm?.comments ? (
                      <div className="whitespace-pre-wrap">{marForm.comments}</div>
                    ) : (
                      <span className="text-gray-400 italic">{readOnly ? 'No comments' : 'Click to add comments...'}</span>
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
                    const hasUserInitials = !!(userProfile?.staff_initials || userProfile?.staff_initials_text)
                    return (
                      <>
                        {hasUserInitials && (
                          <div className="font-semibold flex items-center gap-1">
                            <InitialsOrSignatureDisplay value={userProfile?.staff_initials ?? null} variant="initials" userProfile={userProfile} />
                            <span>= {userProfile?.full_name || 'Your Initials'}</span>
                          </div>
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
                            {!readOnly && (
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
                            )}
                          </div>
                        ))}
                        {!readOnly && (
                          <button
                            onClick={() => {
                              setEditingCustomLegend({ id: null, code: '', description: '' })
                              setShowCustomLegendModal(true)
                            }}
                            className="mt-2 text-xs px-2 py-1 bg-lasso-teal text-white rounded hover:bg-lasso-blue transition-colors"
                          >
                            + Add Custom Legend
                          </button>
                        )}
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

          {/* PRN Records Section - same max-width as Patient info above */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  PRN Records
                </h2>
                {!readOnly && (
                  <button
                    onClick={() => setShowAddPRNRecordModal(true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                  >
                    + Add PRN Record
                  </button>
                )}
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
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Start Date</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Date Administered</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Medication</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Dosage</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Reason/Indication</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Time</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Result</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Initials</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">Signature</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prnRecords.map((prn) => {
                        const prnDateBounds = getMarMonthDateRangeISO(marForm?.month_year || '')
                        const hasTime = !!prn.hour
                        const hasResult = !!prn.result?.trim()
                        const hasInitials = !!prn.initials?.trim()
                        const hasSignature = !!prn.staff_signature?.trim()
                        const needsTimeAndResult = !hasTime || !hasResult
                        const needsInitials = !hasInitials
                        const nextStepText = !hasTime
                          ? 'Set Time first'
                          : !hasResult
                            ? 'Set Result next'
                            : !hasInitials
                              ? 'Set Initials next'
                              : !hasSignature
                                ? 'Ready to Sign'
                                : 'Signed'
                        const initialsHelperText = !hasTime
                          ? 'Set Time first'
                          : !hasResult
                            ? 'Set Result next'
                            : hasInitials
                              ? ''
                              : 'Set Initials next'
                        const resultHelperText = !hasTime ? 'Set Time first' : ''

                        return (
                        <tr key={prn.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white">
                            {prn.entry_number || '—'}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'start_date', prn.start_date || '') : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'start_date' ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="date"
                                  value={editingPRNValue || prn.start_date || ''}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'start_date')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePRNFieldSave(prn.id, 'start_date')
                                    else if (e.key === 'Escape') handlePRNFieldCancel()
                                  }}
                                  autoFocus
                                  className="px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                />
                                <button type="button" onClick={() => handlePRNFieldCancel()} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                              </div>
                            ) : (
                              prn.start_date ? new Date(prn.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'date', prn.date) : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'date' ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="date"
                                  value={editingPRNValue || prn.date}
                                  min={prnDateBounds?.min}
                                  max={prnDateBounds?.max}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'date')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handlePRNFieldSave(prn.id, 'date')
                                    else if (e.key === 'Escape') handlePRNFieldCancel()
                                  }}
                                  autoFocus
                                  className="px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                />
                                <button type="button" onClick={() => handlePRNFieldCancel()} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                              </div>
                            ) : (
                              new Date(prn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'medication', prn.medication) : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'medication' ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={editingPRNValue}
                                  onChange={async (e) => {
                                    const selectedId = e.target.value
                                    const selected = prnMedicationList.find((m) => m.id === selectedId)
                                    if (!selected) {
                                      setEditingPRNValue(selectedId)
                                      return
                                    }
                                    const updates = {
                                      medication: selected.medication,
                                      dosage: selected.dosage || null,
                                      reason: selected.reason,
                                    }
                                    setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, ...updates } : r))
                                    const ok = await updatePRNRecordBatch(prn.id, updates)
                                    if (!ok) {
                                      setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, medication: prn.medication, dosage: prn.dosage, reason: prn.reason } : r))
                                    }
                                    setEditingPRNField(null)
                                    setEditingPRNValue('')
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">Select PRN...</option>
                                  {prnMedicationList.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.medication}{item.dosage ? ` (${item.dosage})` : ''}
                                    </option>
                                  ))}
                                </select>
                                <button type="button" onClick={() => handlePRNFieldCancel()} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                              </div>
                            ) : (
                              prn.medication || '—'
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'dosage', prn.dosage) : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'dosage' ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingPRNValue}
                                  onChange={(e) => setEditingPRNValue(e.target.value)}
                                  onBlur={() => handlePRNFieldSave(prn.id, 'dosage')}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handlePRNFieldSave(prn.id, 'dosage')
                                    } else if (e.key === 'Escape') {
                                      handlePRNFieldCancel()
                                    }
                                  }}
                                  autoFocus
                                  placeholder="e.g., 500 mg"
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <span>{prn.dosage || '—'}</span>
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'reason', prn.reason) : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'reason' ? (
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
                                  {!readOnly && prn.reason && (
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
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${!readOnly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
                            onClick={!readOnly ? () => handlePRNFieldEdit(prn.id, 'hour', prn.hour) : undefined}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'hour' ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <TimeInput
                                  value={editingPRNValue}
                                  onChange={async (newTime) => {
                                    setEditingPRNValue(newTime)
                                    const valueToSave = newTime.trim() || null
                                    const ok = await updatePRNRecord(prn.id, 'hour', valueToSave)
                                    if (ok) {
                                      setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, hour: valueToSave } as MARPRNRecord : r))
                                    }
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
                              readOnly ? '' : hasTime ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={readOnly || !hasTime ? undefined : () => handlePRNFieldEdit(prn.id, 'result', prn.result)}
                            title={readOnly ? '' : resultHelperText}
                          >
                            {!readOnly && hasTime && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'result' ? (
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
                            ) : prn.result?.trim() ? (
                              <span>{prn.result}</span>
                            ) : !readOnly && !hasTime ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">{resultHelperText}</span>
                            ) : (
                              <span>—</span>
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${
                              readOnly ? '' : hasTime && hasResult ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50 cursor-not-allowed'
                            }`}
                            onClick={readOnly ? undefined : () => {
                              if (hasTime && hasResult) {
                                if (!prn.initials) {
                                  let userInitials: string | null = null
                                  const si = userProfile?.staff_initials
                                  if (si && typeof si === 'string' && !si.startsWith('data:image') && si.trim().length > 0) {
                                    userInitials = si.trim().toUpperCase()
                                  }
                                  if (!userInitials && userProfile?.full_name) {
                                    const names = userProfile.full_name.trim().split(/\s+/)
                                    if (names.length >= 2) {
                                      userInitials = (names[0][0] + names[names.length - 1][0]).toUpperCase()
                                    } else if (names.length === 1 && names[0].length > 0) {
                                      userInitials = names[0][0].toUpperCase()
                                    }
                                  }
                                  const safeInitials = userInitials ? userInitials.slice(0, 10) : null
                                  if (safeInitials) {
                                    setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, initials: safeInitials } : r))
                                    updatePRNRecord(prn.id, 'initials', safeInitials).then(ok => {
                                      if (!ok) setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, initials: prn.initials } : r))
                                    })
                                    return
                                  }
                                }
                                handlePRNFieldEdit(prn.id, 'initials', prn.initials)
                              }
                            }}
                            title={readOnly ? '' : initialsHelperText}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'initials' ? (
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
                                  placeholder={prn.initials?.startsWith('data:image') ? 'Drawn initials (type to replace)' : 'e.g., JD'}
                                  maxLength={4}
                                  className="w-full px-2 py-1 border border-lasso-teal rounded focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : prn.initials ? (
                              <InitialsOrSignatureDisplay value={prn.initials} variant="initials" userProfile={userProfile} />
                            ) : !readOnly && hasTime && hasResult && (userProfile?.staff_initials || userProfile?.full_name) ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  let userInitials: string | null = null
                                  const si = userProfile?.staff_initials
                                  if (si && typeof si === 'string' && !si.startsWith('data:image') && si.trim().length > 0) {
                                    userInitials = si.trim().toUpperCase()
                                  }
                                  if (!userInitials && userProfile?.full_name) {
                                    const names = userProfile.full_name.trim().split(/\s+/)
                                    if (names.length >= 2) {
                                      userInitials = (names[0][0] + names[names.length - 1][0]).toUpperCase()
                                    } else if (names.length === 1 && names[0].length > 0) {
                                      userInitials = names[0][0].toUpperCase()
                                    }
                                  }
                                  const safeInitials = userInitials ? userInitials.slice(0, 10) : null
                                  if (safeInitials) {
                                    setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, initials: safeInitials } : r))
                                    const ok = await updatePRNRecord(prn.id, 'initials', safeInitials)
                                    if (!ok) {
                                      setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, initials: prn.initials } : r))
                                    }
                                  }
                                }}
                                className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                              >
                                Initial
                              </button>
                            ) : hasTime && hasResult ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">Set initials in Profile</span>
                            ) : !readOnly && initialsHelperText ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">{initialsHelperText}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td 
                            className={`border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-white ${
                              readOnly ? '' : hasInitials ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : 'opacity-50'
                            }`}
                            onClick={readOnly ? undefined : async (e) => {
                              if (!hasTime || !hasResult || !hasInitials) return
                              e.stopPropagation()
                              if (prn.staff_signature && editingPRNField?.recordId !== prn.id) return
                              if (!prn.staff_signature && userProfile?.staff_signature) {
                                const sig = userProfile.staff_signature
                                const inits = prn.initials?.trim().toUpperCase()
                                setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: sig } : r))
                                if (inits) setStaffInitials(prev => ({ ...prev, [inits]: sig }))
                                const ok = await updatePRNRecord(prn.id, 'staff_signature', sig)
                                if (!ok) setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: prn.staff_signature } : r))
                                return
                              }
                              if (prn.staff_signature) handlePRNFieldEdit(prn.id, 'staff_signature', prn.staff_signature)
                            }}
                            title={readOnly ? '' : (!hasTime || !hasResult || !hasInitials) ? 'Complete Time, Result, and Initials first' : !prn.staff_signature ? 'Click to sign (apply saved signature)' : ''}
                          >
                            {!readOnly && editingPRNField?.recordId === prn.id && editingPRNField?.field === 'staff_signature' ? (
                              <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
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
                                />
                              </div>
                            ) : (() => {
                              const isMine = prn.signed_by === userProfile?.id || (prn.signed_by == null && prn.initials?.trim().toUpperCase() === currentUserInitialsForMatch(userProfile))
                              const effectiveSig = isMine && userProfile?.staff_signature ? userProfile.staff_signature : (prn.staff_signature ?? '')
                              return effectiveSig ? (
                              <div className="flex flex-col gap-0.5">
                                <InitialsOrSignatureDisplay value={effectiveSig} variant="signature" userProfile={userProfile} />
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={async (ev) => {
                                      ev.stopPropagation()
                                      const prevSig = prn.staff_signature
                                      setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: '', signed_by: null } : r))
                                      const ok = await updatePRNRecord(prn.id, 'staff_signature', null)
                                      if (!ok) setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: prevSig, signed_by: prn.signed_by } : r))
                                    }}
                                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 underline w-fit"
                                  >
                                    Clear signature
                                  </button>
                                )}
                              </div>
                            ) : !readOnly && userProfile?.staff_signature && hasTime && hasResult && hasInitials ? (
                              <button
                                type="button"
                                onClick={async (ev) => {
                                  ev.stopPropagation()
                                  const sig = userProfile!.staff_signature
                                  const inits = prn.initials?.trim().toUpperCase()
                                  setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: sig, signed_by: userProfile?.id ?? null } : r))
                                  if (inits) setStaffInitials(prev => ({ ...prev, [inits]: sig }))
                                  const ok = await updatePRNRecord(prn.id, 'staff_signature', sig)
                                  if (!ok) setPrnRecords(prev => prev.map(r => r.id === prn.id ? { ...r, staff_signature: prn.staff_signature, signed_by: prn.signed_by } : r))
                                }}
                                className="px-2 py-1 text-sm font-medium text-lasso-teal border border-lasso-teal rounded hover:bg-lasso-teal/10 dark:hover:bg-lasso-teal/20"
                              >
                                Sign
                              </button>
                            ) : !readOnly && (!hasTime || !hasResult || !hasInitials) ? (
                              <button
                                type="button"
                                disabled
                                title="Complete Time, Result, and Initials first"
                                className="px-2 py-1 text-sm font-medium text-gray-400 border border-gray-300 dark:border-gray-600 rounded cursor-not-allowed"
                              >
                                Sign
                              </button>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )
                            })()}
                            {!readOnly && (
                              <div className={`mt-1 text-[11px] ${nextStepText === 'Signed' ? 'text-green-600 dark:text-green-400' : nextStepText === 'Ready to Sign' ? 'text-lasso-teal dark:text-lasso-blue' : 'text-amber-600 dark:text-amber-400'}`}>
                                {nextStepText}
                              </div>
                            )}
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
          </div>
        </div>
      </div>

      {/* Hidden tables for measuring row heights: first half (1–15) and second half (16–31). Use max per row so both print pages fit. Not printed. */}
      {medications.length > 0 && (
        <>
          <div className="mar-print-measure text-xs" aria-hidden="true">
            <table className="min-w-full border border-gray-400" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '960px' }}>
              <colgroup>
                <col style={{ width: '26%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                {days.slice(0, 15).map((_, i) => <col key={i} style={{ width: `${60 / 15}%` }} />)}
              </colgroup>
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Medication</th>
                  <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Start/Stop</th>
                  <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Hour</th>
                  {days.slice(0, 15).map((d) => <th key={d} className="border border-gray-400 px-1 py-1.5 text-center font-semibold">{d}</th>)}
                </tr>
              </thead>
              <tbody ref={marMeasureTbodyRef}>
                {renderMarPrintRows(medications, days.slice(0, 15))}
              </tbody>
            </table>
          </div>
          <div className="mar-print-measure text-xs" aria-hidden="true">
            <table className="min-w-full border border-gray-400" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '960px' }}>
              <colgroup>
                <col style={{ width: '26%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '6%' }} />
                {days.slice(15, 31).map((_, i) => <col key={i} style={{ width: `${60 / 16}%` }} />)}
              </colgroup>
              <thead>
                <tr className="bg-gray-200">
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Medication</th>
                  <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Start/Stop</th>
                  <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Hour</th>
                  {days.slice(15, 31).map((d) => <th key={d} className="border border-gray-400 px-1 py-1.5 text-center font-semibold">{d}</th>)}
                </tr>
              </thead>
              <tbody ref={marMeasureTbodyRef2}>
                {renderMarPrintRows(medications, days.slice(15, 31))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Print-only MAR: two landscape pages — left columns + days 1–15, then left columns + days 16–31 */}
      <div key={printDataKey} className="mar-print-view text-xs" style={{ display: 'none' }}>
        {(() => {
          const formatDOB = (dob: string | null | undefined) => {
            if (!dob) return '—'
            try {
              const d = new Date(dob)
              return isNaN(d.getTime()) ? dob : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            } catch {
              return dob
            }
          }
          const printHeader = (
            <div className="p-4 pb-2 text-xs">
              <h1 className="text-xs font-bold text-gray-900">Medication Administration Record (MAR)</h1>
              <p className="text-xs text-gray-700 mt-1">
                <strong>Patient:</strong> {marForm.patient_name}
                &nbsp;|&nbsp; <strong>DOB:</strong> {formatDOB(marForm.date_of_birth)}
                &nbsp;|&nbsp; <strong>Sex:</strong> {marForm.sex ?? '—'}
                &nbsp;|&nbsp; <strong>Month/Year:</strong> {formatMarMonthYearDisplay(marForm.month_year)}
                &nbsp;|&nbsp; <strong>Facility:</strong> {facilityNameFromProfile ?? marForm.facility_name ?? 'N/A'}
              </p>
            </div>
          )
          const medicationChunks = printMedicationChunks
          const firstHalfDays = days.slice(0, 15)   // 1-15
          const secondHalfDays = days.slice(15, 31) // 16-31

          const printTablePage = (chunk: typeof medications, dayRange: 'first' | 'second', pageKey: string, isLast: boolean, startIndex: number) => {
            const daySubset = dayRange === 'first' ? firstHalfDays : secondHalfDays
            const dayColWidthPct = 60 / daySubset.length
            const useRowHeights = printRowHeights.length === medications.length
            return (
              <div key={pageKey} style={isLast ? undefined : { pageBreakAfter: 'always' }}>
                {printHeader}
                <table className="min-w-full border border-gray-400 text-xs" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '26%' }} />
                    <col style={{ width: '8%' }} />
                    <col style={{ width: '6%' }} />
                    {daySubset.map((_, i) => <col key={i} style={{ width: `${dayColWidthPct}%` }} />)}
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-200">
                      <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Medication</th>
                      <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Start/Stop</th>
                      <th className="border border-gray-400 px-0.5 py-1.5 text-left font-semibold">Hour</th>
                      {daySubset.map((d) => <th key={d} className="border border-gray-400 px-1 py-1.5 text-center font-semibold">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {renderMarPrintRows(chunk, daySubset, useRowHeights ? startIndex : undefined, useRowHeights ? printRowHeights : undefined)}
                  </tbody>
                </table>
              </div>
            )
          }

          const printPages: { chunk: typeof medications; dayRange: 'first' | 'second'; startIndex: number }[] = []
          let chunkStart = 0
          medicationChunks.forEach((chunk) => {
            printPages.push({ chunk, dayRange: 'first', startIndex: chunkStart })
            printPages.push({ chunk, dayRange: 'second', startIndex: chunkStart })
            chunkStart += chunk.length
          })

          return (
            <>
              {printPages.map(({ chunk, dayRange, startIndex }, idx) =>
                printTablePage(chunk, dayRange, `mar-page-${idx}-${dayRange}`, idx === printPages.length - 1 && prnRecords.length === 0, startIndex)
              )}
              {prnRecords.length > 0 && (
                <div style={{ pageBreakBefore: 'always' }} className="mt-6">
                  {printHeader}
                  <h2 className="text-xs font-bold text-gray-900 mb-2 mt-2">PRN Records</h2>
                  <table className="min-w-full border border-gray-400 text-xs" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr className="bg-gray-200">
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Entry #</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Start Date</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Date Administered</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Medication</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Dosage</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Reason/Indication</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Time</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Result</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Initials</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Signature</th>
                        <th className="border border-gray-400 px-2 py-1.5 text-left font-semibold">Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prnRecords.map((prn) => (
                        <tr key={prn.id}>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.entry_number ?? '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.start_date ? new Date(prn.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.date ? new Date(prn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.medication || '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.dosage || '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.reason || '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.hour ? formatTimeDisplay(prn.hour) : '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.result || '—'}</td>
                          <td className="border border-gray-400 px-2 py-1.5 align-middle">
                            {prn.initials?.startsWith('data:image') ? (
                              <img src={prn.initials} alt="Initials" style={{ maxHeight: '1.25em', maxWidth: '3em', display: 'inline-block', verticalAlign: 'middle' }} />
                            ) : (
                              prn.initials || '—'
                            )}
                          </td>
                          <td className="border border-gray-400 px-2 py-1.5 align-middle">
                            {prn.staff_signature?.startsWith('data:image') ? (
                              <img src={prn.staff_signature} alt="Signature" style={{ maxHeight: '1.75em', maxWidth: '8em', display: 'inline-block', verticalAlign: 'middle' }} />
                            ) : (
                              prn.staff_signature || '—'
                            )}
                          </td>
                          <td className="border border-gray-400 px-2 py-1.5">{prn.note || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Summary / Instructions / Legend page (print-only) */}
              <div style={{ pageBreakBefore: 'always' }} className="mt-6">
                {printHeader}
                <div className="p-4 pt-8 text-xs pb-8 pt-6">
                  <h2 className="text-xs font-bold text-gray-900 mb-2 mt-2">MAR Summary / Instructions / Legend</h2>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-1">
                      <div>
                        <span className="font-bold uppercase">Diagnosis:</span>{' '}
                        <span>{marForm.diagnosis || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Allergies:</span>{' '}
                        <span>{marForm.allergies || 'None'}</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Name:</span>{' '}
                        <span>{marForm.patient_name}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div>
                        <div className="font-bold uppercase">Diet / Special Instructions:</div>
                        <div className="border border-gray-300 px-2 py-1 min-h-[40px]">
                          {marForm.diet || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Physician Name:</span>{' '}
                        <span>{marForm.physician_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="font-bold uppercase">Phone Number:</span>{' '}
                        <span>{marForm.physician_phone || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 pt-8">
                    <div>
                      <div className="font-bold uppercase mb-1">Comments:</div>
                      <div className="border border-gray-300 px-2 py-1 min-h-[48px] whitespace-pre-wrap">
                        {marForm.comments || 'No comments'}
                      </div>
                    </div>
                    <div className="text-[0.7rem] text-gray-800 space-y-0.5">
                      <div className="font-bold uppercase mb-1">Instructions:</div>
                      <div>A. Put initials in appropriate box when medication is given.</div>
                      <div>B. Circle initials when not given.</div>
                      <div>C. State reason for refusal / omission on back of form.</div>
                      <div>D. PRN Medications: Reason given and results must be noted on back of form.</div>
                    </div>
                    <div className="text-[0.7rem] text-gray-800 space-y-0.5">
                      <div className="font-bold uppercase mb-1">Legend:</div>
                      <div>
                        <strong>◯</strong> = Not Given
                      </div>
                      <div>
                        <strong>PRN</strong> = As Needed
                      </div>
                      <div>
                        <strong>H</strong> = Held
                      </div>
                      <div>
                        <strong>R</strong> = Refused
                      </div>
                      <div>
                        <strong>DC</strong> = Discontinued
                      </div>
                      <div>
                        <strong>NG</strong> = Not Given
                      </div>
                      <div>
                        <strong>ABC</strong> = Absent From Care
                      </div>
                      <div>
                        <strong>BDC</strong> = test
                      </div>
                      <div>
                        <strong>DP</strong> = Day Program
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )
        })()}
      </div>

      {/* Add Medication/Vitals Modal */}
      {showAddMedModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {editingEntry 
                  ? `Edit ${editingEntry.isVitals ? 'Vitals' : 'Medication'}` 
                  : 'Add Medication or Vitals'
                }
              </h2>
              <button
                onClick={() => {
                  setShowAddMedModal(false)
                  setEditingEntry(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddMedicationOrVitalsForm
              onSubmit={async (data) => {
                try {
                  if (editingEntry) {
                    // Edit mode - update existing entry (or all rows in group when multiple times)
                    const md = data.type === 'medication' ? data.medicationData! : null
                    const vd = data.type === 'vitals' ? data.vitalsData! : null
                    const timesArray = md 
                      ? (md.frequency > 1 && md.times?.length ? md.times : [md.hour])
                      : vd && vd.frequency && vd.frequency > 1 && vd.times?.length
                        ? vd.times
                        : vd
                          ? [vd.hour || null]
                          : []
                    const updateData = {
                      ids: editingEntry.ids && editingEntry.ids.length > 0 ? editingEntry.ids : [editingEntry.id],
                      isVitals: editingEntry.isVitals,
                      medication_name: data.type === 'medication' ? md!.medicationName : 'VITALS',
                      dosage: data.type === 'medication' ? md!.dosage : vd!.notes,
                      route: data.type === 'medication' ? md!.route : (vd!.initials || null),
                      start_date: data.type === 'medication' ? md!.startDate : vd!.startDate,
                      stop_date: data.type === 'medication' ? md!.stopDate : vd!.stopDate,
                      frequency: data.type === 'medication' ? md!.frequency : (vd!.frequency || 1),
                      frequency_display: data.type === 'medication' ? md!.frequencyDisplay : (vd!.frequencyDisplay || null),
                      notes: data.type === 'medication' ? md!.notes : 'Vital Signs Entry',
                      times: timesArray
                    }
                    await updateMedicationEntry(updateData)
                    setShowAddMedModal(false)
                    setEditingEntry(null)
                  } else {
                    // Add mode - create new entry
                    if (data.type === 'medication') {
                      await addMedication(data.medicationData!, insertPosition)
                      setShowAddMedModal(false)
                      setInsertPosition(null)
                    } else {
                      await addVitals(data.vitalsData!, insertPosition)
                      setShowAddMedModal(false)
                      setInsertPosition(null)
                    }
                  }
                } catch (err) {
                  console.error('Error saving entry:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => {
                setShowAddMedModal(false)
                setInsertPosition(null)
                setEditingEntry(null)
              }}
              defaultStartDate={new Date().toISOString().split('T')[0]}
              defaultHour=""
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
              editData={editingEntry}
              isEditMode={!!editingEntry}
            />
          </div>
        </div>
      )}

      {/* Edit Patient Info Modal — same sections as admissions; patients row is source of truth, then MAR forms sync */}
      {showEditPatientInfoModal && marForm && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mar-edit-patient-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-4 shrink-0">
              <h2 id="mar-edit-patient-title" className="text-xl font-semibold text-gray-800 dark:text-white shrink-0">
                Edit Patient Information
              </h2>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1 sm:justify-end min-w-0">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap" aria-live="polite">
                  Step {editPatientStep} of 2
                </p>
                <div
                  className="flex gap-1.5 w-full sm:w-44 shrink-0"
                  role="progressbar"
                  aria-valuemin={1}
                  aria-valuemax={2}
                  aria-valuenow={editPatientStep}
                  aria-label="Edit progress"
                >
                  <div
                    className={`h-2.5 flex-1 rounded-sm transition-colors ${editPatientStep >= 1 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`}
                  />
                  <div
                    className={`h-2.5 flex-1 rounded-sm transition-colors ${editPatientStep >= 2 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={closeMarEditPatientInfoModal}
                disabled={editPatientSaving}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl disabled:opacity-50 shrink-0"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
              {editPatientModalError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
                  {editPatientModalError}
                </div>
              )}
              {editPatientLoading ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Loading patient…</p>
              ) : editPatientFormDraft ? (
                <PatientProfileFormFields
                  values={editPatientFormDraft}
                  onChange={handleMarEditPatientInputChange}
                  ageDisplay={editPatientAge}
                  mode={{ type: 'wizard', step: editPatientStep }}
                  disabled={editPatientSaving}
                  recordNumber={marForm.record_number || ''}
                  facilityDisplayName={facilityNameFromProfile}
                  showCompletionChecks
                  editedFields={editPatientTouchedFields}
                />
              ) : !editPatientModalError ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">Could not load patient record.</p>
              ) : null}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-end gap-2 shrink-0">
              {editPatientStep === 2 && !editPatientLoading && editPatientFormDraft && (
                <button
                  type="button"
                  onClick={() => {
                    setEditPatientModalError('')
                    setEditPatientStep(1)
                  }}
                  disabled={editPatientSaving}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 mr-auto sm:mr-0"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={closeMarEditPatientInfoModal}
                disabled={editPatientSaving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
              {!editPatientLoading && editPatientFormDraft ? (
                editPatientStep === 1 ? (
                  <button
                    type="button"
                    onClick={goToMarEditPatientStep2}
                    disabled={editPatientSaving}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal disabled:opacity-50"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSaveMarPatientEdits()}
                    disabled={editPatientSaving}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal disabled:opacity-50"
                  >
                    {editPatientSaving ? 'Saving…' : 'Save changes'}
                  </button>
                )
              ) : null}
            </div>
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
              defaultHour=""
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

      {/* Add PRN Medication (Library) Modal */}
      {showAddPRNModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add PRN to List</h2>
              <button
                onClick={() => setShowAddPRNModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <AddPRNMedicationForm
              onSubmit={async (prnData) => {
                try {
                  await addPRNMedication(prnData)
                  setShowAddPRNModal(false)
                } catch (err) {
                  console.error('Error adding PRN medication:', err)
                  // Don't close modal on error so user can fix and retry
                }
              }}
              onCancel={() => setShowAddPRNModal(false)}
              defaultDate={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}

      {/* Add PRN Record Modal */}
      {showAddPRNRecordModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Add PRN Record</h2>
              <button
                onClick={() => setShowAddPRNRecordModal(false)}
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
                  setShowAddPRNRecordModal(false)
                } catch (err) {
                  console.error('Error adding PRN record:', err)
                }
              }}
              onCancel={() => setShowAddPRNRecordModal(false)}
              defaultDate={clampDateToMarMonth(new Date().toISOString().split('T')[0], marForm?.month_year)}
              dateMin={getMarMonthDateRangeISO(marForm?.month_year || '')?.min}
              dateMax={getMarMonthDateRangeISO(marForm?.month_year || '')?.max}
              prnMedicationList={prnMedicationList}
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
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">{editingPRNNote.note?.trim() ? 'Edit Note' : 'Add Note'}</h2>
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
                    const valueToSave = editingPRNNote.note?.trim() || null
                    const ok = await updatePRNRecord(editingPRNNote.recordId, 'note', valueToSave)
                    if (ok) {
                      setPrnRecords(prev => prev.map(r => r.id === editingPRNNote.recordId ? { ...r, note: valueToSave } : r))
                    }
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

      {/* Medication Notes Modal */}
      {showMedicationNotesModal && editingMedicationNotes && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Edit Notes</h2>
              <button
                onClick={() => {
                  setShowMedicationNotesModal(false)
                  setEditingMedicationNotes(null)
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={editingMedicationNotes.notes || ''}
                onChange={(e) => setEditingMedicationNotes({ ...editingMedicationNotes, notes: e.target.value })}
                placeholder="Enter additional notes about this medication..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Notes will appear under the frequency in the medication column.</p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMedicationNotesModal(false)
                  setEditingMedicationNotes(null)
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingMedicationNotes) {
                    await updateMedicationNotes(editingMedicationNotes.medicationId, editingMedicationNotes.notes?.trim() || null)
                    setShowMedicationNotesModal(false)
                    setEditingMedicationNotes(null)
                  }
                }}
                className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal"
              >
                Save Notes
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
                Are you sure you want to leave this page?
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
  defaultType = 'medication',
  editData,
  isEditMode = false
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
      frequency?: number
      times?: string[]
      frequencyDisplay?: string | null
    }
  }) => Promise<void>
  onCancel: () => void
  defaultStartDate: string
  defaultHour: string
  defaultInitials: string
  defaultType?: 'medication' | 'vitals'
  editData?: {
    id: string
    isVitals: boolean
    medication_name: string
    dosage: string
    route: string | null
    start_date: string
    stop_date: string | null
    frequency: number | null
    frequency_display: string | null
    notes: string | null
    hour: string | null
    /** All administration times for this medication group (when frequency > 1). */
    times?: string[]
  } | null
  isEditMode?: boolean
}) {
  const [entryType, setEntryType] = useState<'medication' | 'vitals'>(
    isEditMode && editData ? (editData.isVitals ? 'vitals' : 'medication') : defaultType
  )
  // In edit mode: load times from editData and pad to frequency so all slots show (e.g. 3x/day with only 2 DB rows)
  const initialTimes = (() => {
    if (!isEditMode || !editData || editData.isVitals) return []
    const fromData = editData.times?.length ? editData.times : (editData.hour ? [editData.hour] : [])
    const freq = editData.frequency || 1
    if (freq <= 1) return fromData
    const padded = [...fromData]
    while (padded.length < freq) padded.push('')
    return padded
  })()
  const [medicationData, setMedicationData] = useState({
    medicationName: isEditMode && editData && !editData.isVitals ? editData.medication_name : '',
    dosage: isEditMode && editData && !editData.isVitals ? editData.dosage : '',
    startDate: isEditMode && editData && !editData.isVitals ? editData.start_date : defaultStartDate,
    stopDate: isEditMode && editData && !editData.isVitals ? (editData.stop_date || '') : '',
    hour: isEditMode && editData && !editData.isVitals ? (editData.hour || defaultHour) : defaultHour,
    notes: isEditMode && editData && !editData.isVitals ? (editData.notes || '') : '',
    initials: '', // No longer collected from form, will be empty
    frequency: isEditMode && editData && !editData.isVitals ? (editData.frequency || 1) : 1, // Number of times per day
    times: initialTimes as string[], // Array of times for each frequency; from editData when editing
    route: isEditMode && editData && !editData.isVitals ? (editData.route || '') : '', // Route of administration
    frequencyDisplay: isEditMode && editData && !editData.isVitals ? (editData.frequency_display || '') : '' // Custom frequency display text
  })
  const initialVitalsTimes = (() => {
    if (!isEditMode || !editData || !editData.isVitals) return []
    const fromData = editData.times?.length ? editData.times : (editData.hour ? [editData.hour] : [])
    const freq = editData.frequency || 1
    if (freq <= 1) return fromData
    const padded = [...fromData]
    while (padded.length < freq) padded.push('')
    return padded
  })()
  const [vitalsData, setVitalsData] = useState({
    notes: isEditMode && editData && editData.isVitals ? editData.dosage : '', // Vitals uses dosage field for notes/description
    initials: isEditMode && editData && editData.isVitals ? (editData.route || '') : '', // For vitals, this is the default entry value stored in route field
    startDate: isEditMode && editData && editData.isVitals ? editData.start_date : defaultStartDate,
    stopDate: isEditMode && editData && editData.isVitals ? (editData.stop_date || '') : '',
    hour: isEditMode && editData && editData.isVitals ? (editData.hour || '') : '',
    frequency: isEditMode && editData && editData.isVitals ? (editData.frequency || 1) : 1,
    times: initialVitalsTimes as string[],
    frequencyDisplay: isEditMode && editData && editData.isVitals ? (editData.frequency_display || '') : ''
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
      // Times are optional for vitals - no validation needed
    }

    setIsSubmitting(true)
    try {
      // Initials are no longer collected from form - use empty string
      const finalInitials = ''

      // For vitals, use the text value as-is (no uppercase conversion, no legend)
      const finalVitalsInitials = vitalsData.initials.trim()

      // Collect times for frequency > 1
      const medTimes = medicationData.frequency > 1 
        ? Array.from({ length: medicationData.frequency }, (_, i) => 
            medicationData.times[i] || medicationData.hour
          )
        : undefined

      // Collect times for vitals (optional)
      const vitalTimes = vitalsData.frequency > 1 
        ? Array.from({ length: vitalsData.frequency }, (_, i) => 
            vitalsData.times[i] || ''
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
          times: medTimes,
          route: medicationData.route || null,
          frequencyDisplay: medicationData.frequencyDisplay || null
        } : undefined,
        vitalsData: entryType === 'vitals' ? {
          notes: vitalsData.notes,
          initials: finalVitalsInitials,
          startDate: vitalsData.startDate,
          stopDate: vitalsData.stopDate || null,
          hour: vitalsData.hour || null,
          frequency: vitalsData.frequency,
          times: vitalTimes,
          frequencyDisplay: vitalsData.frequencyDisplay || null
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
        frequencyDisplay: ''
      })
      setVitalsData({
        notes: '',
        initials: '', // Reset to empty for vitals
        startDate: defaultStartDate,
        stopDate: '',
        hour: '',
        frequency: 1,
        times: [],
        frequencyDisplay: ''
      })
    } catch (err) {
      console.error('Error submitting entry:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Selection - hidden in edit mode */}
      {!isEditMode && (
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
      )}

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
                // Don't auto-populate frequencyDisplay - leave empty for default display
                setMedicationData({ 
                  ...medicationData, 
                  frequency: freq, 
                  times: newTimes
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
              placeholder="e.g., Daily in morning, with meals, once at bed time"
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
              Frequency (Times per day)
            </label>
            <select
              value={vitalsData.frequency}
              onChange={(e) => {
                const freq = parseInt(e.target.value, 10)
                const newTimes = Array.from({ length: freq }, (_, i) => 
                  vitalsData.times[i] || (i === 0 ? vitalsData.hour : '')
                )
                setVitalsData({ 
                  ...vitalsData, 
                  frequency: freq,
                  times: newTimes
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                <option key={num} value={num}>{num} time{num > 1 ? 's' : ''} per day</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">How many times per day vitals should be taken (optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Custom Frequency Display (Optional)
            </label>
            <input
              type="text"
              value={vitalsData.frequencyDisplay}
              onChange={(e) => setVitalsData({ ...vitalsData, frequencyDisplay: e.target.value })}
              placeholder="e.g., 'BID', 'Q4H', 'TID', etc."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: Override the frequency display (e.g., '2 times per day' → 'BID')</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Administration Time(s) (Optional)
            </label>
            {vitalsData.frequency === 1 ? (
              <>
                <TimeInput
                  value={vitalsData.hour}
                  onChange={(newTime) => setVitalsData({ ...vitalsData, hour: newTime })}
                  required={false}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: Select time for vital signs check</p>
              </>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: vitalsData.frequency }, (_, i) => (
                  <div key={i}>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Time {i + 1}:
                    </label>
                    <TimeInput
                      value={vitalsData.times[i] || ''}
                      onChange={(newTime) => {
                        const newTimes = [...vitalsData.times]
                        newTimes[i] = newTime
                        while (newTimes.length < vitalsData.frequency) {
                          newTimes.push('')
                        }
                        setVitalsData({ 
                          ...vitalsData, 
                          times: newTimes,
                          hour: i === 0 ? newTime : vitalsData.hour
                        })
                      }}
                      required={false}
                    />
                  </div>
                ))}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: Enter the time for each vital signs check</p>
              </div>
            )}
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
          {isSubmitting 
            ? (isEditMode ? 'Saving...' : 'Adding...') 
            : isEditMode 
              ? 'Save Changes' 
              : (entryType === 'medication' ? 'Add Medication' : 'Add Vitals')
          }
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

// Add PRN Medication (Library) Form Component
function AddPRNMedicationForm({ 
  onSubmit, 
  onCancel,
  defaultDate
}: { 
  onSubmit: (data: {
    date: string
    medication: string
    dosage: string | null
    reason: string
  }) => Promise<void>
  onCancel: () => void
  defaultDate: string
}) {
  const [formData, setFormData] = useState({
    date: defaultDate,
    medication: '',
    dosage: '',
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
        medication: formData.medication,
        dosage: formData.dosage.trim() || null,
        reason: formData.reason
      })
      // Reset form
      setFormData({
        date: defaultDate,
        medication: '',
        dosage: '',
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
            Start Date *
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
          placeholder="e.g., Tylenol"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Dosage
        </label>
        <input
          type="text"
          value={formData.dosage}
          onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
          placeholder="e.g., 500 mg"
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
          {isSubmitting ? 'Adding...' : 'Add PRN to List'}
        </button>
      </div>
    </form>
  )
}

// Add PRN Record Form Component
function AddPRNRecordForm({ 
  onSubmit, 
  onCancel,
  defaultDate,
  dateMin,
  dateMax,
  prnMedicationList
}: { 
  onSubmit: (data: {
    date: string
    hour: string | null
    initials: string | null
    medication: string
    dosage: string | null
    reason: string
    result: string | null
    staffSignature: string | null
    startDate: string | null
  }) => Promise<void>
  onCancel: () => void
  defaultDate: string
  dateMin?: string
  dateMax?: string
  prnMedicationList: MARPRNMedication[]
}) {
  const [formData, setFormData] = useState({
    date: defaultDate,
    medication: '',
    dosage: '',
    reason: '',
    prnMedicationId: '',
    startDate: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSelectPRNMedication = (id: string) => {
    const selected = prnMedicationList.find((m) => m.id === id)
    if (!selected) {
      setFormData(prev => ({ ...prev, prnMedicationId: '', medication: '', dosage: '', reason: '', startDate: '' }))
      return
    }
    setFormData(prev => ({
      ...prev,
      prnMedicationId: id,
      medication: selected.medication,
      dosage: selected.dosage || '',
      reason: selected.reason,
      startDate: selected.start_date,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.date || !formData.medication || !formData.reason) {
      alert('Please select a PRN from the list')
      return
    }
    if (dateMin && formData.date < dateMin) {
      alert('PRN date must fall within this MAR month.')
      return
    }
    if (dateMax && formData.date > dateMax) {
      alert('PRN date must fall within this MAR month.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        date: formData.date,
        hour: null,
        medication: formData.medication,
        dosage: formData.dosage.trim() || null,
        reason: formData.reason,
        result: null,
        initials: null,
        staffSignature: null,
        startDate: formData.startDate || null
      })
      setFormData({
        date: defaultDate,
        medication: '',
        dosage: '',
        reason: '',
        prnMedicationId: '',
        startDate: ''
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
          min={dateMin}
          max={dateMax}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          PRN List
        </label>
        <select
          value={formData.prnMedicationId}
          onChange={(e) => handleSelectPRNMedication(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        >
          <option value="">Select from PRN list</option>
          {prnMedicationList.map((item) => (
            <option key={item.id} value={item.id}>
              {item.medication}{item.dosage ? ` (${item.dosage})` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Medication Name
        </label>
        <input
          type="text"
          value={formData.medication}
          readOnly
          placeholder="Select a PRN item above"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Dosage
        </label>
        <input
          type="text"
          value={formData.dosage}
          readOnly
          placeholder="Auto-filled from PRN list"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Reason/Indication
        </label>
        <input
          type="text"
          value={formData.reason}
          readOnly
          placeholder="Auto-filled from PRN list"
          className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400"
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
          disabled={isSubmitting || !formData.prnMedicationId}
          className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Adding...' : 'Add PRN Record'}
        </button>
      </div>
    </form>
  )
}
