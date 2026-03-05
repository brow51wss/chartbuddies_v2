import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile } from '../types/auth'

export default function Profile() {
  const router = useRouter()
  const { isReadOnly } = useReadOnly()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [facilityName, setFacilityName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [signatureLinkSending, setSignatureLinkSending] = useState(false)
  const [signatureLinkMessage, setSignatureLinkMessage] = useState('')
  const [signatureLinkError, setSignatureLinkError] = useState('')
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    designation: ''
  })

  useEffect(() => {
    if (isReadOnly) {
      router.replace('/dashboard')
      return
    }
  }, [isReadOnly, router])

  useEffect(() => {
    if (isReadOnly) return
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
        designation: profile.designation || ''
      })
      if (profile.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        setFacilityName(hospital?.name ?? null)
      } else {
        setFacilityName(null)
      }
      setLoading(false)
    }
    loadProfile()
  }, [router, isReadOnly])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const updatePayload: Record<string, unknown> = {
        first_name: formData.first_name.trim(),
        middle_name: formData.middle_name.trim() || null,
        last_name: formData.last_name.trim()
      }
      if (!userProfile.designation_locked) {
        updatePayload.designation = formData.designation.trim() || null
      }
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('id', userProfile.id)
      if (updateError) throw updateError
      const updatedProfile = await getCurrentUserProfile()
      if (updatedProfile) {
        setUserProfile(updatedProfile)
        setFormData((prev) => ({
          ...prev,
          first_name: updatedProfile.first_name ?? prev.first_name,
          middle_name: (updatedProfile as any).middle_name ?? prev.middle_name,
          last_name: (updatedProfile as any).last_name ?? prev.last_name,
          designation: updatedProfile.designation ?? prev.designation
        }))
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

  const handleSendSignatureSetupLink = async () => {
    setSignatureLinkError('')
    setSignatureLinkMessage('')
    setSignatureLinkSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSignatureLinkError('Please sign in again.')
        return
      }
      const res = await fetch('/api/send-signature-setup-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` }
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSignatureLinkError(data.error || 'Failed to send email')
        return
      }
      setSignatureLinkMessage(data.message || 'Email sent. Use the link on your phone or tablet to draw your signature and initials.')
      setTimeout(() => setSignatureLinkMessage(''), 8000)
    } catch {
      setSignatureLinkError('Network error')
    } finally {
      setSignatureLinkSending(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
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
        <AppHeader userProfile={userProfile} onLogout={async () => { await signOut(); router.push('/auth/login') }} />

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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>

              {/* Signature and initials: set via email link on mobile/tablet only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Signature and initials
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  You must set your signature and initials using a mobile device or tablet. Click below to receive an email with a secure link.
                </p>
                {(userProfile?.staff_signature || userProfile?.staff_initials) && (
                  <div className="flex flex-wrap gap-4 mb-3">
                    {userProfile.staff_signature && (userProfile.staff_signature.startsWith('data:image') ? (
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Current signature</span>
                        <img src={userProfile.staff_signature} alt="Your signature" className="max-h-14 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Current signature</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{userProfile.staff_signature}</span>
                      </div>
                    ))}
                    {userProfile.staff_initials && (userProfile.staff_initials.startsWith('data:image') ? (
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Current initials</span>
                        <img src={userProfile.staff_initials} alt="Your initials" className="max-h-10 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700" />
                      </div>
                    ) : (
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Current initials</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{userProfile.staff_initials}</span>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSendSignatureSetupLink}
                  disabled={signatureLinkSending}
                  className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signatureLinkSending ? 'Sending...' : 'Create/Edit signature and initials'}
                </button>
                {signatureLinkMessage && (
                  <p className="mt-2 text-sm text-green-600 dark:text-green-400">{signatureLinkMessage}</p>
                )}
                {signatureLinkError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{signatureLinkError}</p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Used on the MAR for PRN records and whenever you initial. The link in the email is one-time use and time-limited.
                </p>
              </div>

              {/* Designation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Designation
                </label>
                {userProfile?.designation_locked ? (
                  <input
                    type="text"
                    value={formData.designation || '—'}
                    readOnly
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  >
                    <option value="">Select designation</option>
                    <option value="PCG">PCG</option>
                    <option value="SCG">SCG</option>
                  </select>
                )}
                {userProfile?.designation_locked && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Assigned via invite code and cannot be changed</p>
                )}
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

              {/* Facility (Read-only) - assigned via your account */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Facility
                </label>
                <input
                  type="text"
                  value={facilityName ?? ''}
                  disabled
                  readOnly
                  placeholder="No facility assigned"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your assigned facility. This is shown as Facility Name on MAR forms. Contact an administrator to change.</p>
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
                  className="px-6 py-2 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

