import { useEffect } from 'react'
import { useRouter } from 'next/router'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import { supabase } from '../../../../lib/supabase'
import { getCurrentUserProfile } from '../../../../lib/auth'

export default function MARIndex() {
  const router = useRouter()
  const { id: patientId } = router.query

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
        const monthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

        // Check if MAR form exists for current month
        const { data: existingForms, error: fetchError } = await supabase
          .from('mar_forms')
          .select('id')
          .eq('patient_id', patientId)
          .eq('month_year', monthYear)
          .order('created_at', { ascending: false })
          .limit(1)

        if (fetchError) throw fetchError

        if (existingForms && existingForms.length > 0) {
          // Redirect to existing MAR form
          router.push(`/patients/${patientId}/mar/${existingForms[0].id}`)
        } else {
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading MAR form...</p>
        </div>
      </div>
    </ProtectedRoute>
  )
}

