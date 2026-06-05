import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'lasso-cookie-consent'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY)
      if (!accepted) setVisible(true)
    } catch {
      // localStorage unavailable — skip banner
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'accepted')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-gray-600 leading-relaxed max-w-2xl">
          We use essential browser storage (local storage) to keep you signed in and save your preferences.
          We do not use advertising or tracking cookies.{' '}
          <Link href="/privacy" className="text-lasso-teal hover:underline font-medium">
            Learn more
          </Link>
          .
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-lasso-teal whitespace-nowrap">
            Privacy Policy
          </Link>
          <button
            onClick={accept}
            className="px-5 py-2 bg-lasso-navy text-white text-sm font-semibold rounded-lg hover:bg-lasso-teal transition-colors whitespace-nowrap"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
