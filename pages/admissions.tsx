import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { PatientProfileFormFields, type PatientProfileFormValues } from '../components/PatientProfileFormFields'
import { missingFieldsForPatientProfileWizardStep1 } from '../lib/patientProfileWizardValidation'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function Admissions() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [resolvedFacilityName, setResolvedFacilityName] = useState<string | null>(null)
  const [step, setStep] = useState<1 | 2>(1)
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '',
    dateOfAdmission: '',
    streetAddress: '',
    city: '',
    state: '',
    homePhone: '',
    email: '',
    diagnosis: '',
    diet: '',
    allergies: '',
    physicianName: '',
    physicianPhone: '',
  })
  const [age, setAge] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [error, setError] = useState('')
  const submitUnlockAtRef = useRef(0)

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)
    }
    loadProfile()
  }, [router])

  useEffect(() => {
    if (!userProfile) return
    setFormData((prev) => {
      if (prev.dateOfAdmission) return prev
      return { ...prev, dateOfAdmission: todayISO() }
    })
  }, [userProfile])

  useEffect(() => {
    const hid = userProfile?.hospital_id
    if (!hid) return
    void (async () => {
      const { data } = await supabase.from('hospitals').select('name').eq('id', hid).maybeSingle()
      setResolvedFacilityName(data?.name ?? null)
    })()
  }, [userProfile?.hospital_id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))

    if (name === 'dateOfBirth' && value) {
      const birthDate = new Date(value)
      const today = new Date()
      let calculatedAge = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--
      }

      setAge(calculatedAge.toString())
    } else if (name === 'dateOfBirth' && !value) {
      setAge('')
    }
  }

  const emptyForm = () => ({
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    sex: '',
    dateOfAdmission: todayISO(),
    streetAddress: '',
    city: '',
    state: '',
    homePhone: '',
    email: '',
    diagnosis: '',
    diet: '',
    allergies: '',
    physicianName: '',
    physicianPhone: '',
  })

  const goToStep2 = () => {
    setError('')
    const missing = missingFieldsForPatientProfileWizardStep1(formData as PatientProfileFormValues)
    if (missing.length) {
      setError(`Please complete: ${missing.join(', ')}.`)
      return
    }
    // Prevent the same click that advances to step 2 from immediately triggering submit.
    submitUnlockAtRef.current = Date.now() + 500
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (step !== 2) return
    if (Date.now() < submitUnlockAtRef.current) return

    const refreshedProfile = await getCurrentUserProfile()
    if (!refreshedProfile) {
      setError('User profile not found. Please logout and login again.')
      return
    }

    if (!refreshedProfile.hospital_id) {
      console.log('Hospital ID missing, attempting to auto-fix...')

      try {
        const { data: existingHospitals, error: hospitalError } = await supabase
          .from('hospitals')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)

        let hospitalId: string | null = null

        if (existingHospitals && existingHospitals.length > 0) {
          hospitalId = existingHospitals[0].id
          console.log('Found existing hospital:', existingHospitals[0].name)
        } else {
          const defaultHospitalName = refreshedProfile.full_name
            ? `${refreshedProfile.full_name}'s Hospital`
            : 'Default Hospital'

          const { data: newHospital, error: createError } = await supabase
            .from('hospitals')
            .insert({
              name: defaultHospitalName,
              facility_type: 'hospital',
              invite_code: 'DEFAULT' + Math.random().toString(36).substring(2, 7).toUpperCase(),
            })
            .select()
            .single()

          if (createError || !newHospital) {
            throw new Error('Failed to create default hospital')
          }

          hospitalId = newHospital.id
          console.log('Created default hospital:', defaultHospitalName)
        }

        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            hospital_id: hospitalId,
            role: refreshedProfile.role === 'nurse' ? 'nurse' : 'superadmin',
          })
          .eq('id', refreshedProfile.id)

        if (updateError) {
          throw updateError
        }

        const updatedProfile = await getCurrentUserProfile()
        if (!updatedProfile || !updatedProfile.hospital_id) {
          throw new Error('Failed to update profile with hospital ID')
        }

        refreshedProfile.hospital_id = updatedProfile.hospital_id
        console.log('Successfully fixed hospital_id:', refreshedProfile.hospital_id)
      } catch (fixError: any) {
        console.error('Auto-fix failed:', fixError)
        setError(
          `Hospital ID is missing and could not be automatically fixed. Please contact support. Error: ${fixError.message}`
        )
        return
      }
    }

    const activeProfile = refreshedProfile

    setIsSubmitting(true)
    setSubmitMessage('')
    setError('')

    try {
      let facilityNameForInsert = resolvedFacilityName
      if (!facilityNameForInsert?.trim() && activeProfile.hospital_id) {
        const { data: h } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', activeProfile.hospital_id)
          .maybeSingle()
        facilityNameForInsert = h?.name ?? null
      }

      const patientName = [formData.firstName, formData.middleName, formData.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()

      if (!patientName) {
        setError('First name and last name are required')
        return
      }

      const recordNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`

      const row: Record<string, unknown> = {
        hospital_id: activeProfile.hospital_id,
        patient_name: patientName,
        record_number: recordNumber,
        date_of_birth: formData.dateOfBirth,
        sex: formData.sex,
        diagnosis: formData.diagnosis.trim() || null,
        diet: formData.diet.trim() || null,
        allergies: formData.allergies.trim() || 'None',
        physician_name: formData.physicianName.trim() || 'TBD',
        physician_phone: formData.physicianPhone.trim() || null,
        facility_name: facilityNameForInsert?.trim() || null,
        created_by: activeProfile.id,
        street_address: formData.streetAddress?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        home_phone: formData.homePhone?.trim() || null,
        email: formData.email?.trim() || null,
        admission_date: formData.dateOfAdmission || null,
      }

      const { data, error: insertError } = await supabase.from('patients').insert([row]).select()

      if (insertError) {
        if (
          insertError.message?.includes('column') &&
          (insertError.message?.includes('does not exist') || insertError.code === 'PGRST204')
        ) {
          setError(
            'Database is missing patient contact columns. Apply migration `067_add_patient_contact_and_admission.sql` (or run latest Supabase migrations), then try again.'
          )
          return
        }
        throw insertError
      }

      if (activeProfile.role === 'nurse' && data?.[0]?.id) {
        await supabase.from('nurse_patient_assignments').insert({
          nurse_id: activeProfile.id,
          patient_id: data[0].id,
          assigned_by: activeProfile.id,
        })
      }

      setSubmitMessage('Admission record saved successfully!')
      setFormData(emptyForm())
      setAge('')
      setStep(1)

      setTimeout(() => {
        router.push('/dashboard?module=mar')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to register patient')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  if (!userProfile) {
    return (
      <ProtectedRoute>
        <Head>
          <title>Loading - Patient Registration - Lasso</title>
        </Head>
        <div className="min-h-screen">
          <AppHeader userProfile={userProfile} onLogout={handleLogout} />
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
        <title>Patient Registration - Lasso</title>
      </Head>
      <div className="min-h-screen bg-[#f5f2eb] dark:bg-gray-900">
        <AppHeader userProfile={userProfile} onLogout={handleLogout} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm mb-4"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Patient Registration</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">Register a new patient in your facility.</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400" aria-live="polite">
                  Step {step} of 2
                </p>
                <div className="flex gap-1.5 w-full sm:w-56 sm:max-w-[14rem] sm:ml-auto" role="progressbar" aria-valuemin={1} aria-valuemax={2} aria-valuenow={step} aria-label="Registration progress">
                  <div className={`h-2.5 flex-1 rounded-sm transition-colors ${step >= 1 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`} />
                  <div className={`h-2.5 flex-1 rounded-sm transition-colors ${step >= 2 ? 'bg-lasso-navy' : 'bg-gray-200 dark:bg-gray-600'}`} />
                </div>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}

              {submitMessage && (
                <div
                  className={`mb-6 p-4 rounded-md ${
                    submitMessage.includes('Error')
                      ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200'
                      : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'
                  }`}
                >
                  {submitMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-10">
                <PatientProfileFormFields
                  values={formData as PatientProfileFormValues}
                  onChange={handleInputChange}
                  ageDisplay={age}
                  mode={{ type: 'wizard', step }}
                  facilityDisplayName={resolvedFacilityName}
                  showCompletionChecks
                />

                <div className="flex flex-wrap justify-end gap-4 pt-2">
                  {step === 2 && (
                    <button
                      type="button"
                      className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 mr-auto sm:mr-0"
                      onClick={() => {
                        setError('')
                        submitUnlockAtRef.current = 0
                        setStep(1)
                      }}
                      disabled={isSubmitting}
                    >
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    onClick={() => {
                      setFormData(emptyForm())
                      setAge('')
                      setStep(1)
                      submitUnlockAtRef.current = 0
                      setSubmitMessage('')
                      setError('')
                    }}
                    disabled={isSubmitting}
                  >
                    Clear
                  </button>
                  {step === 1 ? (
                    <button
                      type="button"
                      className="px-6 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={goToStep2}
                      disabled={isSubmitting}
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="px-6 py-2 bg-lasso-navy text-white rounded-lg hover:bg-lasso-teal focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
