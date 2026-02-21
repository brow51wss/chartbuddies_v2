import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import { getCurrentUserProfile } from '../lib/auth'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const profile = await getCurrentUserProfile()
      if (profile) {
        router.push('/dashboard')
        return
      }
      setChecking(false)
    }
    checkAuth()
  }, [router])

  if (checking) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-navy mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </main>
    )
  }

  return (
    <>
      <Head>
        <title>Lasso | Medication Administration, Simplified</title>
        <meta name="description" content="Simplify Medication Administration Records for every nurse on shift. Lasso replaces clunky charts with an intuitive digital MAR." />
      </Head>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <Link href="/" className="flex items-center">
              <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-10 w-auto" />
            </Link>
            <nav className="flex items-center gap-4">
              <a href="#features" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-lasso-teal dark:hover:text-lasso-blue">Features</a>
              <a href="#workflow" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-lasso-teal dark:hover:text-lasso-blue">Workflow</a>
              <a href="#security" className="text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-lasso-teal dark:hover:text-lasso-blue">Security</a>
              <Link
                href="/auth/login"
                className="px-4 py-2 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue text-sm font-medium shadow-md transition-all duration-200"
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </header>

        {/* Hero */}
        <section className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
              Simplify Medication Administration Records for every nurse on shift.
            </h1>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Lasso replaces clunky charts with an intuitive digital MAR that keeps your team compliant, in sync, and confident with every dose.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/auth/signup"
                className="px-6 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue font-medium shadow-lg transition-all duration-200"
              >
                Get Started
              </Link>
              <a
                href="#workflow"
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium transition-colors"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              <div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">45%</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">faster documentation</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">99.9%</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">med-administration accuracy</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">HIPAA</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">compliant platform</p>
              </div>
            </div>
          </div>
        </section>

        {/* The old way vs Lasso */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">The old way is broken</h2>
                <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
                  <li>• Paper binders take time, invite errors, and go missing.</li>
                  <li>• Night shift inherits incomplete MARs with no context.</li>
                  <li>• Audits trigger scramble-mode, not readiness.</li>
                </ul>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lasso keeps nurses in control</h2>
                <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
                  <li>• Pre-loaded medication schedules matched to each patient.</li>
                  <li>• One-tap documentation captures time, dose, and signature.</li>
                  <li>• Real-time alerts keep the whole care team aligned.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
              Everything you need to deliver safer care
            </h2>
            <div className="mt-12 grid sm:grid-cols-3 gap-8">
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-semibold text-lasso-navy dark:text-lasso-teal">Smart Scheduling</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Auto-generate MAR schedules from your EHR or medication list. Lasso flags conflicts and suggests the safest cadence.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-semibold text-lasso-navy dark:text-lasso-teal">One-Tap Documentation</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Record dose, route, and patient confirmation in seconds—no more handwriting, scanning, or double entry.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-semibold text-lasso-navy dark:text-lasso-teal">Real-Time Alerts</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Stay ahead of missed doses, PRN requests, and medication changes with smart alerts that reach the right team members instantly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section id="workflow" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
              How Lasso fits into your shift
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">1.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Review & prep</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Start every shift with an accurate, prioritized medication list synced from your system of record.
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">2.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Administer confidently</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Guided workflows capture dose, route, and vitals while keeping the patient at the center.
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">3.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Document instantly</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Tap once to log administration, capture signatures, and update the patient profile in real time.
                </p>
              </div>
              <div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">4.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Audit ready records</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Lasso packages clean, exportable MARs with full traceability for surveyors and compliance teams.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <blockquote className="text-xl text-gray-700 dark:text-gray-300 italic">
              &ldquo;Lasso has cut our medication documentation time in half. My team leaves on time, patients get the right care, and I sleep better knowing our MARs are always audit-ready.&rdquo;
            </blockquote>
            <p className="mt-4 font-medium text-gray-900 dark:text-white">— Priya S., Director of Nursing</p>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-4">
              Built for compliance from day one
            </h2>
            <p className="text-center text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Lasso uses secure, HIPAA-ready infrastructure with role-based access, audit trails, and encryption at rest and in transit.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm font-medium text-gray-900 dark:text-white">HIPAA-ready architecture</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Single sign-on support</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm font-medium text-gray-900 dark:text-white">24/7 monitoring & uptime</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Dedicated onboarding team</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              Ready to simplify your MAR workflow?
            </h2>
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              See how Lasso transforms medication administration for your nurses.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/auth/signup"
                className="px-6 py-3 bg-gradient-to-r from-lasso-navy to-lasso-teal text-white rounded-lg hover:from-lasso-teal hover:to-lasso-blue font-medium shadow-lg transition-all duration-200"
              >
                Get Started
              </Link>
              <Link
                href="/auth/login"
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
              >
                Log in
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center">
              <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-8 w-auto" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Medication Administration Records made effortless.
            </p>
            <nav className="flex gap-6 text-sm">
              <a href="#features" className="text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-blue">Features</a>
              <a href="#workflow" className="text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-blue">Workflow</a>
              <a href="#security" className="text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-blue">Security</a>
              <Link href="/auth/login" className="text-gray-600 dark:text-gray-400 hover:text-lasso-teal dark:hover:text-lasso-blue">Log in</Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-500">
            © Lasso Health. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  )
}
