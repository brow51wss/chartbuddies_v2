import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import { isFacilityPcg } from '../lib/facilityBilling'
import type { UserProfile } from '../types/auth'

type BillingStatus = {
  unconfigured?: boolean
  platform?: boolean
  status?: string
  allowed?: boolean
  trialDaysRemaining?: number | null
  trialEndsAt?: string | null
  includedNurseSeats?: number
  extraNurseSeats?: number
  nurseSeatsAllowed?: number
  nurseSeatsUsed?: number
  canAddNurse?: boolean
  facilityPriceCents?: number
  extraNursePriceCents?: number
  hasStripeSubscription?: boolean
  stripeConfigured?: boolean
}

function money(cents?: number): string {
  if (typeof cents !== 'number') return '—'
  return `$${(cents / 100).toFixed(2)}`
}

export default function BillingPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')

  async function load(profile: UserProfile) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setError('Your session expired. Sign in again.')
      return
    }
    const res = await fetch('/api/billing/status', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error || 'Failed to load billing')
      return
    }
    setStatus(json)
  }

  useEffect(() => {
    const start = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) return
      setUserProfile(profile)
      try {
        await load(profile)
      } catch {
        setError('Failed to load billing')
      }
    }
    start()
  }, [])

  async function post(path: string, body?: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      setError('Your session expired. Sign in again.')
      return
    }
    setBusy(path)
    setError('')
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (json.needsPortal) {
          await post('/api/billing/portal')
          return
        }
        if (json.needsCheckout) {
          await post('/api/billing/checkout', { extraNurseSeats: json.extraNurseSeats })
          return
        }
        setError(json.error || 'Request failed')
        return
      }
      if (json.url) {
        window.location.href = json.url
        return
      }
      if (userProfile) await load(userProfile)
    } catch {
      setError('Request failed')
    } finally {
      setBusy('')
    }
  }

  const canPay = Boolean(userProfile && isFacilityPcg(userProfile))

  return (
    <ProtectedRoute>
      <Head>
        <title>Billing | Lasso EHR</title>
      </Head>
      <AppHeader userProfile={userProfile} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-lasso-teal">
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Facility billing</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          One PCG pays for the facility. The free 14-day trial includes 2 nurses; anyone over that is greyed out
          until you add a paid seat. Extra nurses are $4.99 each per month after subscribe.
          Cards are entered on Stripe — Lasso never stores card numbers.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md">
            <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {!status ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : status.platform ? (
          <p className="text-sm text-gray-600">Platform admins are not billed.</p>
        ) : status.unconfigured ? (
          <p className="text-sm text-gray-600">
            Billing tables are not applied yet. Run Supabase migration 076, then refresh.
          </p>
        ) : (
          <div className="space-y-4">
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-400 mb-3">Plan</h2>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-400">Status</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white capitalize">{status.status}</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Facility</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">{money(status.facilityPriceCents)} / month</dd>
                </div>
                <div>
                  <dt className="text-gray-400">Trial days left</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">
                    {status.status === 'trialing' ? status.trialDaysRemaining ?? '—' : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-400">Nurse seats</dt>
                  <dd className="font-semibold text-gray-900 dark:text-white">
                    {status.nurseSeatsUsed} of {status.nurseSeatsAllowed} used
                    {status.extraNurseSeats ? ` (${status.extraNurseSeats} extra)` : ''}
                  </dd>
                </div>
              </dl>
            </section>

            {canPay && (
              <div className="flex flex-col sm:flex-row gap-3">
                {!status.hasStripeSubscription && (
                  <button
                    type="button"
                    disabled={Boolean(busy) || !status.stripeConfigured}
                    onClick={() => post('/api/billing/checkout', { extraNurseSeats: status.extraNurseSeats || 0 })}
                    className="px-4 py-2.5 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
                  >
                    {busy === '/api/billing/checkout' ? 'Opening Stripe…' : `Subscribe ${money(status.facilityPriceCents)} / month`}
                  </button>
                )}
                <button
                  type="button"
                  disabled={Boolean(busy) || !status.stripeConfigured}
                  onClick={() => post('/api/billing/add-seat')}
                  className="px-4 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50"
                >
                  {busy === '/api/billing/add-seat' ? 'Adding…' : `Add nurse seat ${money(status.extraNursePriceCents)} / month`}
                </button>
                {status.hasStripeSubscription && (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => post('/api/billing/portal')}
                    className="px-4 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50"
                  >
                    {busy === '/api/billing/portal' ? 'Opening…' : 'Manage payment method'}
                  </button>
                )}
              </div>
            )}

            {!status.stripeConfigured && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Stripe keys and price IDs are not set in the server environment yet. The seats and trial rules
                still apply; checkout will stay disabled until Jonathan’s Lasso Stripe account is wired.
              </p>
            )}
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}
