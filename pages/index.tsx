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
            <div className="mt-12 max-w-2xl mx-auto">
              <img src="/images/hero-illustration.png" alt="Digital MAR workflow" className="w-full h-auto rounded-xl shadow-lg" />
            </div>
            <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3" aria-hidden>
                  <svg className="w-6 h-6 text-lasso-teal dark:text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">Faster</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">documentation</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3" aria-hidden>
                  <svg className="w-6 h-6 text-lasso-teal dark:text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">Accurate</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">med-administration tracking</p>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3" aria-hidden>
                  <svg className="w-6 h-6 text-lasso-teal dark:text-lasso-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-3xl font-bold text-lasso-teal dark:text-lasso-blue">HIPAA</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">compliant platform</p>
              </div>
            </div>
          </div>
        </section>

        {/* The old way vs Lasso */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 border-y border-gray-200 dark:border-gray-700">
          <div className="max-w-6xl mx-auto">
            <div className="mb-12 max-w-3xl mx-auto">
              <img src="/images/old-way-vs-digital.png" alt="Paper charts vs digital MAR" className="w-full h-auto rounded-xl shadow-md" />
            </div>
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3 text-red-600 dark:text-red-400" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">The old way is broken</h2>
                <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
                  <li>• Paper binders take time, invite errors, and go missing.</li>
                  <li>• Night shift inherits incomplete MARs with no context.</li>
                  <li>• Audits trigger scramble-mode, not readiness.</li>
                </ul>
              </div>
              <div>
                <div className="w-10 h-10 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
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
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-4 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-lasso-navy dark:text-lasso-teal">Smart Scheduling</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Auto-generate MAR schedules from your EHR or medication list. Lasso flags conflicts and suggests the safest cadence.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-4 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-lasso-navy dark:text-lasso-teal">One-Tap Documentation</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Record dose, route, and patient confirmation in seconds—no more handwriting, scanning, or double entry.
                </p>
              </div>
              <div className="p-6 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-4 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </div>
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
            <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
              How Lasso fits into your shift
            </h2>
            <div className="mb-12 max-w-2xl mx-auto">
              <img src="/images/workflow-tablet.png" alt="Digital MAR workflow on tablet" className="w-full h-auto rounded-xl shadow-md" />
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div>
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">1.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Review & prep</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Start every shift with an accurate, prioritized medication list synced from your system of record.
                </p>
              </div>
              <div>
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">2.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Administer confidently</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Guided workflows capture dose, route, and vitals while keeping the patient at the center.
                </p>
              </div>
              <div>
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <p className="text-2xl font-bold text-lasso-teal dark:text-lasso-blue">3.</p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-2">Document instantly</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 text-sm">
                  Tap once to log administration, capture signatures, and update the patient profile in real time.
                </p>
              </div>
              <div>
                <div className="w-11 h-11 rounded-lg bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mb-3 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
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
            <div className="w-12 h-12 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mx-auto mb-4 text-lasso-teal dark:text-lasso-blue" aria-hidden>
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" /></svg>
            </div>
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
            <div className="mb-8 max-w-md mx-auto">
              <img src="/images/security-trust.png" alt="HIPAA and security compliance" className="w-full h-auto rounded-xl shadow-md" />
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Lasso uses secure, HIPAA-ready infrastructure with role-based access, audit trails, and encryption at rest and in transit.
            </p>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mx-auto mb-2 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">HIPAA-ready architecture</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mx-auto mb-2 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Single sign-on support</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mx-auto mb-2 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">24/7 monitoring & uptime</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <div className="w-10 h-10 rounded-full bg-lasso-teal/10 dark:bg-lasso-blue/20 flex items-center justify-center mx-auto mb-2 text-lasso-teal dark:text-lasso-blue" aria-hidden>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
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
