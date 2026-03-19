import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../components/ProtectedRoute'
import AppHeader from '../../components/AppHeader'
import { getCurrentUserProfile, signOut } from '../../lib/auth'
import type { UserProfile } from '../../types/auth'

/** Subscription status per module (for admin list) */
type SubStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'none'

interface FacilitySubscriptionRow {
  hospitalId: string
  facilityName: string
  stripeCustomerId: string | null
  mar: { status: SubStatus; periodEnd: string | null; trialEnd: string | null }
  progress_notes: { status: SubStatus; periodEnd: string | null; trialEnd: string | null }
}

// Placeholder data – replace with real data from DB/Stripe
const MOCK_FACILITIES: FacilitySubscriptionRow[] = [
  {
    hospitalId: 'h1',
    facilityName: 'Sunrise Care Home',
    stripeCustomerId: 'cus_placeholder1',
    mar: { status: 'active', periodEnd: '2026-04-21', trialEnd: null },
    progress_notes: { status: 'trialing', periodEnd: '2026-04-21', trialEnd: '2026-04-05' }
  },
  {
    hospitalId: 'h2',
    facilityName: 'Maple Grove Facility',
    stripeCustomerId: 'cus_placeholder2',
    mar: { status: 'none', periodEnd: null, trialEnd: null },
    progress_notes: { status: 'active', periodEnd: '2026-03-28', trialEnd: null }
  },
  {
    hospitalId: 'h3',
    facilityName: 'Riverside ARCH',
    stripeCustomerId: null,
    mar: { status: 'none', periodEnd: null, trialEnd: null },
    progress_notes: { status: 'none', periodEnd: null, trialEnd: null }
  }
]

const statusLabel: Record<SubStatus, string> = {
  trialing: 'Trialing',
  active: 'Active',
  past_due: 'Past due',
  canceled: 'Canceled',
  none: '—'
}

const statusColor: Record<SubStatus, string> = {
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  past_due: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  canceled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  none: 'text-gray-400 dark:text-gray-500'
}

export default function AdminSubscriptionsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<FacilitySubscriptionRow[]>(MOCK_FACILITIES)
  const [filterStatus, setFilterStatus] = useState<SubStatus | 'all'>('all')
  const [filterModule, setFilterModule] = useState<'all' | 'mar' | 'progress_notes'>('all')

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      // Platform admin: superadmin without hospital_id (or dedicated role)
      const isPlatformAdmin = profile.role === 'superadmin' && !profile.hospital_id
      if (!isPlatformAdmin) {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)
      // TODO: fetch facilities + subscription state from DB
      setRows(MOCK_FACILITIES)
      setLoading(false)
    }
    load()
  }, [router])

  const handleLogout = async () => {
    await signOut()
    router.push('/auth/login')
  }

  const filteredRows = rows.filter((r) => {
    if (filterStatus !== 'all') {
      const marMatch = r.mar.status === filterStatus
      const pnMatch = r.progress_notes.status === filterStatus
      if (filterModule === 'mar' && !marMatch) return false
      if (filterModule === 'progress_notes' && !pnMatch) return false
      if (filterModule === 'all' && !marMatch && !pnMatch) return false
    }
    if (filterModule === 'mar' && r.mar.status === 'none') return false
    if (filterModule === 'progress_notes' && r.progress_notes.status === 'none') return false
    return true
  })

  const handleExport = () => {
    const headers = ['Facility ID', 'Facility Name', 'Stripe Customer', 'MAR Status', 'MAR Period End', 'Progress Notes Status', 'Progress Notes Period End']
    const lines = filteredRows.map((r) =>
      [
        r.hospitalId,
        r.facilityName,
        r.stripeCustomerId ?? '',
        r.mar.status,
        r.mar.periodEnd ?? '',
        r.progress_notes.status,
        r.progress_notes.periodEnd ?? ''
      ].join(',')
    )
    const csv = [headers.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `subscriptions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
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
        <title>Admin – Subscriptions</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader userProfile={userProfile} onLogout={handleLogout} />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href="/dashboard"
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-4"
          >
            ← Back to Dashboard
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Subscriptions (Admin)
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            View active subscribers and subscription state per facility. Platform admin only.
          </p>

          {/* Filters + Export */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Status:</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as SubStatus | 'all')}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="past_due">Past due</option>
                <option value="canceled">Canceled</option>
                <option value="none">None</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Module:</label>
              <select
                value={filterModule}
                onChange={(e) => setFilterModule(e.target.value as 'all' | 'mar' | 'progress_notes')}
                className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-sm dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All</option>
                <option value="mar">MAR</option>
                <option value="progress_notes">Progress Notes</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Export CSV
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Facility</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Stripe Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">MAR</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">MAR period end</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Progress Notes</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">PN period end</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        No facilities match the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => (
                      <tr key={r.hospitalId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{r.facilityName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono">{r.hospitalId}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 font-mono truncate max-w-[120px]" title={r.stripeCustomerId ?? ''}>
                          {r.stripeCustomerId ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor[r.mar.status]}`}>
                            {statusLabel[r.mar.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {r.mar.periodEnd ? new Date(r.mar.periodEnd).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColor[r.progress_notes.status]}`}>
                            {statusLabel[r.progress_notes.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {r.progress_notes.periodEnd ? new Date(r.progress_notes.periodEnd).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <a
                            href="#"
                            className="text-xs text-lasso-teal hover:underline"
                            onClick={(e) => e.preventDefault()}
                            title="View in Stripe Dashboard – will be wired in integration"
                          >
                            View in Stripe
                          </a>
                          {' · '}
                          <button
                            type="button"
                            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            title="Cancel subscription – will be wired in integration"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Data is placeholder. Stripe Customer links and Cancel will call Stripe API once integration is in place.
          </p>
        </main>
      </div>
    </ProtectedRoute>
  )
}
