import { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ProtectedRoute from '../components/ProtectedRoute'
import AppShellHeader from '../components/AppShellHeader'
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
  hasStripeCustomer?: boolean
  hasStripeSubscription?: boolean
  stripeConfigured?: boolean
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: string | null
}

function money(cents?: number): string {
  if (typeof cents !== 'number') return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusLabel(status?: string, cancelAtPeriodEnd?: boolean): string {
  if (cancelAtPeriodEnd && status === 'active') return 'Cancels at period end'
  if (status === 'trialing') return 'Free trial'
  if (status === 'active') return 'Active'
  if (status === 'past_due') return 'Past due'
  if (status === 'canceled') return 'Canceled'
  return status || '—'
}

function statusClasses(status?: string, cancelAtPeriodEnd?: boolean): string {
  if (cancelAtPeriodEnd) return 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
  if (status === 'trialing') return 'bg-teal-50 text-lasso-teal dark:bg-teal-900/30 dark:text-teal-200'
  if (status === 'active') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
  if (status === 'past_due') return 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
  return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
}

export default function BillingPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [facilityName, setFacilityName] = useState('')
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [confirmSeat, setConfirmSeat] = useState(false)

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
      if (profile.hospital_id) {
        const { data: hospital } = await supabase
          .from('hospitals')
          .select('name')
          .eq('id', profile.hospital_id)
          .single()
        setFacilityName(hospital?.name ?? '')
      }
      try {
        await load(profile)
      } catch {
        setError('Failed to load billing')
      }
    }
    start()
  }, [])

  useEffect(() => {
    if (!router.isReady) return
    if (router.query.checkout === 'success') {
      setNotice('Payment received. Stripe may take a few seconds to update this page.')
    } else if (router.query.checkout === 'canceled') {
      setNotice('Checkout was closed. Your trial is unchanged.')
    }
  }, [router.isReady, router.query.checkout])

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
      if (path === '/api/billing/add-seat') {
        setConfirmSeat(false)
        setNotice('Nurse seat added. Stripe will prorate this period.')
      }
      if (path === '/api/billing/cancel') {
        setConfirmCancel(false)
        setNotice(
          json.immediate
            ? 'This facility plan is canceled. Subscribe again to restore access.'
            : json.undo
              ? 'Cancellation undone. Billing continues as usual.'
              : 'Cancellation scheduled. Access continues until the end of the current period.'
        )
      }
      if (userProfile) await load(userProfile)
    } catch {
      setError('Request failed')
    } finally {
      setBusy('')
    }
  }

  const canPay = Boolean(userProfile && isFacilityPcg(userProfile))
  const seatUsed = status?.nurseSeatsUsed ?? 0
  const seatAllowed = Math.max(1, status?.nurseSeatsAllowed ?? 2)
  const seatPct = Math.min(100, Math.round((seatUsed / seatAllowed) * 100))
  const monthlyTotal =
    (status?.facilityPriceCents || 0) + (status?.extraNurseSeats || 0) * (status?.extraNursePriceCents || 0)
  const canCancel = Boolean(
    canPay && status && status.status !== 'canceled' && !status.unconfigured && !status.platform
  )
  const canUndoCancel = Boolean(canPay && status?.hasStripeSubscription && status.cancelAtPeriodEnd)

  return (
    <ProtectedRoute>
      <Head>
        <title>Billing | Lasso EHR</title>
      </Head>
      <div className="min-h-screen bg-[#f4f7f7] dark:bg-gray-900">
        <AppShellHeader userProfile={userProfile} facilityName={facilityName} />
        <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-gray-400 mb-1">Account</p>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Billing</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {facilityName ? `${facilityName} · ` : ''}One PCG pays. Cards are entered on Stripe — Lasso never stores card numbers.
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-800 dark:text-red-200 text-sm font-medium">{error}</p>
            </div>
          )}
          {notice && !error && (
            <div className="p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl">
              <p className="text-lasso-navy dark:text-teal-200 text-sm">{notice}</p>
            </div>
          )}

          {!status ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : status.platform ? (
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">Platform admins are not billed.</p>
            </section>
          ) : status.unconfigured ? (
            <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Billing tables are not applied yet. Run Supabase migration 076, then refresh.
              </p>
            </section>
          ) : (
            <>
              {status.status === 'trialing' && !status.hasStripeSubscription && (
                <section className="bg-white dark:bg-gray-800 border border-lasso-teal/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm font-extrabold text-gray-900 dark:text-white">
                      {status.trialDaysRemaining ?? 0} day{(status.trialDaysRemaining || 0) === 1 ? '' : 's'} left in your trial
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Trial ends {formatDate(status.trialEndsAt)}. Subscribe to keep the facility and 2 included nurse seats.
                    </p>
                  </div>
                  {canPay && (
                    <button
                      type="button"
                      disabled={Boolean(busy) || !status.stripeConfigured}
                      onClick={() => post('/api/billing/checkout', { extraNurseSeats: status.extraNurseSeats || 0 })}
                      className="flex-shrink-0 px-4 py-2.5 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
                    >
                      {busy === '/api/billing/checkout' ? 'Opening Stripe…' : `Subscribe ${money(status.facilityPriceCents)}/mo`}
                    </button>
                  )}
                </section>
              )}

              <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-400">Current plan</h2>
                    <p className="text-xl font-extrabold text-gray-900 dark:text-white mt-1">Lasso Facility</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusClasses(status.status, status.cancelAtPeriodEnd)}`}>
                    {statusLabel(status.status, status.cancelAtPeriodEnd)}
                  </span>
                </div>
                <dl className="grid sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-400">Facility</dt>
                    <dd className="font-bold text-gray-900 dark:text-white mt-0.5">{money(status.facilityPriceCents)} / month</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">Estimated total</dt>
                    <dd className="font-bold text-gray-900 dark:text-white mt-0.5">{money(monthlyTotal)} / month</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">
                      {status.status === 'trialing' && !status.hasStripeSubscription ? 'Trial ends' : 'Current period ends'}
                    </dt>
                    <dd className="font-bold text-gray-900 dark:text-white mt-0.5">
                      {status.hasStripeSubscription ? formatDate(status.currentPeriodEnd) : formatDate(status.trialEndsAt)}
                    </dd>
                  </div>
                </dl>
                {status.cancelAtPeriodEnd && (
                  <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
                    Cancellation is scheduled. Access continues through {formatDate(status.currentPeriodEnd)}. Extra nurses stay greyed out after that.
                  </p>
                )}
                {canPay && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {!status.hasStripeSubscription && status.status !== 'canceled' && (
                      <button
                        type="button"
                        disabled={Boolean(busy) || !status.stripeConfigured}
                        onClick={() => post('/api/billing/checkout', { extraNurseSeats: status.extraNurseSeats || 0 })}
                        className="px-4 py-2.5 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
                      >
                        {busy === '/api/billing/checkout' ? 'Opening Stripe…' : `Subscribe ${money(status.facilityPriceCents)} / month`}
                      </button>
                    )}
                    {status.status === 'canceled' && (
                      <button
                        type="button"
                        disabled={Boolean(busy) || !status.stripeConfigured}
                        onClick={() => post('/api/billing/checkout', { extraNurseSeats: 0 })}
                        className="px-4 py-2.5 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
                      >
                        {busy === '/api/billing/checkout' ? 'Opening Stripe…' : 'Resubscribe'}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-400">Nurse seats</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      2 included. Extra seats are {money(status.extraNursePriceCents)} each per month.
                    </p>
                  </div>
                  <Link href="/facility-users" className="text-sm font-bold text-lasso-teal hover:underline">
                    Manage caregivers
                  </Link>
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{seatUsed}</span>
                  <span className="text-sm text-gray-400">of {seatAllowed} used</span>
                  {Boolean(status.extraNurseSeats) && (
                    <span className="text-xs font-bold text-gray-500">({status.extraNurseSeats} extra paid)</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden mb-4">
                  <div className="h-full bg-lasso-teal rounded-full" style={{ width: `${seatPct}%` }} />
                </div>
                {canPay && status.status !== 'canceled' && (
                  <button
                    type="button"
                    disabled={Boolean(busy) || !status.stripeConfigured}
                    onClick={() => setConfirmSeat(true)}
                    className="px-4 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50"
                  >
                    {busy === '/api/billing/add-seat' ? 'Adding…' : `Add nurse seat ${money(status.extraNursePriceCents)} / month`}
                  </button>
                )}
              </section>

              <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-400 mb-2">Payment method</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Card numbers stay in Stripe. Use the customer portal to update the card, billing email, or address.
                </p>
                {canPay && (status.hasStripeCustomer || status.hasStripeSubscription) ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => post('/api/billing/portal')}
                    className="px-4 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50"
                  >
                    {busy === '/api/billing/portal' ? 'Opening…' : 'Update payment method'}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">No card on file yet. A card is collected when you subscribe.</p>
                )}
              </section>

              <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-400 mb-2">Invoices & receipts</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Past invoices, PDFs, and tax receipts are in Stripe. We do not store them here.
                </p>
                {canPay && (status.hasStripeCustomer || status.hasStripeSubscription) ? (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => post('/api/billing/portal')}
                    className="px-4 py-2.5 text-sm font-bold border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200 rounded-xl disabled:opacity-50"
                  >
                    {busy === '/api/billing/portal' ? 'Opening…' : 'View invoices'}
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">Invoices appear after the first paid subscription.</p>
                )}
              </section>

              {canPay && (canCancel || canUndoCancel) && (
                <section className="bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900/50 rounded-2xl p-6">
                  <h2 className="text-sm font-extrabold uppercase tracking-wide text-red-400 mb-2">Cancel plan</h2>
                  {canUndoCancel ? (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        This plan is set to cancel on {formatDate(status.currentPeriodEnd)}. You can keep it.
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => post('/api/billing/cancel', { undo: true })}
                        className="px-4 py-2.5 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
                      >
                        {busy === '/api/billing/cancel' ? 'Saving…' : 'Keep subscription'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                        {status.hasStripeSubscription
                          ? 'Cancel at the end of the current period. The facility stays open until then. After that, nurses cannot clock in until you resubscribe.'
                          : 'End the trial now. The facility will lose access immediately. You can subscribe later from this page.'}
                      </p>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => setConfirmCancel(true)}
                        className="px-4 py-2.5 text-sm font-bold border border-red-300 text-red-700 dark:text-red-300 dark:border-red-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                      >
                        {status.hasStripeSubscription ? 'Cancel subscription' : 'End trial'}
                      </button>
                    </>
                  )}
                </section>
              )}

              {!status.stripeConfigured && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Stripe keys and price IDs are not set in the server environment yet. Seat and trial rules still apply; checkout stays disabled until they are.
                </p>
              )}
            </>
          )}
        </main>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
              {status?.hasStripeSubscription ? 'Cancel subscription?' : 'End trial?'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {status?.hasStripeSubscription
                ? `Access continues until ${formatDate(status.currentPeriodEnd)}. After that, this facility is locked until you resubscribe. Cards stay in Stripe.`
                : 'Access for this facility ends now. Nurses will not be able to clock in. You can subscribe again later.'}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={Boolean(busy)}
                className="px-4 py-2 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200"
              >
                Keep plan
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/api/billing/cancel')}
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50"
              >
                {busy === '/api/billing/cancel' ? 'Canceling…' : 'Confirm cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmSeat && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 px-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">Add a nurse seat?</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              {status?.hasStripeSubscription
                ? `Add a nurse seat for ${money(status?.extraNursePriceCents)}/month? Stripe will prorate this period.`
                : `You're still on a trial. Confirming opens Stripe Checkout for ${money(status?.facilityPriceCents)}/month plus ${money(status?.extraNursePriceCents)} per extra seat.`}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setConfirmSeat(false)}
                disabled={Boolean(busy)}
                className="px-4 py-2 text-sm font-bold border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => post('/api/billing/add-seat')}
                className="px-4 py-2 text-sm font-bold bg-lasso-teal hover:bg-lasso-navy text-white rounded-xl disabled:opacity-50"
              >
                {busy === '/api/billing/add-seat' ? 'Adding…' : 'Confirm add seat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}
