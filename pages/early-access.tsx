import Head from 'next/head'
import { useState, FormEvent } from 'react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

const availableFeatures = [
  {
    label: 'Digital MAR',
    desc: 'Full medication schedule — track every dose, time, and nurse initial',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Progress Notes',
    desc: 'Sign and lock clinical notes from any browser — legally compliant',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: 'PRN Tracking',
    desc: 'Log as-needed meds with timestamps, reasons, and outcomes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Vital Signs',
    desc: 'Record vitals directly inside each patient chart',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    ),
  },
  {
    label: 'Patient Profiles',
    desc: 'Diagnoses, allergies, diet, physician, facility — all in one place',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    label: 'HIPAA-Compliant',
    desc: 'PHI in encrypted AWS infrastructure — built to federal standards',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
]

function EarlyAccessForm() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', facility: '' })
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/early-access-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-lasso-navy mb-2">You&apos;re on the list!</h2>
        <p className="text-gray-500 text-sm leading-relaxed">
          We&apos;ll reach out to <strong className="text-gray-700">{form.email}</strong> with your early access details next week.
        </p>
        <p className="text-lasso-teal text-xs mt-4">Thank you for your interest in Lasso.</p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-xl font-extrabold text-lasso-navy mb-1">Get Early Access</h2>
      <p className="text-sm text-gray-500 mb-6 leading-relaxed">
        Be among the first care home teams to use Lasso. We&apos;re onboarding early access users starting next week.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="full_name">
            Full Name <span className="text-red-500">*</span>
          </label>
          <input
            id="full_name" name="full_name" type="text" required
            placeholder="Jane Smith"
            value={form.full_name} onChange={handleChange}
            disabled={state === 'loading'}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lasso-navy/30 focus:border-lasso-navy disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="email">
            Email Address <span className="text-red-500">*</span>
          </label>
          <input
            id="email" name="email" type="email" required
            placeholder="jane@carehome.com"
            value={form.email} onChange={handleChange}
            disabled={state === 'loading'}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lasso-navy/30 focus:border-lasso-navy disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="phone">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <input
            id="phone" name="phone" type="tel" required
            placeholder="(555) 000-0000"
            value={form.phone} onChange={handleChange}
            disabled={state === 'loading'}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lasso-navy/30 focus:border-lasso-navy disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5" htmlFor="facility">
            Facility Name <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="facility" name="facility" type="text"
            placeholder="Sunrise Care Home"
            value={form.facility} onChange={handleChange}
            disabled={state === 'loading'}
            className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-lasso-navy/30 focus:border-lasso-navy disabled:opacity-60"
          />
        </div>

        {state === 'error' && (
          <p className="text-red-500 text-xs text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full mt-1 py-3 bg-lasso-navy hover:bg-lasso-teal text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === 'loading' ? 'Submitting…' : 'Request Early Access'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-4">
        HIPAA-compliant · Your information is never sold or shared.
      </p>
    </>
  )
}

