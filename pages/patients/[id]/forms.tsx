import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../../../components/ProtectedRoute'
import { supabase } from '../../../lib/supabase'
import { getCurrentUserProfile } from '../../../lib/auth'
import type { Patient } from '../../../types/auth'
import type { MARForm } from '../../../types/mar'

export default function PatientForms() {
  const router = useRouter()
  const { id } = router.query
  const [patient, setPatient] = useState<Patient | null>(null)
  const [marForms, setMarForms] = useState<MARForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadPatientData(id as string)
    }
  }, [id])

  const loadPatientData = async (patientId: string) => {
    try {
      // Load patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single()

      if (patientError) throw patientError
      setPatient(patientData)

      // Load MAR forms for this patient
      const { data: formsData, error: formsError } = await supabase
        .from('mar_forms')
        .select('*')
        .eq('patient_id', patientId)
        .order('month_year', { ascending: false })

      if (formsError) throw formsError
      setMarForms(formsData || [])

      setLoading(false)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Patient Forms - Lasso</title>
      </Head>
      <div className="min-h-screen">
        <header className="bg-white dark:bg-gray-800 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <Link href="/dashboard" className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm mb-2 inline-block">
                  ← Back to Dashboard
                </Link>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {patient?.patient_name || 'Patient Forms'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Record #: {patient?.record_number}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
              Available Forms
            </h2>

            {/* MAR Forms Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-800 dark:text-white">
                  Medication Administration Record (MAR)
                </h3>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create and manage MAR forms for this patient
                  </p>
                  <Link
                    href={`/patients/${id}/mar`}
                    className="px-4 py-2 bg-lasso-navy text-white rounded-md hover:bg-lasso-teal text-sm font-medium"
                  >
                    + New MAR Form
                  </Link>
                </div>

                {marForms.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm italic">
                    No MAR forms created yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {marForms.map((form) => (
                      <div
                        key={form.id}
                        className="flex justify-between items-center p-4 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <div>
                          <p className="font-medium text-gray-800 dark:text-white">
                            MAR - {form.month_year}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Status: {form.status} • Created: {new Date(form.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Link
                          href={`/patients/${id}/mar/${form.id}`}
                          className="px-4 py-2 text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue text-sm font-medium"
                        >
                          {form.status === 'draft' ? 'Continue Editing' : 'View'}
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Placeholder for future forms */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Additional form types will be available here (custom forms, vital signs, etc.)
              </p>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

