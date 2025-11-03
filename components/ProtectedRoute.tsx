import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { getCurrentUserProfile } from '../lib/auth'
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
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)
      setLoading(false)
    }
    checkAuth()
  }, [router, allowedRoles])

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

