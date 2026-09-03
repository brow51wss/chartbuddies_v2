import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Signed-in EHR only. Public marketing, legal, and auth pages are excluded. */
const EHR_IDLE_PREFIXES = [
  '/dashboard',
  '/patients',
  '/profile',
  '/admissions',
  '/invites',
  '/facility-users',
  '/deleted-patients',
  '/onboarding',
]

export function isEhrIdlePath(pathname: string | undefined): boolean {
  if (!pathname) return false
  return EHR_IDLE_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export const IDLE_TIMEOUT_MS = 15 * 60 * 1000
export const IDLE_CHIP_MS = 2 * 60 * 1000
export const IDLE_MODAL_MS = 60 * 1000

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click', 'wheel'] as const

function storageKey(userId: string): string {
  return `lasso-idle-last-activity:${userId}`
}

export function clearIdleActivity(userId: string | null | undefined): void {
  if (!userId || typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(storageKey(userId))
  } catch {
    // ignore quota / private-mode failures
  }
}

function readStoredActivity(userId: string): number | null {
  try {
    const raw = window.localStorage.getItem(storageKey(userId))
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function writeStoredActivity(userId: string, at: number): void {
  try {
    window.localStorage.setItem(storageKey(userId), String(at))
  } catch {
    // ignore
  }
}

function sessionFirstName(fullName?: string | null, firstName?: string | null): string {
  const first = (firstName || '').trim()
  if (first) return first
  const fromFull = (fullName || '').trim().split(/\s+/)[0]
  return fromFull || 'Your'
}

export function useIdleSession(opts: {
  userId: string | null | undefined
  fullName?: string | null
  firstName?: string | null
  onExpire: () => void | Promise<void>
}) {
  const { userId, fullName, firstName, onExpire } = opts
  const router = useRouter()
  const enabled = Boolean(userId) && isEhrIdlePath(router.pathname)
  const displayName = sessionFirstName(fullName, firstName)
  const [remainingMs, setRemainingMs] = useState(IDLE_TIMEOUT_MS)
  const lastActivityRef = useRef(Date.now())
  const lastWriteRef = useRef(0)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const touch = useCallback((persist = true) => {
    if (!userId || !isEhrIdlePath(router.pathname)) return
    const now = Date.now()
    lastActivityRef.current = now
    if (persist && now - lastWriteRef.current >= 1000) {
      lastWriteRef.current = now
      writeStoredActivity(userId, now)
    }
  }, [userId, router.pathname])

  useEffect(() => {
    expiredRef.current = false
    if (!enabled || !userId || typeof window === 'undefined') {
      setRemainingMs(IDLE_TIMEOUT_MS)
      return
    }

    const stored = readStoredActivity(userId)
    const now = Date.now()
    const start = stored && now - stored < IDLE_TIMEOUT_MS ? stored : now
    lastActivityRef.current = start
    lastWriteRef.current = now
    writeStoredActivity(userId, start)
    setRemainingMs(Math.max(0, IDLE_TIMEOUT_MS - (now - start)))

    const onActivity = () => touch(true)
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, onActivity, { capture: true, passive: true })
    })

    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey(userId) || !e.newValue) return
      const n = Number(e.newValue)
      if (!Number.isFinite(n)) return
      lastActivityRef.current = n
    }
    window.addEventListener('storage', onStorage)

    const tick = window.setInterval(() => {
      const left = IDLE_TIMEOUT_MS - (Date.now() - lastActivityRef.current)
      setRemainingMs(Math.max(0, left))
      if (left > 0 || expiredRef.current) return
      expiredRef.current = true
      clearIdleActivity(userId)
      void onExpireRef.current()
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, onActivity, { capture: true })
      })
      window.removeEventListener('storage', onStorage)
      window.clearInterval(tick)
    }
  }, [enabled, userId, touch])

  return {
    displayName,
    remainingMs,
    showChip: enabled && remainingMs > 0 && remainingMs <= IDLE_CHIP_MS,
    showModal: enabled && remainingMs > 0 && remainingMs <= IDLE_MODAL_MS,
    stayLoggedIn: () => touch(true),
  }
}
