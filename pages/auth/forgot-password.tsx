import { useRef, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const inFlightRef = useRef(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setError('')
    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/auth/reset-password`
          : process.env.NEXT_PUBLIC_APP_URL
            ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`
            : ''
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectTo || undefined
      })
      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        inFlightRef.current = false
        return
      }
      setSent(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong.')
    }
    setLoading(false)
    inFlightRef.current = false
  }

  return (
    <>
      <Head>
        <title>Forgot Password - Lasso</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-8 text-center">
            <img
              src="/images/full-logo-set.webp"
              alt="Lasso Logo"
              className="h-auto max-w-xs mx-auto"
            />
          </div>
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Forgot password?
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enter your email and we will send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md shadow-sm">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {sent ? (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-md shadow-sm">
              <p className="text-green-800 dark:text-green-200 text-sm">
                Check your email for a link to reset your password. If you do not see it, check your spam folder.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:text-white transition-all duration-200"
                  placeholder="your@email.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:ring-offset-2 font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          )}

          <div className="mt-8 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue dark:hover:text-lasso-blue/80 font-medium"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
