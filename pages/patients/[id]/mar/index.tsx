import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile } from '../../../../lib/auth'

export default function MARIndex() {
  const router = useRouter()
  const { id: patientId } = router.query
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [existingFormId, setExistingFormId] = useState<string | null>(null)
  const [monthYear, setMonthYear] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const findOrCreateMAR = async () => {
      if (!patientId || typeof patientId !== 'string') return

      try {
        const profile = await getCurrentUserProfile()
        if (!profile) {
          router.push('/auth/login')
          return
        }

        // Get current month/year
        const now = new Date()
        const currentMonthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        setMonthYear(currentMonthYear)

        // Check if MAR form exists for current month
        const { data: existingForms, error: fetchError } = await supabase
          .from('mar_forms')
          .select('id')
          .eq('patient_id', patientId)
          .eq('month_year', currentMonthYear)
          .order('created_at', { ascending: false })
          .limit(1)

        if (fetchError) throw fetchError

        if (existingForms && existingForms.length > 0) {
          // Show confirmation modal instead of redirecting
          setExistingFormId(existingForms[0].id)
          setShowConfirmModal(true)
          setLoading(false)
        } else {
          // No existing form, create new one immediately
          await createNewMARForm(patientId, profile, currentMonthYear)
        }
      } catch (err: any) {
        console.error('Error finding/creating MAR:', err)
        // On error, redirect to dashboard
        router.push('/dashboard?module=mar')
      }
    }

    if (router.isReady && patientId) {
      findOrCreateMAR()
    }
  }, [router.isReady, patientId, router])

  const createNewMARForm = async (patientId: string, profile: any, monthYear: string) => {
    try {
      // Load patient data to create new MAR form
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (patientError) throw patientError

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

      // Create new MAR form
      const { data: newForm, error: createError } = await supabase
        .from('mar_forms')
        .insert({
          patient_id: patientId,
          hospital_id: patient.hospital_id || profile.hospital_id || '',
          month_year: monthYear,
          patient_name: patient.patient_name,
          record_number: patient.record_number,
          date_of_birth: patient.date_of_birth,
          sex: patient.sex,
          diagnosis: patient.diagnosis || null,
          diet: patient.diet || null,
          allergies: patient.allergies || 'None',
          physician_name: patient.physician_name || 'TBD',
          physician_phone: patient.physician_phone || null,
          facility_name: facilityName,
          status: 'active',
          created_by: profile.id
        })
        .select()
        .single()

      if (createError) throw createError

      // Redirect to the newly created MAR form
      router.push(`/patients/${patientId}/mar/${newForm.id}`)
    } catch (err: any) {
      console.error('Error creating MAR form:', err)
      router.push('/dashboard?module=mar')
    }
  }

  const handleCreateNewAnyway = async () => {
    if (!patientId || typeof patientId !== 'string') return
    
    const profile = await getCurrentUserProfile()
    if (!profile) {
      router.push('/auth/login')
      return
    }

    setShowConfirmModal(false)
    await createNewMARForm(patientId, profile, monthYear)
  }

  const handleViewExisting = () => {
    if (existingFormId && patientId) {
      router.push(`/patients/${patientId}/mar/${existingFormId}`)
    }
  }

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showConfirmModal) {
        if (existingFormId && patientId && typeof patientId === 'string') {
          router.push(`/patients/${patientId}/mar/${existingFormId}`)
        }
      }
    }

    window.addEventListener('keydown', handleEscKey)
    return () => {
      window.removeEventListener('keydown', handleEscKey)
    }
  }, [showConfirmModal, existingFormId, patientId, router])

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center">
        {loading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading MAR form...</p>
          </div>
        ) : null}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    MAR Form Already Exists
                  </h2>
                  <button
                    onClick={handleViewExisting}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  A MAR form already exists for <strong>{monthYear}</strong> for this patient. 
                  Would you like to create a new MAR form anyway, or view the existing one?
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleViewExisting}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    View Existing
                  </button>
                  <button
                    onClick={handleCreateNewAnyway}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal transition-colors"
                  >
                    Create New Anyway
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  )
}

