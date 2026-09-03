import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import type { UserProfile } from '../types/auth'

interface CaregiverTile {
  id: string
  full_name: string
  first_name: string | null
  last_name: string | null
  staff_initials_text: string | null
  role: string
  designation: string | null
}

function tileInitials(c: CaregiverTile): string {
  if (c.staff_initials_text?.trim()) return c.staff_initials_text.trim().toUpperCase().slice(0, 4)
  const fn = c.first_name?.trim()?.[0] || ''
  const ln = c.last_name?.trim()?.[0] || ''
  if (fn && ln) return (fn + ln).toUpperCase()
  return (
    c.full_name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
  )
}

function tileFirstName(c: CaregiverTile): string {
  return c.first_name?.trim() || c.full_name.split(' ')[0] || c.full_name
}

function roleLabel(role: string, designation: string | null): string {
  if (designation === 'PCG' || role === 'superadmin') return 'PCG'
  if (role === 'head_nurse') return 'Head nurse'
  return 'Nurse'
}

export default function FacilityUsersPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [caregivers, setCaregivers] = useState<CaregiverTile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [initials, setInitials] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [justAdded, setJustAdded] = useState('')
  const [resetting, setResetting] = useState<CaregiverTile | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState('')

  const canManage = userProfile?.role === 'superadmin' && Boolean(userProfile.hospital_id)
  const canAdd = canManage

  async function loadCaregivers(hospitalId: string) {
    const { data, error: loadError } = await supabase
      .from('user_profiles')
      .select('id, full_name, first_name, last_name, staff_initials_text, role, designation, is_active')
      .eq('hospital_id', hospitalId)
      .eq('is_active', true)
      .order('first_name', { ascending: true })

    if (loadError) throw loadError
    setCaregivers((data || []) as CaregiverTile[])
  }

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      if (!profile.hospital_id || (profile.role !== 'superadmin' && profile.role !== 'nurse' && profile.role !== 'head_nurse')) {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)
      try {
        await loadCaregivers(profile.hospital_id)
      } catch {
        setError('Failed to load caregivers')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  function openAdd() {
    setFirstName('')
    setLastName('')
    setInitials('')
    setPassword('')
    setConfirm('')
    setSaveError('')
    setJustAdded('')
    setAdding(true)
    setResetting(null)
  }

  function openReset(c: CaregiverTile) {
    setResetPassword('')
    setResetConfirm('')
    setResetError('')
    setJustAdded('')
    setAdding(false)
    setResetting(c)
  }

  function canResetTile(c: CaregiverTile): boolean {
    if (!canManage || !userProfile) return false
    if (c.id === userProfile.id) return false
    if (c.role === 'superadmin' || c.designation === 'PCG') return false
    return c.role === 'nurse' || c.role === 'head_nurse'
  }

  async function submitReset() {
    if (!canManage || !resetting) return
    if (resetPassword.length < 8) {
      setResetError('Password must be at least 8 characters. Give this to the nurse for staff login.')
      return
    }
    if (resetPassword !== resetConfirm) {
      setResetError('Passwords do not match.')
      return
    }
    setResetSaving(true)
    setResetError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setResetError('Your session expired. Sign in again.')
        return
      }
      const res = await fetch('/api/staff/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_profile_id: resetting.id,
          password: resetPassword,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setResetError(json.error || 'Failed to reset password')
        return
      }
      const name = tileFirstName(resetting)
      setJustAdded(`${name}'s password was reset. Tell them the new password for staff login.`)
      setResetting(null)
    } catch {
      setResetError('Failed to reset password')
    } finally {
      setResetSaving(false)
    }
  }

  async function submitAdd() {
    if (!canAdd) return
    const fn = firstName.trim()
    const ln = lastName.trim()
    if (!fn || !ln) {
      setSaveError('First name and last name are required.')
      return
    }
    if (password.length < 8) {
      setSaveError('Password must be at least 8 characters. Give this to the nurse for staff login.')
      return
    }
    if (password !== confirm) {
      setSaveError('Passwords do not match.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setSaveError('Your session expired. Sign in again.')
        return
      }
      const res = await fetch('/api/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          first_name: fn,
          last_name: ln,
          initials: initials.trim(),
          password,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSaveError(json.error || 'Failed to add caregiver')
        return
      }
      if (json.caregiver) {
        setCaregivers(prev => [...prev, json.caregiver].sort((a, b) =>
          (a.first_name || a.full_name).localeCompare(b.first_name || b.full_name)
        ))
        const addedName = json.caregiver.first_name || json.caregiver.full_name
        setJustAdded(`${addedName} can now clock in at staff login with the password you set.`)
      }
      setAdding(false)
    } catch {
      setSaveError('Failed to add caregiver')
    } finally {
      setSaving(false)
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
        <title>Caregivers | Lasso EHR</title>
      </Head>
      <AppHeader userProfile={userProfile} />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-lasso-teal">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Caregivers</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          People who can clock in at this facility. New nurses appear on staff login as a tile. No invite email.
          {canManage && ' Forgot a password? Reset it here from any phone — then tell the nurse the new one.'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
        {justAdded && (
          <div className="mb-6 p-4 bg-teal-50 dark:bg-teal-900/20 border-l-4 border-lasso-teal rounded-md">
            <p className="text-teal-900 dark:text-teal-100 text-sm">{justAdded}</p>
          </div>
        )}

        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
        >
          {caregivers.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-full bg-[#2b8878] text-white flex items-center justify-center font-extrabold text-lg flex-shrink-0">
                {tileInitials(c)}
              </div>
              <div className="text-center">
                <div className="font-semibold text-sm text-gray-900 dark:text-white leading-tight">
                  {tileFirstName(c)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {roleLabel(c.role, c.designation)}
                </div>
              </div>
              {canResetTile(c) && (
                <button
                  type="button"
                  onClick={() => openReset(c)}
                  className="text-xs font-semibold text-lasso-teal hover:underline"
                >
                  Reset password
                </button>
              )}
            </div>
          ))}

          {canAdd && (
            <button
              type="button"
              onClick={openAdd}
              className="rounded-xl p-5 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-[#2b8878] hover:text-[#2b8878] min-h-[160px] transition-colors"
            >
              <span className="text-4xl font-light leading-none">+</span>
              <span className="text-sm font-bold">Add caregiver</span>
            </button>
          )}
        </div>

        {!canAdd && caregivers.length === 0 && (
          <p className="text-sm text-gray-400 mt-6">No caregivers yet. Ask the PCG to add staff.</p>
        )}
      </main>

      {adding && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => !saving && setAdding(false)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">Add caregiver</h2>
              <button type="button" onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                submitAdd()
              }}
            >
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">First name *</label>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      autoComplete="given-name"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1">Last name *</label>
                    <input
                      value={lastName}
                      onChange={e => setLastName(e.target.value)}
                      autoComplete="family-name"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Initials</label>
                  <input
                    value={initials}
                    onChange={e => setInitials(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="Auto from name if blank"
                    autoComplete="off"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Staff login password *</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Tell the nurse this password. They use it on staff login — not an email invite.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Confirm password *</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
                {saveError && <p className="text-sm text-red-500">{saveError}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40"
                >
                  {saving ? 'Adding…' : 'Add caregiver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={() => !resetSaving && setResetting(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Reset password — {tileFirstName(resetting)}
              </h2>
              <button type="button" onClick={() => !resetSaving && setResetting(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault()
                submitReset()
              }}
            >
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Set a new staff login password and tell {tileFirstName(resetting)} in person or by phone. This does not send an email.
                </p>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">New password *</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={e => setResetPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1">Confirm password *</label>
                  <input
                    type="password"
                    value={resetConfirm}
                    onChange={e => setResetConfirm(e.target.value)}
                    autoComplete="new-password"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-lasso-teal"
                  />
                </div>
                {resetError && <p className="text-sm text-red-500">{resetError}</p>}
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button
                  type="button"
                  onClick={() => setResetting(null)}
                  disabled={resetSaving}
                  className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="px-4 py-2 text-sm text-white bg-lasso-teal rounded-lg hover:brightness-90 disabled:opacity-40"
                >
                  {resetSaving ? 'Saving…' : 'Reset password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}
