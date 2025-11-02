import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

interface AdmissionData {
  id: string
  first_name: string
  middle_name: string | null
  last_name: string
  dob: string
  age: number
  sex: string | null
  date_of_admission: string
}

export default function Dashboard() {
  const router = useRouter()
  const { admission_id } = router.query
  const [admissionData, setAdmissionData] = useState<AdmissionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAdmissionData = async () => {
      if (!admission_id || typeof admission_id !== 'string') {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('admissions')
          .select('*')
          .eq('id', admission_id)
          .single()

        if (error) throw error
        setAdmissionData(data)
      } catch (error) {
        console.error('Error fetching admission data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAdmissionData()
  }, [admission_id])

  const getFullName = () => {
    if (!admissionData) return 'Patient'
    return `${admissionData.first_name} ${admissionData.middle_name || ''} ${admissionData.last_name}`.trim()
  }

  return (
    <>
      <Head>
        <title>Dashboard - MAR</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              EHR Dashboard
            </h1>
            {admissionData && (
              <p className="text-lg text-gray-600 dark:text-gray-300">
                Patient: <span className="font-semibold">{getFullName()}</span>
              </p>
            )}
          </div>

          {/* Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* MAR Module */}
            {admission_id && (
              <Link href={`/mar?admission_id=${admission_id}`}>
                <a className="block group">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                      <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                      Medication Administration Record
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Track medication administration, vital signs, and PRN medications
                    </p>
                  </div>
                </a>
              </Link>
            )}

            {/* Coming Soon Modules */}
            {['Care Plan', 'Progress Notes', 'Laboratory Results', 'Imaging', 'Prescriptions', 'Vitals'].map((module, index) => (
              <div key={module} className="block group opacity-60 cursor-not-allowed">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                    {module}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-500 italic">
                    Coming soon
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="mt-8 flex justify-between items-center">
            <Link href="/">
              <a className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                ← Back to Home
              </a>
            </Link>
            {!loading && !admissionData && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <p className="text-yellow-800 dark:text-yellow-200">
                  ⚠️ No admission data found. Please start from the Admissions form.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

