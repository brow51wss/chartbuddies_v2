import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { getCurrentUserProfile, signOut } from '../lib/auth'
import type { UserProfile } from '../types/auth'

/** Module subscription status for display (will come from DB/Stripe later) */
type ModuleStatus = 'subscribed' | 'trialing' | 'not_subscribed' | 'past_due' | 'canceled'

interface ModuleRow {
  id: string
  name: string
  description: string
  price: string
  status: ModuleStatus
  /** Next billing date (ISO) or trial end */
  periodEnd: string | null
  /** For trial: when trial ends */
  trialEnd: string | null
}

// Placeholder data – replace with real subscription data from API/DB
const MOCK_MODULES: ModuleRow[] = [
  {
    id: 'mar',
    name: 'Medication Administration Record',
    description: 'Track and manage medication administration',
    price: '$29.99/month',
    status: 'not_subscribed',
    periodEnd: null,
    trialEnd: null
  },
  {
    id: 'progress_notes',
    name: 'Progress Notes',
    description: 'Document progress, observations, and clinical notes',
    price: '$19.99/month',
    status: 'not_subscribed',
    periodEnd: null,
    trialEnd: null
  }
]

const statusLabel: Record<ModuleStatus, string> = {
  subscribed: 'Subscribed',
  trialing: 'In trial',
  not_subscribed: 'Not subscribed',
  past_due: 'Past due',
  canceled: 'Canceled'
}

const statusColor: Record<ModuleStatus, string> = {
  subscribed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  not_subscribed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
}

export default function BillingPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [modules, setModules] = useState<ModuleRow[]>(MOCK_MODULES)
  const [facilityName, setFacilityName] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      setUserProfile(profile)

      // Only facility users (with hospital_id) can see billing
      if (!profile.hospital_id) {
        router.push('/dashboard')
        return
      }

      // TODO: fetch hospital name from hospitals table
      setFacilityName('Your Facility')

      // TODO: fetch real subscription state per module for this facility
      setModules(MOCK_MODULES)
      setLoading(false)
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

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
        <title>Billing &amp; Subscriptions</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader userProfile={userProfile} onLogout={handleLogout} />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/dashboard"
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-4"
          >
            ← Back to Dashboard
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            Billing &amp; Subscriptions
          </h1>
          {facilityName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Subscription status for {facilityName}
            </p>
          )}

          {/* Module cards */}
          <div className="space-y-4 mb-8">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm"
              >
                <div className="p-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {mod.name}
                      </h2>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColor[mod.status]}`}
                      >
                        {statusLabel[mod.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {mod.description}
                    </p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {mod.price}
                    </p>
                    {(mod.periodEnd || mod.trialEnd) && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {mod.trialEnd
                          ? `Trial ends ${new Date(mod.trialEnd).toLocaleDateString()}`
                          : mod.periodEnd
                            ? `Next billing: ${new Date(mod.periodEnd).toLocaleDateString()}`
                            : null}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mod.status === 'not_subscribed' && (
                      <>
                        <Link
                          href={`/billing/upgrade?module=${mod.id}`}
                          className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue"
                        >
                          Start 30-day trial
                        </Link>
                        <Link
                          href={`/billing/upgrade?module=${mod.id}`}
                          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Subscribe
                        </Link>
                      </>
                    )}
                    {(mod.status === 'subscribed' || mod.status === 'trialing' || mod.status === 'past_due') && (
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
                        title="Manage (Stripe Customer Portal) – will be wired in integration"
                      >
                        Manage subscription
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Invoices section */}
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Invoices
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                View and download past invoices (Stripe Customer Portal).
              </p>
            </div>
            <div className="p-5">
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-lg text-sm font-medium cursor-not-allowed"
                title="Will open Stripe Customer Portal – wired in integration"
              >
                View invoices
              </button>
            </div>
          </section>

          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
            Billing is per facility. Card required for 30-day trial; you will be charged at the end of the trial unless you cancel.
          </p>
        </main>
      </div>
    </ProtectedRoute>
  )
}
