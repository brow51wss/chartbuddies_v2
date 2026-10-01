import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getCurrentUserProfile } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { isFacilityPcg, isPlatformAdmin } from '../lib/facilityBilling'
import type { UserProfile } from '../types/auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Array<'superadmin' | 'head_nurse' | 'nurse'>
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const profile = await getCurrentUserProfile()
        if (!profile) {
          window.location.replace('/auth/login')
          return
        }
        if (allowedRoles && !allowedRoles.includes(profile.role)) {
          window.location.replace('/dashboard')
          return
        }
        // All users must complete signature/initials setup before accessing the app
        const onOnboardingPage = router.pathname === '/onboarding'
        const onBillingPage = router.pathname === '/billing'
        if (!onOnboardingPage && !onBillingPage && (!profile.staff_signature || !profile.staff_initials)) {
          window.location.replace('/onboarding')
          return
        }
        if (!onBillingPage && !isPlatformAdmin(profile) && profile.hospital_id) {
          const billingRedirect = isFacilityPcg(profile) ? '/billing' : '/auth/staff-login?reason=billing'
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.access_token) {
            window.location.replace(billingRedirect)
            return
          }

          const checkAccess = async () => {
            try {
              const accessRes = await fetch('/api/billing/access', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
              const access = await accessRes.json().catch(() => ({ allowed: false }))
              return accessRes.ok && access.allowed === true
            } catch {
              return false
            }
          }

          let allowed = await checkAccess()
          if (!allowed) allowed = await checkAccess()
          if (!allowed) {
            window.location.replace(billingRedirect)
            return
          }
        }
        setUserProfile(profile)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router.pathname, allowedRoles])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!userProfile) {
    return null
  }

  return <>{children}</>
}

