import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getCurrentUserProfile, signOut } from '../lib/auth'
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
  const menuRef = useRef<HTMLDivElement>(null)
  const userProfile = userProfileProp ?? fetchedProfile

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setModulesOpen(false)
    }
    if (modulesOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [modulesOpen])

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
    <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-[999]">
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
                  <span>Go to module</span>
                  <svg className={`w-4 h-4 transition-transform ${modulesOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {modulesOpen && (
                  <div className="absolute top-full left-0 mt-1 py-1 w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-[1000]">
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
            <Link
              href="/admissions"
              className="px-4 py-2 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue text-sm font-medium shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            >
              <span>+</span>
              <span>Add Patient</span>
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Dashboard
            </Link>
            <Link
              href="/profile"
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
