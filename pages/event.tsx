import Head from 'next/head'

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
                  Product Preview
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

      </div>
    </>
  )
}
