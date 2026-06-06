import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile } from '../../../../lib/auth'
import { ensureProgressNoteSummaryForMonth } from '../../../../lib/progress-notes'
import { rdsGetPatient, rdsListMarForms, rdsCreateMarForm } from '../../../../lib/rdsApi'

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
        const allForms = await rdsListMarForms(patientId)
        const existingForms = allForms.filter((f: any) => f.month_year === currentMonthYear)

        if (existingForms.length > 0) {
          setExistingFormId(existingForms[0].id)
          setShowConfirmModal(true)
          setLoading(false)
        } else {
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
      const patient = await rdsGetPatient(patientId)

      const newForm = await rdsCreateMarForm({
        patient_id: patientId,
        month_year: monthYear,
        status: 'active',
      })

      await ensureProgressNoteSummaryForMonth(patientId, monthYear, profile.id)

      router.push(`/patients/${patientId}/mar/${newForm.id}`)
    } catch (err: any) {
      console.error('Error creating MAR form:', err)
      router.push('/dashboard?module=mar')
    }
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
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal" onClick={(e) => e.stopPropagation()}>
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
                  Only one MAR per month and year is allowed. View the existing form below.
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={handleViewExisting}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal transition-colors"
                  >
                    View Existing MAR
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

