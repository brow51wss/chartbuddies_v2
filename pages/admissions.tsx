import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'

export default function Admissions() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<any>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    dob: '',
    sex: '',
    dateOfAdmission: ''
  })
  const [age, setAge] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState('')
  const [error, setError] = useState('')

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    // Auto-calculate age when DOB changes
    if (name === 'dob' && value) {
      const birthDate = new Date(value)
      const today = new Date()
      let calculatedAge = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--
      }
      
      setAge(calculatedAge.toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Refresh profile before checking (in case it was updated)
    const refreshedProfile = await getCurrentUserProfile()
    if (!refreshedProfile) {
      setError('User profile not found. Please logout and login again.')
      return
    }
    
    // Auto-fix: If hospital_id is missing, try to fix it
    if (!refreshedProfile.hospital_id) {
      console.log('Hospital ID missing, attempting to auto-fix...')
      
      try {
        // Try to find an existing hospital
        const { data: existingHospitals, error: hospitalError } = await supabase
          .from('hospitals')
          .select('id, name')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
        
        let hospitalId: string | null = null
        
        if (existingHospitals && existingHospitals.length > 0) {
          // Use the most recent hospital
          hospitalId = existingHospitals[0].id
          console.log('Found existing hospital:', existingHospitals[0].name)
        } else {
          // Create a default hospital
          const defaultHospitalName = refreshedProfile.full_name 
            ? `${refreshedProfile.full_name}'s Hospital` 
            : 'Default Hospital'
          
          const { data: newHospital, error: createError } = await supabase
            .from('hospitals')
            .insert({
              name: defaultHospitalName,
              facility_type: 'hospital',
              invite_code: 'DEFAULT' + Math.random().toString(36).substring(2, 7).toUpperCase()
            })
            .select()
            .single()
          
          if (createError || !newHospital) {
            throw new Error('Failed to create default hospital')
          }
          
          hospitalId = newHospital.id
          console.log('Created default hospital:', defaultHospitalName)
        }
        
        // Update user profile with hospital_id
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({ 
            hospital_id: hospitalId,
            // Keep their role if they're a nurse, otherwise make them superadmin
            role: refreshedProfile.role === 'nurse' ? 'nurse' : 'superadmin'
          })
          .eq('id', refreshedProfile.id)
        
        if (updateError) {
          throw updateError
        }
        
        // Refresh profile again to get updated hospital_id
        const updatedProfile = await getCurrentUserProfile()
        if (!updatedProfile || !updatedProfile.hospital_id) {
          throw new Error('Failed to update profile with hospital ID')
        }
        
        refreshedProfile.hospital_id = updatedProfile.hospital_id
        console.log('Successfully fixed hospital_id:', refreshedProfile.hospital_id)
      } catch (fixError: any) {
        console.error('Auto-fix failed:', fixError)
        setError(`Hospital ID is missing and could not be automatically fixed. Please contact support. Error: ${fixError.message}`)
        return
      }
    }
    
    // Use refreshed profile
    const activeProfile = refreshedProfile

    setIsSubmitting(true)
    setSubmitMessage('')
    setError('')

    try {
      // Combine first, middle, last name into patient_name
      const patientName = [
        formData.firstName,
        formData.middleName,
        formData.lastName
      ].filter(Boolean).join(' ').trim()

      if (!patientName) {
        setError('First name and last name are required')
        return
      }

      // Generate record number (using timestamp + random for uniqueness)
      const recordNumber = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`

      const { data, error: insertError } = await supabase
        .from('patients')
        .insert([
          {
            hospital_id: activeProfile.hospital_id,
            patient_name: patientName,
            record_number: recordNumber,
            date_of_birth: formData.dob,
            sex: formData.sex,
            diagnosis: null, // Will be added later if needed
            diet: null,
            allergies: 'None', // Default, can be updated later
            physician_name: 'TBD', // Default, can be updated later
            physician_phone: null,
            facility_name: null, // Will use hospital name if needed
            created_by: activeProfile.id
          }
        ])
        .select()

      if (insertError) throw insertError

      // Auto-assign patient to nurse if they created it
      if (activeProfile.role === 'nurse') {
        await supabase
          .from('nurse_patient_assignments')
          .insert({
            nurse_id: activeProfile.id,
            patient_id: data[0].id,
            assigned_by: activeProfile.id
          })
      }

      setSubmitMessage('Admission record saved successfully!')
      // Clear form
      setFormData({
        firstName: '',
        middleName: '',
        lastName: '',
        dob: '',
        sex: '',
        dateOfAdmission: ''
      })
      setAge('')

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to register patient')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!userProfile) {
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

  return (
    <ProtectedRoute>
      <Head>
        <title>Patient Registration - Chartbuddies</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm mb-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Patient Registration
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Register a new patient in your facility
            </p>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {submitMessage && (
              <div className={`mb-6 p-4 rounded-md ${submitMessage.includes('Error') ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-200' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-200'}`}>
                {submitMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Section 1: Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="First Name"
                  />
                </div>

                <div>
                  <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    id="middleName"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Middle Name"
                  />
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Last Name"
                  />
                </div>

                <div className="relative">
                  <label htmlFor="dob" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date of Birth (DOB) *
                  </label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="yyyy-mm-dd"
                  />
                </div>

                <div>
                  <label htmlFor="age" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Age
                  </label>
                  <input
                    type="text"
                    id="age"
                    name="age"
                    value={age}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-not-allowed"
                    placeholder="Auto-calculated"
                  />
                </div>

                <div>
                  <label htmlFor="sex" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sex *
                  </label>
                  <select
                    id="sex"
                    name="sex"
                    value={formData.sex}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select...</option>
                    <option value="Male">M</option>
                    <option value="Female">F</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="dateOfAdmission" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Date of Admission *
                  </label>
                  <input
                    type="date"
                    id="dateOfAdmission"
                    name="dateOfAdmission"
                    value={formData.dateOfAdmission}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="yyyy-mm-dd"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                  onClick={() => {
                    setFormData({
                      firstName: '',
                      middleName: '',
                      lastName: '',
                      dob: '',
                      sex: '',
                      dateOfAdmission: ''
                    })
                    setAge('')
                    setSubmitMessage('')
                    setError('')
                  }}
                  disabled={isSubmitting}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

