import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../../components/ProtectedRoute'
import AppHeader from '../../../../components/AppHeader'
import { supabase } from '../../../../lib/supabase'
import { useReadOnly } from '../../../../contexts/ReadOnlyContext'
import type { Patient } from '../../../../types/auth'

/** Progress Notes landing: list months (from MARs) so user can open notes for a given month or add new. */
export default function ProgressNotesIndex() {
  const router = useRouter()
  const { id: patientId } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [monthYears, setMonthYears] = useState<{ month_year: string; id: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const { isReadOnly } = useReadOnly()

  useEffect(() => {
    if (!patientId || typeof patientId !== 'string') return
    const load = async () => {
      try {
        const { data: patientData, error: patientError } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single()
        if (patientError || !patientData) {
          setError('Patient not found')
          setLoading(false)
          return
        }
        setPatient(patientData)

        const { data: forms, error: formsError } = await supabase
          .from('mar_forms')
          .select('id, month_year')
          .eq('patient_id', patientId)
          .order('month_year', { ascending: false })

        if (formsError) {
          setMonthYears([])
        } else {
          const sorted = (forms || []).slice().sort((a, b) => {
            const key = (my: string) => {
              const raw = String(my || '').trim().replace(/\//g, '-')
              const parts = raw.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
              let y = parts[0], m = parts[1]
              if (parts.length >= 2 && m > 12) [y, m] = [m, y]
              if (y && m) return y * 12 + m
              const months: Record<string, number> = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 }
              const lower = raw.toLowerCase()
              for (const [name, num] of Object.entries(months)) {
                if (lower.includes(name)) {
                  const match = raw.match(/\b(19|20)\d{2}\b/)
                  return (match ? parseInt(match[0], 10) : new Date().getFullYear()) * 12 + num
                }
              }
              return 0
            }
            return key(b.month_year) - key(a.month_year)
          })
          setMonthYears(sorted)
        }
      } catch (e: any) {
        setError(e.message || 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal mx-auto" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (error || !patient) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400">{error || 'Patient not found'}</p>
            <Link href="/dashboard?module=progress" className="mt-4 inline-block text-lasso-teal">← Back to Progress Notes</Link>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Progress Notes - {patient.patient_name}</title>
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <AppHeader
          patientId={typeof patientId === 'string' ? patientId : Array.isArray(patientId) ? patientId[0] : undefined}
          patientName={patient.patient_name}
        />

        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            href={patientId ? `/patients/${patientId}` : '/dashboard'}
            className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium inline-block mb-2"
          >
            ← Back to Patient's Binder
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 mb-2">
            {patient.patient_name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Record #: {patient.record_number}
          </p>

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span aria-hidden="true">📝</span>
              <span>Available Progress Notes</span>
            </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {monthYears.length === 0 ? (
                <div className="px-6 py-8">
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic mb-4">
                    No MAR forms yet. Create a MAR for this patient first to see progress notes by month.
                  </p>
                  <Link
                    href={`/patients/${patientId}/progress-notes/view`}
                    className="inline-block px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue"
                  >
                    {isReadOnly ? 'View all notes' : 'View all notes / Add note'}
                  </Link>
                </div>
              ) : (
                monthYears.map(({ month_year, id }) => (
                  <div
                    key={id}
                    className="flex justify-between items-center px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <span className="font-medium text-gray-800 dark:text-white">{month_year}</span>
                    <Link
                      href={`/patients/${patientId}/progress-notes/view?month=${encodeURIComponent(month_year)}`}
                      className="px-4 py-2 bg-lasso-teal text-white rounded-lg text-sm font-medium hover:bg-lasso-blue"
                    >
                      {isReadOnly ? 'View notes' : 'View / Add notes'}
                    </Link>
                  </div>
                ))
              )}
            </div>
            {monthYears.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                <Link
                  href={`/patients/${patientId}/progress-notes/view`}
                  className="inline-block px-4 py-2 bg-lasso-navy text-white rounded-lg text-sm font-medium hover:bg-lasso-teal"
                >
                  Open current month (all notes)
                </Link>
              </div>
            )}
          </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}
