import Head from 'next/head'
import { useState, FormEvent } from 'react'

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
  const [code, setCode] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleUnlock = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/early-access-leads?code=${encodeURIComponent(code.trim())}`)
      const json = await res.json()
      if (!res.ok) {
        setError('Incorrect code. Try again.')
        setLoading(false)
        return
      }
      setLeads(json.leads)
      setUnlocked(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Early Access Leads — Lasso</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-4 flex items-center justify-between">
          <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-9 w-auto" />
          {unlocked && (
            <span className="text-xs font-semibold text-lasso-teal uppercase tracking-widest">Early Access Leads</span>
          )}
        </header>

        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Code gate */}
          {!unlocked && (
            <div className="max-w-sm mx-auto mt-20">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-lasso-teal/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-lasso-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h1 className="text-lg font-bold text-lasso-navy dark:text-white mb-1">Enter Access Code</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Enter the 6-character code to view leads.</p>
                <form onSubmit={handleUnlock} className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="XXXXXX"
                    maxLength={6}
                    className="w-full text-center text-xl font-bold tracking-widest border border-gray-300 dark:border-gray-600 rounded-lg py-3 px-4 bg-white dark:bg-gray-900 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-lasso-teal focus:border-transparent"
                    autoFocus
                    autoCapitalize="characters"
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading || code.trim().length < 6}
                    className="w-full py-3 bg-lasso-navy text-white font-semibold rounded-lg hover:bg-lasso-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Checking…' : 'View Leads'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Leads table */}
          {unlocked && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-lasso-navy dark:text-white">Early Access Leads</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {leads.length} {leads.length === 1 ? 'registration' : 'registrations'}
                  </p>
                </div>
                {leads.length > 0 && (
                  <button
                    onClick={() => exportCSV(leads)}
                    className="flex items-center gap-2 px-4 py-2 bg-lasso-navy text-white text-sm font-semibold rounded-lg hover:bg-lasso-teal transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                  </button>
                )}
              </div>

              {leads.length === 0 ? (
                <div className="text-center py-24 text-gray-400 dark:text-gray-500">
                  <p className="font-medium">No leads yet.</p>
                  <p className="text-sm mt-1">Registrations from the event QR code will appear here.</p>
                </div>
              ) : (
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
                          <td className="px-6 py-4 text-sm text-gray-400">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{lead.full_name}</td>
                          <td className="px-6 py-4">
                            <a href={`mailto:${lead.email}`} className="text-sm text-lasso-teal dark:text-lasso-blue hover:underline">{lead.email}</a>
                          </td>
                          <td className="px-6 py-4">
                            <a href={`tel:${lead.phone}`} className="text-sm text-gray-700 dark:text-gray-300">{lead.phone}</a>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                            {lead.facility || <span className="italic text-gray-400">—</span>}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{formatDate(lead.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  )
}
