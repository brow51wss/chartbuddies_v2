import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { signOut } from '../lib/auth'
import { useReadOnly } from '../contexts/ReadOnlyContext'
import type { UserProfile, Patient } from '../types/auth'

const IDLE_TIMEOUT_MS = 60 * 60 * 1000
const WARN_BEFORE_MS  =  2 * 60 * 1000

function facilityInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'F'
}

function patientInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function staffDisplayInitials(profile: UserProfile): string {
  if (profile.staff_initials_text) return profile.staff_initials_text.toUpperCase()
  if (profile.first_name && profile.last_name) return (profile.first_name[0] + profile.last_name[0]).toUpperCase()
  return profile.full_name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function calcAge(dob: string): string {
  if (!dob) return '—'
  const d = new Date(dob + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--
  return String(a)
}

interface DashboardLayoutProps {
  userProfile: UserProfile | null
  facilityName: string
  patients: Patient[]
  loadingPatients: boolean
  selectedPatientId: string | null
  onSelectPatient: (id: string) => void
  onAddPatient: () => void
  children: React.ReactNode
}

export default function DashboardLayout({
  userProfile,
  facilityName,
  patients,
  loadingPatients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  children,
}: DashboardLayoutProps) {
  const router = useRouter()
  const { isReadOnly } = useReadOnly()
  const [showIdleWarning, setShowIdleWarning] = useState(false)
  const [idleSecondsLeft, setIdleSecondsLeft] = useState(60)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const idleTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    if (userMenuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [userMenuOpen])

  const clearIdleTimers = useCallback(() => {
    if (idleTimerRef.current)  clearTimeout(idleTimerRef.current)
    if (warnTimerRef.current)  clearTimeout(warnTimerRef.current)
    if (countdownRef.current)  clearInterval(countdownRef.current)
  }, [])

  const startIdleTimers = useCallback(() => {
    clearIdleTimers()
    setShowIdleWarning(false)

    warnTimerRef.current = setTimeout(() => {
      setIdleSecondsLeft(60)
      setShowIdleWarning(true)
      countdownRef.current = setInterval(() => setIdleSecondsLeft(s => s - 1), 1000)
    }, IDLE_TIMEOUT_MS - WARN_BEFORE_MS)

    idleTimerRef.current = setTimeout(async () => {
      clearIdleTimers()
      setShowIdleWarning(false)
      await signOut()
      router.push('/auth/login?reason=idle')
    }, IDLE_TIMEOUT_MS)
  }, [clearIdleTimers, router])

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    const reset = () => startIdleTimers()
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    startIdleTimers()
    return () => {
      events.forEach(e => window.removeEventListener(e, reset))
      clearIdleTimers()
    }
  }, [startIdleTimers, clearIdleTimers])

  const handleSwitchUser = async () => {
    await signOut()
    const isStaff = userProfile?.role === 'nurse' || userProfile?.role === 'head_nurse'
    router.push(isStaff ? '/auth/staff-login' : '/auth/login')
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const fInitials = facilityInitials(facilityName || 'Facility')
  const uInitials  = userProfile ? staffDisplayInitials(userProfile) : '?'
  const firstName  = userProfile?.first_name || userProfile?.full_name?.split(' ')[0] || ''

  return (
    <div className="flex flex-col bg-[#f4f7f7] dark:bg-gray-900" style={{ height: '100dvh' }}>

      {/* ══════════════ HEADER ══════════════ */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between gap-4 flex-shrink-0 flex-wrap">
        {/* Facility badge + app title — click badge to open settings menu */}
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
            Resident Records
          </h1>

          {/* Settings / logout dropdown */}
          {userMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-30 overflow-hidden py-1">
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

        {/* Right tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Whoami pill */}
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

          {/* Add resident */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={onAddPatient}
              className="bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl px-3.5 py-2 text-sm font-bold shadow-sm transition-colors"
            >
              + Add resident
            </button>
          )}
        </div>
      </header>

      {/* ══════════════ BODY ══════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-[270px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="px-4 pt-5 pb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-gray-400 dark:text-gray-500 m-0">
              Residents
            </h2>
          </div>

          <div className="px-2 pb-4 flex-1">
            {loadingPatients ? (
              <p className="px-3 py-3 text-sm text-gray-400">Loading...</p>
            ) : patients.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">No residents yet.</p>
            ) : (
              patients.map(p => {
                const isActive = p.id === selectedPatientId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPatient(p.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[14px] mb-1.5 text-left transition-colors ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span className={`w-[42px] h-[42px] rounded-full flex-shrink-0 grid place-items-center font-extrabold text-base ${
                      isActive
                        ? 'bg-lasso-teal text-white'
                        : 'bg-teal-50 dark:bg-gray-700 text-lasso-teal dark:text-teal-300'
                    }`}>
                      {patientInitials(p.patient_name)}
                    </span>
                    <span className="flex flex-col leading-snug min-w-0">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                        {p.patient_name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Age {calcAge(p.date_of_birth)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-7">
          <div className="w-full max-w-[1120px]">
            {children}
          </div>
        </main>
      </div>

      {/* ══════════════ IDLE WARNING MODAL ══════════════ */}
      {showIdleWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="idle-warning-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 id="idle-warning-title" className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Session Expiring
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              You will be logged out due to inactivity in{' '}
              <span className="font-bold text-red-600">{idleSecondsLeft}s</span>.
            </p>
            <button
              type="button"
              onClick={startIdleTimers}
              className="w-full px-4 py-2 bg-lasso-teal text-white rounded-lg hover:bg-lasso-navy font-medium"
            >
              Stay logged in
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
