import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import type { UserProfile } from '../types/auth'

interface Lead {
  id: string
  full_name: string
  email: string
  phone: string
  facility: string | null
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function exportCSV(leads: Lead[]) {
  const header = ['Full Name', 'Email', 'Phone', 'Facility', 'Submitted At']
  const rows = leads.map((l) => [
    `"${l.full_name}"`,
    `"${l.email}"`,
    `"${l.phone}"`,
    `"${l.facility ?? ''}"`,
    `"${formatDate(l.created_at)}"`,
  ])
  const csv = [header, ...rows].map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `early-access-leads-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function EarlyAccessLeadsPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }
      if (profile.role !== 'superadmin') {
        router.push('/dashboard')
        return
      }
      setUserProfile(profile)

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('No session')

        const res = await fetch('/api/early-access-leads', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch leads')
        setLeads(json.leads)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load leads')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  return (
    <ProtectedRoute>
      <Head>
        <title>Early Access Leads — Lasso</title>
      </Head>
      <AppHeader userProfile={userProfile} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-lasso-navy dark:text-white">Early Access Leads</h1>
            {!loading && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {leads.length} {leads.length === 1 ? 'registration' : 'registrations'} from the event QR code
              </p>
            )}
          </div>
          {leads.length > 0 && (
            <button
              onClick={() => exportCSV(leads)}
              className="flex items-center gap-2 px-4 py-2 bg-lasso-navy text-white text-sm font-medium rounded-lg hover:bg-lasso-teal transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lasso-navy dark:border-lasso-blue" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && leads.length === 0 && (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No leads yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Registrations from the event QR code will appear here.</p>
          </div>
        )}

        {!loading && !error && leads.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Facility</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {leads.map((lead, idx) => (
                  <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-400 dark:text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{lead.full_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <a href={`mailto:${lead.email}`} className="text-sm text-lasso-teal dark:text-lasso-blue hover:underline">
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <a href={`tel:${lead.phone}`} className="text-sm text-gray-700 dark:text-gray-300 hover:text-lasso-teal">
                        {lead.phone}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {lead.facility || <span className="text-gray-400 dark:text-gray-600 italic">—</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(lead.created_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </ProtectedRoute>
  )
}
