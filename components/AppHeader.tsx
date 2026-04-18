import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile } from '../types/auth'

interface AppHeaderProps {
  userProfile?: UserProfile | null
  onLogout?: () => void
  /** When on a patient module page, pass patient id to show the module jump menu */
  patientId?: string
  /** Patient name for the jump menu label (optional) */
  patientName?: string
}

const PATIENT_MODULES = [
  { label: 'Patient overview', path: '' },
  { label: 'MAR Forms', path: '/forms' },
  { label: 'Progress Notes', path: '/progress-notes' }
] as const

/**
 * Global navigation header for all module pages.
 * Edit this file to change the nav across the app.
 * If userProfile/onLogout are not passed, the header fetches profile and uses default logout.
 * When patientId is set, a "Modules" jump menu is shown so the user can switch between modules for that patient.
 */
export default function AppHeader({ userProfile: userProfileProp, onLogout, patientId, patientName }: AppHeaderProps) {
  const router = useRouter()
  const [fetchedProfile, setFetchedProfile] = useState<UserProfile | null>(null)
  const [modulesOpen, setModulesOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [showExitReadOnlyModal, setShowExitReadOnlyModal] = useState(false)
  const [exitPassword, setExitPassword] = useState('')
  const [exitError, setExitError] = useState('')
  const [exiting, setExiting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const userProfile = userProfileProp ?? fetchedProfile
  const { isReadOnly, enterReadOnly, exitReadOnly } = useReadOnly()
  const canUseReadOnly = userProfile?.role === 'superadmin'

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setModulesOpen(false)
    }
    if (modulesOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [modulesOpen])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false)
    }
    if (userMenuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [userMenuOpen])

  useEffect(() => {
    if (userProfileProp != null) return
    let cancelled = false
    getCurrentUserProfile().then((p) => {
      if (!cancelled) setFetchedProfile(p ?? null)
    })
    return () => { cancelled = true }
  }, [userProfileProp])

  const handleLogout = onLogout ?? (async () => {
    await signOut()
    router.push('/auth/login')
  })

  return (
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-app-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-4">
              <img
                src="/images/icon-wordmark.webp"
                alt="Lasso EHR"
                className="h-10 w-auto"
              />
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {userProfile?.full_name ?? 'Loading...'} • {(userProfile?.role ?? '').replace('_', ' ').toUpperCase()}
              {isReadOnly && <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 rounded text-xs font-medium">Read-Only View</span>}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {patientId && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setModulesOpen((o) => !o)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5"
                  aria-expanded={modulesOpen}
                  aria-haspopup="true"
                >
                  <span>Go to form</span>
                  <svg className={`w-4 h-4 transition-transform ${modulesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {modulesOpen && (
                  <div className="absolute top-full left-0 mt-1 py-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-app-header-dropdown">
                    <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600 text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
                      {patientName ? `Patient: ${patientName}` : 'Jump to module'}
                    </div>
                    {PATIENT_MODULES.map(({ label, path }) => (
                      <Link
                        key={path || 'overview'}
                        href={`/patients/${patientId}${path}`}
                        onClick={() => setModulesOpen(false)}
                        className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!isReadOnly && (
              <Link
                href="/admissions"
                className="px-4 py-2 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
              >
                <span>+</span>
                <span>Add Patient</span>
              </Link>
            )}
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Dashboard
            </Link>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((o) => !o)}
                className="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                aria-haspopup="true"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 py-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-app-header-dropdown">
                  {!isReadOnly && userProfile?.role === 'superadmin' && (
                    <Link
                      href="/invites"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Send Invite
                    </Link>
                  )}
                  {!isReadOnly && userProfile?.role === 'superadmin' && userProfile?.hospital_id && (
                    <Link
                      href="/facility-users"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Facility Users
                    </Link>
                  )}
                  {canUseReadOnly && !isReadOnly && (
                    <div className="flex justify-center my-1">
                      <button
                        type="button"
                        onClick={() => {
                          enterReadOnly()
                          setUserMenuOpen(false)
                          if (router.pathname === '/profile') router.push('/dashboard')
                        }}
                        className="w-[85%] text-left px-3 py-2 text-sm font-medium border border-amber-500 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20"
                      >
                        Read-Only View
                      </button>
                    </div>
                  )}
                  {canUseReadOnly && isReadOnly && (
                    <div className="flex justify-center my-1">
                      <button
                        type="button"
                        onClick={() => { setShowExitReadOnlyModal(true); setUserMenuOpen(false); }}
                        className="w-[85%] text-left px-3 py-2 text-sm font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                      >
                        Exit Read-Only
                      </button>
                    </div>
                  )}
                  {!isReadOnly && (
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Profile
                    </Link>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      Logout
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Read-Only Modal */}
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
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={() => { setShowExitReadOnlyModal(false); setExitPassword(''); setExitError(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExitReadOnly}
                disabled={exiting}
                className="flex-1 px-4 py-2 bg-lasso-teal text-white rounded-lg hover:bg-lasso-blue disabled:opacity-50"
              >
                {exiting ? 'Verifying...' : 'Exit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
