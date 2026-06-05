import Head from 'next/head'
import { useState, FormEvent } from 'react'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function EarlyAccessPage() {
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

  return (
    <>
      <Head>
        <title>Early Access — Lasso</title>
        <meta name="description" content="Get early access to Lasso, the digital MAR built for residential care homes." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Early Access — Lasso" />
        <meta property="og:description" content="Get free early access to Lasso, the digital MAR built for residential care homes." />
        <meta property="og:image" content="https://www.lasso-app.com/Lasso-OpenGraph2.jpg" />
        <meta property="og:url" content="https://www.lasso-app.com/early-access" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://www.lasso-app.com/Lasso-OpenGraph2.jpg" />
      </Head>

      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 440,
            backgroundColor: '#ffffff',
            borderRadius: 16,
            padding: '40px 36px',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img
              src="/images/icon-wordmark.webp"
              alt="Lasso"
              style={{ height: 36, width: 'auto', display: 'inline-block' }}
            />
          </div>

          {state === 'success' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: '#e6f9f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  fontSize: 28,
                }}
              >
                ✓
              </div>
              <h2 style={{ color: '#142F61', fontWeight: 800, fontSize: 22, marginBottom: 10 }}>
                You&apos;re on the list!
              </h2>
              <p style={{ color: '#5B5B5B', fontSize: 15, lineHeight: 1.6 }}>
                We&apos;ll reach out to <strong>{form.email}</strong> with your early access details next week.
              </p>
              <p style={{ color: '#00799E', fontSize: 13, marginTop: 16 }}>
                Thank you for your interest in Lasso.
              </p>
            </div>
          ) : (
            <>
              <h1 style={{ color: '#142F61', fontWeight: 800, fontSize: 22, marginBottom: 6, textAlign: 'center' }}>
                Get Early Access
              </h1>
              <p style={{ color: '#5B5B5B', fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 1.5 }}>
                Be among the first care home teams to use Lasso. We&apos;re onboarding early access users starting next week.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={labelStyle} htmlFor="full_name">
                    Full Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    required
                    placeholder="Jane Smith"
                    value={form.full_name}
                    onChange={handleChange}
                    style={inputStyle}
                    disabled={state === 'loading'}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="email">
                    Email Address <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    placeholder="jane@carehome.com"
                    value={form.email}
                    onChange={handleChange}
                    style={inputStyle}
                    disabled={state === 'loading'}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="phone">
                    Phone Number <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="(555) 000-0000"
                    value={form.phone}
                    onChange={handleChange}
                    style={inputStyle}
                    disabled={state === 'loading'}
                  />
                </div>

                <div>
                  <label style={labelStyle} htmlFor="facility">
                    Facility Name <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input
                    id="facility"
                    name="facility"
                    type="text"
                    placeholder="Sunrise Care Home"
                    value={form.facility}
                    onChange={handleChange}
                    style={inputStyle}
                    disabled={state === 'loading'}
                  />
                </div>

                {state === 'error' && (
                  <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{errorMsg}</p>
                )}

                <button
                  type="submit"
                  disabled={state === 'loading'}
                  style={{
                    backgroundColor: state === 'loading' ? '#00799E' : '#142F61',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '13px 0',
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: state === 'loading' ? 'not-allowed' : 'pointer',
                    opacity: state === 'loading' ? 0.75 : 1,
                    marginTop: 4,
                    transition: 'background-color 0.15s',
                  }}
                >
                  {state === 'loading' ? 'Submitting…' : 'Request Early Access'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ color: '#9ca3af', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
          HIPAA-compliant · Your information is never sold or shared.
        </p>
      </div>
    </>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  fontSize: 14,
  color: '#111827',
  backgroundColor: '#ffffff',
  outline: 'none',
  boxSizing: 'border-box',
}
