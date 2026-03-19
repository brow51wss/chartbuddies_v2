import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import AppHeader from '../../components/AppHeader'
import { getCurrentUserProfile, signOut } from '../../lib/auth'
import type { UserProfile } from '../../types/auth'

const MODULE_INFO: Record<string, { name: string; price: string }> = {
  mar: {
    name: 'Medication Administration Record',
    price: '$29.99/month'
  },
  progress_notes: {
    name: 'Progress Notes',
    price: '$19.99/month'
  }
}

export default function BillingUpgradePage() {
  const router = useRouter()
  const { module: moduleId } = router.query
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)
      setLoading(false)
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const info = typeof moduleId === 'string' ? MODULE_INFO[moduleId] : null
  const moduleName = info?.name ?? (typeof moduleId === 'string' ? moduleId : 'this module')
  const price = info?.price ?? ''

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Subscribe – {moduleName}</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader userProfile={userProfile} onLogout={handleLogout} />

        <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link
            href="/billing"
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-6"
          >
            ← Back to Billing
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {moduleName} is not active for your facility
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Start a 30-day free trial (card required) or subscribe to get access. You’ll be charged {price} at the end of the trial unless you cancel.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/billing"
                className="px-5 py-2.5 bg-lasso-teal text-white rounded-lg font-medium hover:bg-lasso-blue"
              >
                Start 30-day trial
              </Link>
              <Link
                href="/billing"
                className="px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Subscribe now
              </Link>
            </div>

            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Both options will take you to the billing page where you can add a payment method. Trial and checkout will be wired to Stripe in the next step.
            </p>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
