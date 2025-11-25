import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import type { UserProfile } from '../types/auth'

export default function Profile() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    staff_initials: '',
    staff_signature: '',
    designation: ''
  })

  useEffect(() => {
    const loadProfile = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)
      
      // Parse full_name into separate fields if they don't exist
      let firstName = (profile as any).first_name || ''
      let middleName = (profile as any).middle_name || ''
      let lastName = (profile as any).last_name || ''
      
      // If separate fields don't exist, parse from full_name
      if (!firstName && !lastName && profile.full_name) {
        const names = profile.full_name.trim().split(/\s+/)
        if (names.length >= 2) {
          firstName = names[0]
          lastName = names[names.length - 1]
          if (names.length > 2) {
            middleName = names.slice(1, -1).join(' ')
          }
        } else if (names.length === 1) {
          firstName = names[0]
        }
      }
      
      setFormData({
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        staff_initials: profile.staff_initials || '',
        staff_signature: profile.staff_signature || '',
        designation: profile.designation || ''
      })
      setLoading(false)
    }
    loadProfile()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile) return

    setSaving(true)
    setError('')
    setMessage('')

    try {
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          first_name: formData.first_name.trim(),
          middle_name: formData.middle_name.trim() || null,
          last_name: formData.last_name.trim(),
          staff_initials: formData.staff_initials.toUpperCase().trim(),
          staff_signature: formData.staff_signature.trim() || null,
          designation: formData.designation.trim() || null
        })
        .eq('id', userProfile.id)

      if (updateError) throw updateError

      // Reload profile to get updated data
      const updatedProfile = await getCurrentUserProfile()
      if (updatedProfile) {
        setUserProfile(updatedProfile)
      }

      setMessage('Profile updated successfully!')
      setTimeout(() => setMessage(''), 3000)
    } catch (err: any) {
      console.error('Error updating profile:', err)
      setError(err.message || 'Failed to update profile')
      setTimeout(() => setError(''), 5000)
    } finally {
      setSaving(false)
    }
  }

  // Generate initials suggestion from first and last name
  const generateInitials = () => {
    const first = formData.first_name.trim()
    const last = formData.last_name.trim()
    if (first && last) {
      return (first[0] + last[0]).toUpperCase()
    } else if (first) {
      return first[0].toUpperCase()
    }
    return ''
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading profile...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Profile - Lasso</title>
      </Head>
      <div className="min-h-screen">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <img 
                    src="/images/icon-wordmark.webp" 
                    alt="Lasso EHR" 
                    className="h-10 w-auto cursor-pointer"
                  />
                </Link>
              </div>
              <div className="flex items-center space-x-3">
                <Link
                  href="/dashboard"
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">My Profile</h1>

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

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={userProfile?.email || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Middle Name
                  </label>
                  <input
                    type="text"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Staff Initials */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Staff Initials *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.staff_initials}
                    onChange={(e) => setFormData({ ...formData, staff_initials: e.target.value.toUpperCase() })}
                    maxLength={4}
                    required
                    placeholder="e.g., JS"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  {(formData.first_name || formData.last_name) && (
                    <button
                      type="button"
                      onClick={() => {
                        const suggested = generateInitials()
                        if (suggested) {
                          setFormData({ ...formData, staff_initials: suggested })
                        }
                      }}
                      className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium transition-colors"
                    >
                      Auto-fill
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your initials will be used in MAR forms. Click "Auto-fill" to generate from your name.
                </p>
              </div>

              {/* Staff Signature */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Staff Signature
                </label>
                <input
                  type="text"
                  value={formData.staff_signature}
                  onChange={(e) => setFormData({ ...formData, staff_signature: e.target.value })}
                  placeholder="Your full signature"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optional: Your full signature for PRN records</p>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Designation
                </label>
                <select
                  value={formData.designation}
                  onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">Select designation</option>
                  <option value="RN">RN (Registered Nurse)</option>
                  <option value="LPN">LPN (Licensed Practical Nurse)</option>
                  <option value="CNA">CNA (Certified Nursing Assistant)</option>
                  <option value="NP">NP (Nurse Practitioner)</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Role (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <input
                  type="text"
                  value={userProfile?.role?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Role is managed by administrators</p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  href="/dashboard"
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

