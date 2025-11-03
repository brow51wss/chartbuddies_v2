import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function Signup() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    hospitalName: '',
    facilityType: 'hospital',
    inviteCode: '' // Optional - if joining existing hospital
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(1) // 1: Account info, 2: Hospital info

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError('')
    setStep(2)
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName
          }
        }
      })

      if (authError) {
        console.error('Auth error:', authError)
        throw new Error(authError.message || 'Failed to create account')
      }
      if (!authData.user) {
        throw new Error('Failed to create user account')
      }

      // Wait a bit for the trigger to create the user profile
      let profileExists = false
      let attempts = 0
      while (!profileExists && attempts < 10) {
        const { data: existingProfile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('id', authData.user.id)
          .single()
        
        if (existingProfile) {
          profileExists = true
          break
        }
        
        // Wait 200ms before retry
        await new Promise(resolve => setTimeout(resolve, 200))
        attempts++
      }

      if (!profileExists) {
        // Create profile manually if trigger didn't work
        console.log('Trigger did not create profile, creating manually...')
        const { data: newProfile, error: createProfileError } = await supabase
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: authData.user.email!,
            full_name: formData.fullName,
            role: 'nurse',
            hospital_id: null
          })
          .select()
          .single()

        if (createProfileError) {
          console.error('Profile creation error:', createProfileError)
          // Check if it's a duplicate key error (profile was created by trigger after all)
          if (createProfileError.code === '23505') {
            console.log('Profile already exists (created by trigger), continuing...')
          } else {
            throw new Error(`Failed to create user profile: ${createProfileError.message}`)
          }
        } else {
          console.log('Profile created successfully:', newProfile)
        }
      }

      // Step 2: Create or join hospital
      if (formData.inviteCode) {
        // Join existing hospital
        const { data: hospitalData, error: hospitalError } = await supabase
          .from('hospitals')
          .select('id')
          .eq('invite_code', formData.inviteCode.toUpperCase().trim())
          .eq('is_active', true)
          .single()

        if (hospitalError || !hospitalData) {
          throw new Error('Invalid invite code. Please check and try again.')
        }

        // Update user profile to join hospital as nurse
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            hospital_id: hospitalData.id,
            role: 'nurse',
            full_name: formData.fullName
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error('Profile update error:', profileError)
          throw new Error('Failed to join hospital. Please try again.')
        }
      } else {
        // Create new hospital - user becomes superadmin
        let inviteCode = generateInviteCode()
        let codeUnique = false
        let codeAttempts = 0

        // Ensure invite code is unique
        while (!codeUnique && codeAttempts < 10) {
          const { data: existingCode } = await supabase
            .from('hospitals')
            .select('id')
            .eq('invite_code', inviteCode)
            .single()

          if (!existingCode) {
            codeUnique = true
          } else {
            inviteCode = generateInviteCode()
            codeAttempts++
          }
        }

        const { data: hospitalData, error: hospitalError } = await supabase
          .from('hospitals')
          .insert({
            name: formData.hospitalName,
            facility_type: formData.facilityType,
            invite_code: inviteCode
          })
          .select()
          .single()

        if (hospitalError) {
          console.error('Hospital creation error:', hospitalError)
          throw new Error(hospitalError.message || 'Failed to create hospital')
        }

        if (!hospitalData) {
          throw new Error('Hospital creation failed. Please try again.')
        }

        // Update user profile to be superadmin of new hospital
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({
            hospital_id: hospitalData.id,
            role: 'superadmin',
            full_name: formData.fullName
          })
          .eq('id', authData.user.id)

        if (profileError) {
          console.error('Profile update error:', profileError)
          throw new Error('Failed to set up admin access. Please contact support.')
        }
      }

      // Redirect to dashboard
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Signup error:', err)
      setError(err.message || 'Database error saving new user')
      setLoading(false)
    }
  }

  const generateInviteCode = (): string => {
    // Generate 8-character code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  return (
    <>
      <Head>
        <title>Sign Up - Chartbuddies</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-white">
            Create Account
          </h1>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-6">
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name
                </label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-semibold"
              >
                Continue
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="space-y-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Do you have an invite code to join an existing hospital?
                </p>
                <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Invite Code (Optional)
                </label>
                <input
                  id="inviteCode"
                  name="inviteCode"
                  type="text"
                  value={formData.inviteCode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white uppercase"
                  placeholder="ABC12345"
                  maxLength={8}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Leave blank if you're creating a new hospital
                </p>
              </div>

              {!formData.inviteCode && (
                <>
                  <div>
                    <label htmlFor="hospitalName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Hospital/Facility Name *
                    </label>
                    <input
                      id="hospitalName"
                      name="hospitalName"
                      type="text"
                      value={formData.hospitalName}
                      onChange={handleChange}
                      required={!formData.inviteCode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      placeholder="General Hospital"
                    />
                  </div>

                  <div>
                    <label htmlFor="facilityType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Facility Type *
                    </label>
                    <select
                      id="facilityType"
                      name="facilityType"
                      value={formData.facilityType}
                      onChange={handleChange}
                      required={!formData.inviteCode}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="hospital">Hospital</option>
                      <option value="home_care">Home Care</option>
                      <option value="clinic">Clinic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </>
              )}

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Already have an account?{' '}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

