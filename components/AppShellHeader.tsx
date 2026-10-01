import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import { clearIdleActivity, useIdleSession } from '../hooks/useIdleSession'
import { IdleSessionChip, IdleSessionModal } from './IdleSessionUI'
import { togglePatientStickyBar } from './PatientStickyBar'
import type { UserProfile } from '../types/auth'

function facilityInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'F'
}

function staffDisplayInitials(profile: UserProfile): string {
  if (profile.staff_initials_text) return profile.staff_initials_text.toUpperCase()
  if (profile.first_name && profile.last_name) return (profile.first_name[0] + profile.last_name[0]).toUpperCase()
  return profile.full_name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

export interface AppShellHeaderProps {
  userProfile?: UserProfile | null
  facilityName?: string
  onAddPatient?: () => void
  onLogout?: () => void | Promise<void>
  patientId?: string
  patientName?: string
}

/** Current Resident Records header. Shared by every signed-in page. */
export default function AppShellHeader({
  userProfile: userProfileProp,
  facilityName: facilityNameProp,
  onAddPatient,
  onLogout,
  patientId,
  patientName,
}: AppShellHeaderProps) {
  const router = useRouter()
  const { isReadOnly, enterReadOnly, exitReadOnly } = useReadOnly()
  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null)
  const [fetchedFacility, setFetchedFacility] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showExitReadOnlyModal, setShowExitReadOnlyModal] = useState(false)
  const [exitPassword, setExitPassword] = useState('')
  const [exitError, setExitError] = useState('')
  const [exiting, setExiting] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const userProfile = userProfileProp !== undefined ? userProfileProp : fetchedProfile
  const facilityName = facilityNameProp || fetchedFacility
  const canUseReadOnly = userProfile?.role === 'superadmin'

  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      const profile = userProfileProp !== undefined
        ? userProfileProp
        : await getCurrentUserProfile()
      if (cancelled) return
      if (userProfileProp === undefined) setFetchedProfile(profile ?? null)
      if (facilityNameProp) {
        setFetchedFacility(facilityNameProp)
        return
      }
      if (profile?.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        if (!cancelled) setFetchedFacility(hospital?.name ?? '')
      }
    }
    hydrate()
    return () => { cancelled = true }
  }, [userProfileProp, facilityNameProp])

  const idle = useIdleSession({
    userId: userProfile?.id,
    fullName: userProfile?.full_name,
    firstName: userProfile?.first_name,
    onExpire: async () => {
      await signOut()
      router.push('/auth/login?reason=idle')
    },
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const handleSwitchUser = async () => {
    clearIdleActivity(userProfile?.id)
    await signOut()
    const isStaff = userProfile?.role === 'nurse' || userProfile?.role === 'head_nurse'
    router.push(isStaff ? '/auth/staff-login' : '/auth/login')
  }

  const handleLogout = async () => {
    clearIdleActivity(userProfile?.id)
    if (onLogout) {
      await onLogout()
      return
    }
    await signOut()
    router.push('/auth/login')
  }

  const handleExitReadOnly = async () => {
    setExitError('')
    if (!exitPassword.trim()) {
      setExitError('Enter your password')
      return
    }
    setExiting(true)
    const ok = await exitReadOnly(exitPassword)
    setExiting(false)
    if (ok) {
      setShowExitReadOnlyModal(false)
      setExitPassword('')
      setExitError('')
    } else {
      setExitError('Incorrect password')
    }
  }

  const goAddResident = () => {
    if (onAddPatient) {
      onAddPatient()
      return
    }
    router.push('/dashboard?addResident=1')
  }

  const fInitials = facilityInitials(facilityName || 'Facility')
  const uInitials = userProfile ? staffDisplayInitials(userProfile) : '?'
  const firstName = userProfile?.first_name || userProfile?.full_name?.split(' ')[0] || ''

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-app-header px-6 py-3.5 flex items-center justify-between gap-4 flex-shrink-0 flex-wrap">
        <div className="relative" ref={userMenuRef}>
          <h1 className="flex items-center gap-3 text-[19px] font-extrabold text-gray-900 dark:text-white tracking-tight m-0 select-none">
            <button
              type="button"
              title={facilityName}
              onClick={() => setUserMenuOpen(o => !o)}
              className="w-[38px] h-[38px] rounded-xl bg-lasso-teal text-white grid place-items-center font-extrabold text-[15px] shadow-sm flex-shrink-0 hover:bg-lasso-navy transition-colors"
            >
              {fInitials}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="hover:text-lasso-teal transition-colors"
            >
              Resident Records
            </button>
            {patientName && (
              <span className="hidden md:inline text-sm font-semibold text-gray-400 truncate max-w-[240px]">
                {patientName}
              </span>
            )}
          </h1>

          {userMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-app-header-dropdown overflow-hidden py-1">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <p className="text-xs font-extrabold uppercase tracking-wide text-gray-400 truncate">
                  {facilityName || 'My Facility'}
                </p>
                <p className="text-sm font-bold text-gray-900 dark:text-white truncate mt-0.5">
                  {userProfile?.full_name ?? '—'}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {(userProfile?.role ?? '').replace('_', ' ')}
                </p>
              </div>
              {(userProfile?.role === 'superadmin' || userProfile?.role === 'head_nurse') && (
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); router.push('/facility-users') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  ⚙ Admin settings
                </button>
              )}
              {userProfile?.role === 'superadmin' && Boolean(userProfile.hospital_id) && (
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); router.push('/billing') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Billing
                </button>
              )}
              {userProfile?.role === 'superadmin' && !userProfile.hospital_id && (
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); router.push('/invites') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Send invite
                </button>
              )}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); router.push('/profile') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Profile
                </button>
              )}
              {canUseReadOnly && !isReadOnly && (
                <button
                  type="button"
                  onClick={() => {
                    enterReadOnly()
                    setUserMenuOpen(false)
                    if (router.pathname === '/profile') router.push('/dashboard')
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  Read-Only View
                </button>
              )}
              {canUseReadOnly && isReadOnly && (
                <button
                  type="button"
                  onClick={() => { setShowExitReadOnlyModal(true); setUserMenuOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  Exit Read-Only
                </button>
              )}
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); handleSwitchUser() }}
                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                🔄 Switch user
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <button
                type="button"
                onClick={() => { setUserMenuOpen(false); handleLogout() }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {idle.showChip && <IdleSessionChip remainingMs={idle.remainingMs} />}
          {patientId && (
            <button
              type="button"
              onClick={togglePatientStickyBar}
              className="px-3.5 py-2 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Patient info
            </button>
          )}
          <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-900/20 rounded-full py-1 pl-4 pr-1 text-sm font-bold text-lasso-teal dark:text-teal-300">
            {firstName && <span className="hidden sm:inline pr-0.5">{firstName}</span>}
            <span className="w-8 h-8 rounded-full bg-lasso-teal text-white grid place-items-center font-extrabold text-[12px] flex-shrink-0">
              {uInitials}
            </span>
            {isReadOnly && (
              <span className="ml-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-[10px] font-bold px-2 py-0.5">
                Read-Only
              </span>
            )}
            <button
              type="button"
              onClick={handleSwitchUser}
              className="ml-0.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-full px-3 py-1.5 text-xs font-bold hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Switch user
            </button>
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={goAddResident}
              className="bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl px-3.5 py-2 text-sm font-bold shadow-sm transition-colors"
            >
              + Add resident
            </button>
          )}
        </div>
      </header>

      {idle.showModal && (
        <IdleSessionModal
          displayName={idle.displayName}
          remainingMs={idle.remainingMs}
          onStay={idle.stayLoggedIn}
        />
      )}

      {showExitReadOnlyModal && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="exit-readonly-title">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 id="exit-readonly-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Exit Read-Only View</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter your password to return to normal view.
            </p>
            <input
              type="password"
              value={exitPassword}
              onChange={(e) => { setExitPassword(e.target.value); setExitError('') }}
              placeholder="Password"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white mb-2"
              onKeyDown={(e) => e.key === 'Enter' && handleExitReadOnly()}
            />
            {exitError && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{exitError}</p>}
            <div className="mb-4 text-right">
              <Link
                href="/auth/forgot-password"
                onClick={() => {
                  setShowExitReadOnlyModal(false)
                  setExitPassword('')
                  setExitError('')
                }}
                className="text-sm font-medium text-lasso-blue hover:text-lasso-teal"
              >
                Forgot your password?
              </Link>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowExitReadOnlyModal(false); setExitPassword(''); setExitError('') }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExitReadOnly}
                disabled={exiting}
                className="flex-1 px-4 py-2 bg-lasso-teal text-white rounded-lg hover:bg-lasso-navy disabled:opacity-50"
              >
                {exiting ? 'Verifying...' : 'Exit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
