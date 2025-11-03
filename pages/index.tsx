import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { getCurrentUserProfile } from '../lib/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const profile = await getCurrentUserProfile()
      if (profile) {
        router.push('/dashboard')
      } else {
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [router])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    </main>
  )
}