function InvertedEarlyAccessForm() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', facility: '' })
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')
    try {
      const res = await fetch('/api/early-access-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Something went wrong. Please try again.')
        setState('error')
        return
      }
      setState('success')
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-extrabold text-white mb-2">You&apos;re on the list!</h2>
        <p className="text-white/70 text-sm leading-relaxed">
          We&apos;ll reach out to <strong className="text-white">{form.email}</strong> with your early access details next week.
        </p>
        <p className="text-lasso-teal text-xs mt-4">Thank you for your interest in Lasso.</p>
      </div>
    )
  }

  const inputCls = "w-full px-3.5 py-2.5 border border-white/20 rounded-lg text-sm text-white placeholder-white/40 bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/40 disabled:opacity-60"
  const labelCls = "block text-xs font-semibold text-white/80 mb-1.5"

  return (
    <>
      <h2 className="text-xl font-extrabold text-white mb-1">Get Early Access</h2>
      <p className="text-sm text-white/60 mb-6 leading-relaxed">
        Be among the first care home teams to use Lasso. We&apos;re onboarding early access users starting next week.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className={labelCls} htmlFor="inv-full_name">Full Name <span className="text-red-400">*</span></label>
          <input id="inv-full_name" name="full_name" type="text" required placeholder="Jane Smith"
            value={form.full_name} onChange={handleChange} disabled={state === 'loading'} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-email">Email Address <span className="text-red-400">*</span></label>
          <input id="inv-email" name="email" type="email" required placeholder="jane@carehome.com"
            value={form.email} onChange={handleChange} disabled={state === 'loading'} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-phone">Phone Number <span className="text-red-400">*</span></label>
          <input id="inv-phone" name="phone" type="tel" required placeholder="(555) 000-0000"
            value={form.phone} onChange={handleChange} disabled={state === 'loading'} className={inputCls} />
        </div>
        <div>
          <label className={labelCls} htmlFor="inv-facility">Facility Name <span className="text-white/40 font-normal">(optional)</span></label>
          <input id="inv-facility" name="facility" type="text" placeholder="Sunrise Care Home"
            value={form.facility} onChange={handleChange} disabled={state === 'loading'} className={inputCls} />
        </div>

        {state === 'error' && (
          <p className="text-red-400 text-xs text-center">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={state === 'loading'}
          className="w-full mt-1 py-3 bg-white hover:bg-lasso-teal hover:text-white text-lasso-navy font-bold text-sm rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === 'loading' ? 'Submitting…' : 'Request Early Access'}
        </button>
      </form>

      <p className="text-center text-xs text-white/30 mt-4">
        HIPAA-compliant · Your information is never sold or shared.
      </p>
    </>
  )
}

export default function EarlyAccessPage() {
  return (
    <>
      <Head>
        <title>Early Access — Lasso</title>
        <meta name="description" content="Get early access to Lasso, the digital MAR built for residential care homes." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Early Access — Lasso" />
        <meta property="og:description" content="Get free early access to Lasso, the digital MAR built for residential care homes." />
        <meta property="og:image" content="https://www.lasso-app.com/og-lasso.jpg" />
        <meta property="og:url" content="https://www.lasso-app.com/early-access" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.lasso-app.com/og-lasso.jpg" />
      </Head>

      <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Navbar */}
        <header className="bg-white border-b border-gray-200 px-6 sm:px-12 py-4 flex justify-between items-center sticky top-0 z-30">
          {/* Logo: smaller on mobile so the button fits on one line */}
          <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-6 sm:h-9 w-auto" />
          {/* Early Access button: visible on tablet/mobile only */}
          <a
            href="#early-access-form"
            className="lg:hidden px-4 py-2 bg-lasso-navy text-white text-sm font-semibold rounded-xl hover:bg-lasso-teal transition-colors whitespace-nowrap"
          >
            Early Access
          </a>
        </header>

        {/* Body: 2/3 content + 1/3 form on desktop */}
        <div className="flex-1 flex flex-col lg:flex-row lg:items-start">

          {/* ── LEFT: event page content (2/3) ── */}
          <div className="flex-1 lg:w-0 min-w-0">

            {/* Hero */}
            <section className="max-w-3xl mx-auto px-6 sm:px-10 py-16 sm:py-20">
              {/* Badge row */}
              <div className="flex items-center gap-3 mb-6">
                <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Now Available
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-xs font-bold tracking-widest uppercase text-lasso-teal">
                  Purpose-built for residential care homes
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold text-lasso-navy leading-tight mb-6">
                The Digital MAR<br />
                Built for Residential<br />
                Care Homes
              </h1>

              <p className="text-base text-gray-600 leading-relaxed max-w-md mb-8">
                Lasso replaces paper binders with a secure, HIPAA-compliant EHR — progress notes, vital signs, and medication administration in one place.
              </p>

              {/* Product preview card */}
              <div className="relative w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <span className="absolute top-4 right-4 text-xs font-semibold tracking-widest uppercase text-gray-300">
                  PATIENT SUMMARY
                </span>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-lasso-teal/10 flex items-center justify-center text-lasso-teal flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-lasso-navy">Medication Administration</p>
                    <p className="text-xs text-gray-400 mt-0.5">Today · Morning round</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 bg-gray-100 rounded-full w-full" />
                        <div className="h-2 bg-gray-100 rounded-full w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Available Today */}
            <section className="bg-white border-t border-gray-100 py-16 sm:py-20">
              <div className="max-w-3xl mx-auto px-6 sm:px-10">
                <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-lasso-navy">Available Today</h2>
                  <div className="mt-3 mx-auto w-10 h-0.5 bg-lasso-teal rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {availableFeatures.map((f) => (
                    <div key={f.label} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <div className="w-10 h-10 rounded-lg bg-lasso-teal/10 flex items-center justify-center text-lasso-teal mb-4">
                        {f.icon}
                      </div>
                      <p className="text-sm font-bold text-lasso-navy mb-1">{f.label}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Coming Soon */}
            <section className="bg-gray-50 border-t border-gray-100 py-16 sm:py-20">
              <div className="max-w-3xl mx-auto px-6 sm:px-10">
                <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-lasso-navy">Coming Soon</h2>
                  <div className="mt-3 mx-auto w-10 h-0.5 bg-lasso-teal rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    'Mobile app — document at the bedside',
                    'Auto-duplicate MAR month-to-month',
                    'Automated compliance & audit exports',
                    'Physician portal',
                    'Family communication portal',
                    'Pharmacy integration',
                  ].map((item) => (
                    <div key={item} className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-3 shadow-sm">
                      <span className="text-lasso-teal font-bold text-lg leading-none flex-shrink-0">+</span>
                      <p className="text-sm text-gray-700">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>


            {/* Form — mobile/tablet only (below all content, above footer) */}
            <section id="early-access-form" className="lg:hidden bg-lasso-navy py-14 px-6 sm:px-10">
              <div className="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-lg">
                <EarlyAccessForm />
              </div>
            </section>

          </div>

          {/* ── RIGHT: sticky inverted form panel (1/3) — desktop only ── */}
          <aside className="hidden lg:flex lg:w-[380px] xl:w-[420px] flex-shrink-0 sticky top-[73px] self-start h-[calc(100vh-73px)] overflow-y-auto bg-lasso-navy border-l border-lasso-navy">
            <div className="w-full px-8 py-10">
              <InvertedEarlyAccessForm />
            </div>
          </aside>

        </div>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          <div className="border-b border-gray-100 py-5">
            <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-xs text-gray-400 font-medium">
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                HIPAA-Compliant
              </span>
              <span className="hidden sm:block text-gray-300">·</span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                </svg>
                AWS Encrypted Storage
              </span>
              <span className="hidden sm:block text-gray-300">·</span>
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Role-Based Access
              </span>
            </div>
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-8 w-auto" />
            <p className="text-sm text-gray-600">Electronic health records for care teams.</p>
            <nav className="flex gap-6 text-sm">
              <a href="https://www.lasso-app.com/#features" className="text-gray-600 hover:text-lasso-teal">Features</a>
              <a href="https://www.lasso-app.com/#workflow" className="text-gray-600 hover:text-lasso-teal">Workflow</a>
              <a href="https://www.lasso-app.com/#security" className="text-gray-600 hover:text-lasso-teal">Security</a>
              <a href="https://app.lasso-app.com/auth/login" className="text-gray-600 hover:text-lasso-teal">Log in</a>
            </nav>
          </div>
          <p className="text-center text-xs text-gray-400 pb-2">© Lasso Health. All rights reserved.</p>
          <div className="flex justify-center gap-6 text-xs text-gray-400 pb-6">
            <a href="/privacy" className="hover:text-lasso-teal">Privacy Policy</a>
            <a href="/terms" className="hover:text-lasso-teal">Terms of Service</a>
          </div>
        </footer>

      </div>
    </>
  )
}
