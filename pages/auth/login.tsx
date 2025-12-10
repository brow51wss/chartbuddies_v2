import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { getCurrentUserProfile } from '../../lib/auth'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Redirect if already logged in
    const checkSession = async () => {
      const profile = await getCurrentUserProfile()
      if (profile) {
        router.push('/dashboard')
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      // Wait a moment for any triggers to complete
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Try to get profile using function first (bypasses RLS)
      let profile = null
      
      // First, try using the function that bypasses RLS
      const { data: functionProfile, error: functionError } = await supabase
        .rpc('get_user_profile_safe', { p_user_id: data.user.id })
      
      if (!functionError && functionProfile && functionProfile.length > 0) {
        profile = functionProfile[0]
        console.log('Profile found via function')
      } else {
        // Fallback to regular query
        profile = await getCurrentUserProfile()
      }
      
      // If profile still doesn't exist, try to create it
      if (!profile) {
        console.log('Profile not found, attempting to create via function...')
        
        // Try using the database function first (bypasses RLS)
        const { data: profileId, error: createError } = await supabase
          .rpc('create_user_profile_safe', {
            p_user_id: data.user.id,
            p_email: data.user.email!,
            p_full_name: data.user.user_metadata?.full_name || data.user.email || 'User'
          })
        
        if (!createError && profileId) {
          console.log('Profile created, fetching again...')
          // Wait a moment and fetch again
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Try function again
          const { data: newProfile } = await supabase
            .rpc('get_user_profile_safe', { p_user_id: data.user.id })
          
          if (newProfile && newProfile.length > 0) {
            profile = newProfile[0]
          } else {
            profile = await getCurrentUserProfile()
          }
        } else if (createError) {
          // If it's a duplicate key error, profile exists - fetch it
          if (createError.code === '23505' || createError.message?.includes('duplicate')) {
            console.log('Profile already exists, fetching via function...')
            await new Promise(resolve => setTimeout(resolve, 500))
            
            const { data: existingProfile } = await supabase
              .rpc('get_user_profile_safe', { p_user_id: data.user.id })
            
            if (existingProfile && existingProfile.length > 0) {
              profile = existingProfile[0]
            } else {
              profile = await getCurrentUserProfile()
            }
          } else {
            console.error('Failed to create profile:', createError)
          }
        }
      }
      
      if (profile) {
        router.push('/dashboard')
      } else {
        setError('User profile not found. Please contact administrator.')
      }
    }
    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>Login - Lasso</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-8">
          {/* Logo inside the box */}
          <div className="mb-8 text-center">
            <img 
              src="/images/full-logo-set.webp" 
              alt="Lasso Logo" 
              className="h-auto max-w-xs mx-auto"
            />
          </div>
          
          {/* Brand Section */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome Back
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
            Sign in to access your dashboard
          </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md shadow-sm">
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
            </div>
          )}

          {message && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-md shadow-sm">
              <p className="text-green-800 dark:text-green-200 text-sm">{message}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
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
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:border-lasso-teal dark:bg-gray-700 dark:text-white transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue focus:outline-none focus:ring-2 focus:ring-lasso-teal focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-md hover:shadow-lg transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-lasso-blue hover:text-lasso-teal dark:text-lasso-blue dark:hover:text-lasso-blue/80 font-medium transition-colors duration-200">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

