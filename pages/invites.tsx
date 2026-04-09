import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import type { UserProfile } from '../types/auth'

interface Hospital {
  id: string
  name: string
  invite_code: string
}

export default function InvitesPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selectedHospitalId, setSelectedHospitalId] = useState('')
  const [designation, setDesignation] = useState<'PCG' | 'SCG'>('SCG')
  const [creating, setCreating] = useState(false)
  const [lastCode, setLastCode] = useState('')
  const [lastInviteId, setLastInviteId] = useState('')
  const [lastFacilityName, setLastFacilityName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState('')
  const [sendError, setSendError] = useState('')
  const [resendAllowedEmail, setResendAllowedEmail] = useState<string | null>(null)
  const createInviteInFlightRef = useRef(false)
  const sendInviteInFlightRef = useRef(false)

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      if (profile.role !== 'superadmin') {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)

      let query = supabase
        .from('hospitals')
        .select('id, name, invite_code')
        .eq('is_active', true)
        .order('name')

      if (profile.hospital_id) {
        query = query.eq('id', profile.hospital_id)
      }

      const { data, error: fetchError } = await query
      if (fetchError) {
        setError('Failed to load facilities')
        setLoading(false)
        return
      }
      setHospitals(data || [])
      if (data?.length === 1) setSelectedHospitalId(data[0].id)
      setLoading(false)
    }
    load()
  }, [router])

  const isMasteradmin = userProfile?.role === 'superadmin' && !userProfile?.hospital_id

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedHospitalId || !userProfile) return
    if (createInviteInFlightRef.current) return
    createInviteInFlightRef.current = true
    setCreating(true)
    setError('')
    setMessage('')
    setLastCode('')
    try {
      const { data, error: rpcError } = await supabase.rpc('create_facility_invite', {
        p_hospital_id: selectedHospitalId,
        p_designation: designation
      })
      if (rpcError) {
        setError(rpcError.message || 'Failed to create invite')
        setCreating(false)
        return
      }
      const result = Array.isArray(data) ? data[0] : data
      const code = result?.code
      const inviteId = result?.id
      if (!code) {
        setError('No invite code returned')
        setCreating(false)
        return
      }
      setLastCode(code)
      setLastInviteId(inviteId ?? '')
      setLastFacilityName(hospitals.find((h) => h.id === selectedHospitalId)?.name ?? '')
      setInviteEmail('')
      setSendMessage('')
      setSendError('')
      setMessage(`Invite code created. Share it with the new user so they can sign up and join as ${designation}.`)
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to create invite')
    } finally {
      setCreating(false)
      createInviteInFlightRef.current = false
    }
  }

  const handleSendInviteEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !lastCode || !lastInviteId || !lastFacilityName) return
    if (sendInviteInFlightRef.current) return
    sendInviteInFlightRef.current = true
    setSending(true)
    setSendError('')
    setSendMessage('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSendError('You must be signed in to send an invite.')
        setSending(false)
        return
      }
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch(`${base}/api/send-invite-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          inviteId: lastInviteId,
          code: lastCode,
          email: inviteEmail.trim(),
          facilityName: lastFacilityName,
          designation
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSendError(json.error || `Failed to send (${res.status})`)
        setResendAllowedEmail(json.code === 'RESEND_TESTING_RESTRICTION' ? json.allowedEmail ?? null : null)
        setSending(false)
        return
      }
      setResendAllowedEmail(null)
      setSendMessage(json.message || 'Invite sent.')
      setInviteEmail('')
    } catch (err) {
      setSendError((err as Error).message || 'Failed to send invite')
    } finally {
      setSending(false)
      sendInviteInFlightRef.current = false
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Send Invite | Lasso EHR</title>
      </Head>
      <AppHeader userProfile={userProfile} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-lasso-teal">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Send Invite</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Create an invite code with a pre-assigned designation. The new user will join your facility with that designation and cannot change it.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-md">
            <p className="text-green-800 dark:text-green-200">{message}</p>
          </div>
        )}

        <form onSubmit={handleCreateInvite} className="space-y-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <fieldset disabled={creating} className={creating ? 'opacity-80' : ''}>
          <div>
            <label htmlFor="hospital" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Facility
            </label>
            <select
              id="hospital"
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select facility</option>
              {hospitals.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="designation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Designation
            </label>
            <select
              id="designation"
              value={designation}
              onChange={(e) => setDesignation(e.target.value as 'PCG' | 'SCG')}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
            >
              {isMasteradmin ? (
                <>
                  <option value="PCG">PCG (Primary Care Giver)</option>
                  <option value="SCG">SCG (Secondary Care Giver)</option>
                </>
              ) : (
                <option value="SCG">SCG (Secondary Care Giver)</option>
              )}
            </select>
            {!isMasteradmin && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Facility admins can only invite users as SCG. Only masteradmin can assign PCG.
              </p>
            )}
            {isMasteradmin && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Only one PCG per facility. PCG invite will fail if the facility already has a PCG.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={creating || !selectedHospitalId}
            className="w-full px-4 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Invite Code'}
          </button>
          </fieldset>
        </form>

        {lastCode && (
          <>
            <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invite Code</p>
              <code className="block px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-lg tracking-widest">
                {lastCode}
              </code>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Share this code with the new user. They enter it on the signup page to join your facility as {designation}.
              </p>
            </div>

            <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Send invite by email</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Enter the new user&apos;s email. They will receive a link to complete signup with this code and join as {designation}.
              </p>
              {sendError && (
                <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">{sendError}</p>
                  {resendAllowedEmail && (
                    <button
                      type="button"
                      onClick={() => {
                        setInviteEmail(resendAllowedEmail)
                        setSendError('')
                      }}
                      className="mt-2 text-sm font-medium text-lasso-teal hover:text-lasso-navy dark:text-lasso-teal dark:hover:text-lasso-blue"
                    >
                      Use {resendAllowedEmail} for testing
                    </button>
                  )}
                </div>
              )}
              {sendMessage && (
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                  <p className="text-sm text-green-800 dark:text-green-200">{sendMessage}</p>
                </div>
              )}
              <form onSubmit={handleSendInviteEmail} className="flex flex-wrap items-end gap-3">
                <fieldset disabled={sending} className={`contents ${sending ? 'opacity-80' : ''}`}>
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="invite-email" className="sr-only">Email address</label>
                  <input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="newuser@example.com"
                    required
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-lasso-teal dark:bg-gray-700 dark:text-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !inviteEmail.trim()}
                  className="px-4 py-2 bg-lasso-teal text-white rounded-lg hover:bg-lasso-blue font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send invite'}
                </button>
                </fieldset>
              </form>
            </div>
          </>
        )}
      </main>
    </ProtectedRoute>
  )
}
