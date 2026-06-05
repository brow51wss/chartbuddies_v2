import Head from 'next/head'

const EARLY_ACCESS_URL = 'https://www.lasso-app.com/early-access'
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(EARLY_ACCESS_URL)}&format=png&margin=10&color=142F61&bgcolor=ffffff`

const currentFeatures = [
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
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'PRN Tracking',
    desc: 'Log as-needed meds with timestamps, reasons, and outcomes',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
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

const comingFeatures = [
  'Mobile app — document at the bedside',
  'Auto-duplicate MAR month-to-month',
  'Automated compliance & audit exports',
  'Physician portal',
  'Family communication portal',
  'Pharmacy integration',
  'Multi-facility dashboard',
]

export default function EventPage() {
  return (
    <>
      <Head>
        <title>Lasso — Early Access</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-12 py-4 flex justify-between items-center flex-shrink-0">
          <img src="/images/icon-wordmark.webp" alt="Lasso" className="h-10 w-auto" />
          <div className="text-right">
            <span className="text-xs font-bold tracking-widest uppercase text-lasso-teal">Now Available</span>
            <p className="text-xs text-gray-500 mt-0.5">Purpose-built for residential care homes</p>
          </div>
        </header>

        {/* Main body */}
        <main className="flex-1 flex min-h-0">

          {/* Left panel — navy */}
          <div className="flex-1 bg-lasso-navy flex flex-col justify-between px-14 py-10">

            {/* Headline */}
            <div>
              <h1 className="text-4xl font-extrabold text-white leading-tight mb-4">
                The Digital MAR Built for<br />
                <span className="text-lasso-blue">Residential Care Homes</span>
              </h1>
              <p className="text-base text-white/60 max-w-lg leading-relaxed">
                Lasso replaces paper binders with a secure, HIPAA-compliant EHR — progress notes, vital signs, and medication administration in one place.
              </p>
            </div>

            {/* Available Today */}
            <div className="flex-1 flex flex-col justify-center py-6">
              <p className="text-xs font-bold tracking-widest uppercase text-lasso-teal mb-4">Available Today</p>
              <div className="grid grid-cols-2 gap-4">
                {currentFeatures.map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-lasso-teal/20 flex items-center justify-center text-lasso-blue flex-shrink-0 mt-0.5">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{f.label}</p>
                      <p className="text-xs text-white/45 leading-snug mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming Soon */}
            <div className="border border-lasso-teal/20 bg-lasso-teal/5 rounded-xl px-5 py-4">
              <p className="text-xs font-bold tracking-widest uppercase text-lasso-blue mb-3">Coming Soon</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5">
                {comingFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-lasso-teal flex-shrink-0" />
                    <p className="text-xs text-white/55">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — white, QR code */}
          <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col items-center justify-center px-8 py-10 flex-shrink-0 gap-6">

            <div className="text-center">
              <span className="inline-block bg-lasso-navy text-lasso-blue text-xs font-bold tracking-widest uppercase px-4 py-1.5 rounded-full mb-3">
                Early Access
              </span>
              <p className="text-lasso-navy font-bold text-lg leading-snug">
                Get free early access<br />starting next week
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <img
                src={QR_URL}
                alt="QR Code — scan to register"
                className="w-56 h-56 block"
              />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-lasso-navy">Scan with your phone</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Fill in your details and we&apos;ll reach out with access next week
              </p>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-400">Or visit</p>
              <p className="text-xs font-semibold text-lasso-teal mt-0.5">lasso-app.com/early-access</p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 px-12 py-3 flex justify-between items-center flex-shrink-0">
          <p className="text-xs text-gray-400">HIPAA-Compliant · AWS Encrypted Storage · Role-Based Access</p>
          <p className="text-xs text-gray-400">lasso-app.com</p>
        </footer>

      </div>
    </>
  )
}
