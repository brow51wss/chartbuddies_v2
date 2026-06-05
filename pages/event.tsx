import Head from 'next/head'

const EARLY_ACCESS_URL = 'https://www.lasso-app.com/early-access'
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(EARLY_ACCESS_URL)}&format=png&margin=10&color=ffffff&bgcolor=142F61`

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

export default function EventPage() {
  return (
    <>
      <Head>
        <title>Lasso — Early Access</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen flex flex-col bg-gray-50" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Navbar */}
        <header className="bg-white border-b border-gray-200 px-8 sm:px-12 py-4 flex justify-between items-center">
          <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-9 w-auto" />
          <a
            href="/early-access"
            className="px-5 py-2.5 bg-lasso-navy text-white text-sm font-semibold rounded-xl hover:bg-lasso-teal transition-colors"
          >
            Early Access
          </a>
        </header>

        {/* Hero */}
        <main className="flex-1 flex items-center">
          <div className="w-full max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 py-16 sm:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Left — copy */}
            <div>
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

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-extrabold text-lasso-navy leading-tight mb-6">
                The Digital MAR<br />
                Built for Residential<br />
                Care Homes
              </h1>

              {/* Subtext */}
              <p className="text-base text-gray-600 leading-relaxed max-w-md mb-8">
                Lasso replaces paper binders with a secure, HIPAA-compliant EHR — progress notes, vital signs, and medication administration in one place.
              </p>

              {/* CTA */}
              <a
                href="/early-access"
                className="inline-block px-6 py-3 bg-lasso-navy text-white font-semibold rounded-xl hover:bg-lasso-teal transition-colors text-sm"
              >
                Early Access
              </a>
            </div>

            {/* Right — product preview card */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative w-full max-w-md bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">

                {/* Product preview label */}
                <span className="absolute top-4 right-4 text-xs font-semibold tracking-widest uppercase text-gray-300">
                  PATIENT SUMMARY
                </span>

                {/* Card header */}
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

                {/* Patient rows */}
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
            </div>

          </div>
        </main>

        {/* Available Today */}
        <section className="bg-white border-t border-gray-100 py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-lasso-navy">Available Today</h2>
              <div className="mt-3 mx-auto w-10 h-0.5 bg-lasso-teal rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-lasso-navy">Coming Soon</h2>
              <div className="mt-3 mx-auto w-10 h-0.5 bg-lasso-teal rounded-full" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

        {/* Early Access / QR section */}
        <section className="bg-white border-t border-gray-100 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-6 sm:px-10 lg:px-16">

            {/* Label */}
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold tracking-widest uppercase text-lasso-teal whitespace-nowrap">Early Access</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Split card */}
            <div className="flex flex-col sm:flex-row rounded-2xl overflow-hidden border border-gray-200 shadow-sm">

              {/* Left — white */}
              <div className="flex-1 bg-white p-8 sm:p-10 flex flex-col justify-center gap-6">
                <div>
                  <h3 className="text-2xl font-extrabold text-lasso-navy leading-snug mb-3">
                    Get free early access<br />starting next week
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Fill in your details and we&apos;ll reach out with access next week
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Or visit</span>
                  <a
                    href={EARLY_ACCESS_URL}
                    className="text-xs font-semibold text-lasso-teal bg-lasso-teal/10 px-3 py-1.5 rounded-lg hover:bg-lasso-teal/20 transition-colors"
                  >
                    lasso-app.com/early-access
                  </a>
                </div>
              </div>

              {/* Right — navy */}
              <div className="bg-lasso-navy flex flex-col items-center justify-center p-8 sm:p-10 gap-4 sm:w-72 flex-shrink-0">
                <div className="bg-white rounded-xl p-3">
                  <img src={QR_URL} alt="QR Code" className="w-40 h-40 block" />
                </div>
                <div className="text-center">
                  <p className="text-white font-bold text-sm">Scan with your phone</p>
                  <p className="text-white/60 text-xs mt-1 leading-relaxed">
                    Fill in your details and we&apos;ll reach out with access next week
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200">
          {/* Trust badges */}
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

          {/* Global footer */}
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
