import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import type { Hospital, UserProfile } from '../../types/auth'

// Safe subset — email is intentionally absent (never sent from /api/staff/users)
type SafeUserProfile = Omit<UserProfile, 'email' | 'is_active' | 'created_at' | 'updated_at'>

type Step = 'facility' | 'staff' | 'success'

function getInitials(profile: SafeUserProfile): string {
  // staff_initials_text holds the actual letter initials (e.g. "KM")
  // staff_initials holds the S3 image path — do not use for display text
  if (profile.staff_initials_text) return profile.staff_initials_text.toUpperCase()
  if (profile.first_name && profile.last_name) {
    return (profile.first_name[0] + profile.last_name[0]).toUpperCase()
  }
  return profile.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase() || '?'
}

function getFirstName(profile: SafeUserProfile): string {
  return profile.first_name || profile.full_name.split(' ')[0] || profile.full_name
}

function getRoleLabel(role: string): string {
  return role === 'head_nurse' ? 'Primary Care Giver' : 'Nurse'
}

export default function StaffLogin() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('facility')

  // Facility search
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Hospital[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  // Staff grid
  const [staffList, setStaffList] = useState<SafeUserProfile[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  // Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<SafeUserProfile | null>(null)
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const passwordRef = useRef<HTMLInputElement>(null)

  // Success — keep staff reference separate so closeModal() doesn't wipe it
  const [clockedInStaff, setClockedInStaff] = useState<SafeUserProfile | null>(null)
  const [clockInTime, setClockInTime] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [router])

  // Facility search with 300ms debounce — hospitals table has an anon RLS SELECT policy
  const searchFacilities = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('hospitals')
      .select('id, name, facility_type, address, is_active')
      .ilike('name', `%${q.trim()}%`)
      .eq('is_active', true)
      .limit(6)
    setResults(data || [])
    setSearching(false)
  }, [])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => searchFacilities(val), 300)
  }

  const handleSelectFacility = async (facility: Hospital) => {
    setSelectedHospital(facility)
    setQuery(facility.name)
    setResults([])
    setStaffLoading(true)
    setStep('staff')

    // Fetch staff via server-side API route — email is never returned to the client
    const res = await fetch(`/api/staff/users?hospital_id=${facility.id}`)
    const data: SafeUserProfile[] = res.ok ? await res.json() : []
    setStaffList(data)
    setStaffLoading(false)
  }

  const openModal = (staff: SafeUserProfile) => {
    setSelectedStaff(staff)
    setPassword('')
    setLoginError('')
    setModalOpen(true)
    setTimeout(() => passwordRef.current?.focus(), 80)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedStaff(null)
    setLoginError('')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedStaff || !password.trim()) return
    setLoginLoading(true)
    setLoginError('')

    // Authenticate server-side — email is looked up and used there, never sent to this client
    const res = await fetch('/api/auth/staff-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_profile_id: selectedStaff.id, password }),
    })

    const json = await res.json()

    if (!res.ok) {
      setLoginError(json.error || 'Sign-in failed. Please try again.')
      setLoginLoading(false)
      return
    }

    // Set the session client-side using the tokens returned from the server
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: json.access_token,
      refresh_token: json.refresh_token,
    })

    if (sessionError) {
      setLoginError('Session error. Please try again.')
      setLoginLoading(false)
      return
    }

    // TODO: Record clock-in once shift_logs table exists.
    // Columns needed: user_id, hospital_id, clock_in (timestamptz), clock_out (nullable timestamptz)
    const now = new Date()
    // Capture staff before closeModal() nullifies selectedStaff
    setClockedInStaff(selectedStaff)
    setClockInTime(now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }))
    closeModal()
    setStep('success')

    setLoginLoading(false)
  }

  const handleContinueToDashboard = () => {
    // Always go to dashboard — it handles the onboarding banner internally
    router.push('/dashboard')
  }

  return (
    <>
      <Head>
        <title>Staff Login — Lasso</title>
      </Head>

      {/* ════════════════════════════════
          STEP 1 — Facility search
      ════════════════════════════════ */}
      {step === 'facility' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
              <div className="mb-8 text-center">
                <img
                  src="/images/full-logo-set.webp"
                  alt="Lasso Logo"
                  className="h-auto max-w-xs mx-auto"
                />
              </div>

              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Find your facility
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Type the name of your care home to get started.
              </p>

              <div className="relative">
                <label
                  htmlFor="facilitySearch"
                  className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                >
                  Facility name
                </label>
                <input
                  id="facilitySearch"
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="e.g. Little Heaven Care Home"
                  autoComplete="off"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:text-white transition-all"
                />

                {/* Search results dropdown */}
                {(results.length > 0 || searching) && (
                  <div className="absolute z-10 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 border-t-0 rounded-b-lg shadow-lg overflow-hidden">
                    {searching && (
                      <div className="px-4 py-3 text-sm text-gray-400">Searching...</div>
                    )}
                    {!searching && results.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleSelectFacility(f)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors"
                      >
                        <div className="font-semibold text-sm text-gray-900 dark:text-white">{f.name}</div>
                        {f.address && (
                          <div className="text-xs text-gray-400 mt-0.5">{f.address}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* No results message */}
                {!searching && query.trim().length > 1 && results.length === 0 && (
                  <p className="text-sm text-gray-400 mt-2">
                    No facility found. Check the spelling or contact your administrator.
                  </p>
                )}
              </div>

              <p className="text-center text-sm text-gray-400 mt-8">
                Administrator?{' '}
                <Link
                  href="/auth/login"
                  className="font-semibold text-gray-700 dark:text-gray-300 hover:underline"
                >
                  Admin login →
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          STEP 2 — Staff tile grid
      ════════════════════════════════ */}
      {step === 'staff' && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {selectedHospital?.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Tap your name to sign in. Your login will be recorded as your clock-in time.
            </p>
          </div>

          {staffLoading ? (
            <p className="text-sm text-gray-400">Loading staff...</p>
          ) : staffList.length === 0 ? (
            <p className="text-sm text-gray-400">No staff found for this facility.</p>
          ) : (
            <div
              className="grid gap-3 w-full max-w-2xl"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              {staffList.map((staff) => (
                <button
                  key={staff.id}
                  onClick={() => openModal(staff)}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-md transition-all"
                >
                  <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-lg text-gray-700 dark:text-gray-200 flex-shrink-0">
                    {getInitials(staff)}
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
                      {getFirstName(staff)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {getRoleLabel(staff.role)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 mt-6">
            Not seeing your name? Contact your administrator.
          </p>
          <button
            onClick={() => {
              setStep('facility')
              setQuery('')
              setResults([])
              setSelectedHospital(null)
              setStaffList([])
            }}
            className="mt-3 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-semibold transition-colors"
          >
            ← Different facility
          </button>
        </div>
      )}

      {/* ════════════════════════════════
          STEP 3 — Clock-in confirmation
      ════════════════════════════════ */}
      {step === 'success' && clockedInStaff && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 w-full max-w-sm text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
              Welcome, {getFirstName(clockedInStaff)}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              You are now clocked in. Your shift has started.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 text-sm text-left mb-6">
              <div className="flex justify-between px-4 py-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Facility</span>
                <span className="font-semibold text-gray-900 dark:text-white text-right max-w-[180px]">
                  {selectedHospital?.name}
                </span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Clock-in</span>
                <span className="font-semibold text-gray-900 dark:text-white">{clockInTime}</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="text-gray-500 dark:text-gray-400 font-medium">Role</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {getRoleLabel(clockedInStaff.role)}
                </span>
              </div>
            </div>

            <button
              onClick={handleContinueToDashboard}
              className="w-full px-4 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Continue to dashboard →
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════
          LOGIN MODAL
      ════════════════════════════════ */}
      {modalOpen && selectedStaff && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-7">
            {/* Staff identity */}
            <div className="flex flex-col items-center mb-5">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center font-bold text-xl text-gray-700 dark:text-gray-200 mb-3">
                {getInitials(selectedStaff)}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {selectedStaff.full_name}
              </h3>
              <p className="text-sm text-gray-400">{getRoleLabel(selectedStaff.role)}</p>
            </div>

            {/* Timeclock notice */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 mb-5 flex gap-3 text-sm text-green-800 dark:text-green-200 font-medium">
              <span className="flex-shrink-0">🕐</span>
              <span>Signing in will record your clock-in time for this shift.</span>
            </div>

            {loginError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded text-sm text-red-700 dark:text-red-300">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <label
                htmlFor="staffPassword"
                className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="staffPassword"
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:text-white transition-all mb-4"
              />
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loginLoading ? 'Signing in...' : 'Sign in & clock in'}
              </button>
            </form>

            <div className="flex items-center justify-between mt-3">
              <Link
                href="/auth/forgot-password"
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium"
              >
                Forgot password?
              </Link>
              <button
                type="button"
                onClick={closeModal}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
