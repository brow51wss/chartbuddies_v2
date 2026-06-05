import Head from 'next/head'
import Image from 'next/image'

const EARLY_ACCESS_URL = 'https://www.lasso-app.com/early-access'
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(EARLY_ACCESS_URL)}&format=png&margin=12&color=142F61&bgcolor=ffffff`

const currentFeatures = [
  { label: 'Digital Medication Administration Record (MAR)', desc: 'Replace paper MAR entirely — track every dose, time, and nurse initial' },
  { label: 'Progress Notes with Digital Signatures', desc: 'Sign and lock notes from any browser — legally compliant documentation' },
  { label: 'PRN (As-Needed) Medication Tracking', desc: 'Log PRN doses with timestamps, reasons, and outcomes' },
  { label: 'Vital Signs Documentation', desc: 'Record vitals directly inside the patient chart' },
  { label: 'Patient Profile Management', desc: 'Diagnoses, allergies, diet, physician, and facility details in one place' },
  { label: 'HIPAA-Compliant from Day One', desc: 'PHI stored in encrypted AWS RDS — built to meet federal requirements' },
]

const comingFeatures = [
  'Mobile app — document at the bedside',
  'Monthly MAR duplication — carry forward medications automatically',
  'Automated compliance reports & audit exports',
  'Physician portal access',
  'Family communication portal',
  'Pharmacy integration',
  'Multi-facility management dashboard',
]

export default function EventPage() {
  return (
    <>
      <Head>
        <title>Lasso — Early Access</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div
        className="min-h-screen w-full flex flex-col"
        style={{ backgroundColor: '#142F61', fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-16 pt-10 pb-6">
          <img src="/images/icon-wordmark.webp" alt="Lasso" style={{ height: 48, width: 'auto', filter: 'brightness(0) invert(1)' }} />
          <div style={{ textAlign: 'right' }}>
            <span style={{ color: '#00B6E2', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Now Available
            </span>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 2 }}>
              Designed for residential care homes
            </p>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-row px-16 pb-10 gap-12">

          {/* Left column */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Headline */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ color: '#ffffff', fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginBottom: 12 }}>
                The Digital MAR Built for<br />
                <span style={{ color: '#00B6E2' }}>Residential Care Homes</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 16, maxWidth: 540, lineHeight: 1.6 }}>
                Lasso replaces paper MAR and binders with a secure, HIPAA-compliant web app — purpose-built for care home nurses and administrators.
              </p>
            </div>

            {/* Current features */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ color: '#00799E', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Available Today
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                {currentFeatures.map((f) => (
                  <div key={f.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: '#00B6E2', fontSize: 16, marginTop: 1, flexShrink: 0 }}>✓</span>
                    <div>
                      <p style={{ color: '#ffffff', fontSize: 13, fontWeight: 600, marginBottom: 1 }}>{f.label}</p>
                      <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, lineHeight: 1.4 }}>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming soon */}
            <div
              style={{
                background: 'rgba(0,182,226,0.07)',
                border: '1px solid rgba(0,182,226,0.2)',
                borderRadius: 10,
                padding: '14px 18px',
              }}
            >
              <p style={{ color: '#00B6E2', fontWeight: 700, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
                Coming Soon
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {comingFeatures.map((f) => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00799E', flexShrink: 0 }} />
                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — QR code */}
          <div
            style={{
              width: 320,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div
                style={{
                  background: '#00B6E2',
                  borderRadius: 8,
                  padding: '6px 16px',
                }}
              >
                <span style={{ color: '#142F61', fontWeight: 800, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Early Access
                </span>
              </div>

              <img
                src={QR_URL}
                alt="QR Code"
                style={{ width: 240, height: 240, display: 'block' }}
              />

              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#142F61', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Scan to register
                </p>
                <p style={{ color: '#5B5B5B', fontSize: 12, lineHeight: 1.5 }}>
                  Get early access to Lasso<br />starting next week — free.
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
                Or visit
              </p>
              <p style={{ color: '#00B6E2', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                lasso-app.com/early-access
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            HIPAA-Compliant · AWS Encrypted Storage · Built for Residential Care
          </p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            lasso-app.com
          </p>
        </footer>
      </div>
    </>
  )
}
