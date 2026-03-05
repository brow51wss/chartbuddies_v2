'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import SignaturePad from '../../components/SignaturePad'

type Step = 'signature' | 'initials'

const API = '/api/signature-setup'

export default function SignatureSetupPage() {
  const router = useRouter()
  const { token } = router.query
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'submitting' | 'done'>('loading')
  const [step, setStep] = useState<Step>('signature')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [initialsDataUrl, setInitialsDataUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof token !== 'string') return
    let cancelled = false
    fetch(`${API}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setStatus(data.valid ? 'ready' : 'invalid')
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => { cancelled = true }
  }, [token])

  const canNextFromSignature = signatureDataUrl.startsWith('data:image')
  const canSubmit = initialsDataUrl.startsWith('data:image')

  const handleNext = () => {
    setError('')
    setStep('initials')
  }

  const handleSubmit = async () => {
    if (typeof token !== 'string' || !token || !signatureDataUrl || !initialsDataUrl) return
    setError('')
    setStatus('submitting')
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signatureDataUrl,
          initialsDataUrl
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        setStatus('ready')
        return
      }
      setStatus('done')
    } catch {
      setError('Network error')
      setStatus('ready')
    }
  }

  if (status === 'loading') {
    return (
      <>
        <Head>
          <title>Signature setup - ChartBuddies</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Checking link...</p>
        </div>
      </>
    )
  }

  if (status === 'invalid') {
    return (
      <>
        <Head>
          <title>Link invalid - ChartBuddies</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Link expired or invalid</h1>
            <p className="text-gray-600 dark:text-gray-400">
              This link has expired or has already been used. Go to your profile and request a new &quot;Create/Edit signature and initials&quot; link.
            </p>
          </div>
        </div>
      </>
    )
  }

  if (status === 'done') {
    return (
      <>
        <Head>
          <title>Done - ChartBuddies</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-sm text-center">
            <div className="text-green-600 dark:text-green-400 text-5xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Signature and initials saved</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You can close this page and return to the app. Your signature and initials will appear on MAR forms.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Draw signature and initials - ChartBuddies</title>
      </Head>
      <div className="min-h-screen flex flex-col p-4 pb-8 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto w-full flex flex-col flex-1">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 mb-6">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              A mobile device or tablet is required to complete your signature and initials. This link is one-time use and time-limited.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          {step === 'signature' && (
            <>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Step 1: Draw your signature</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Sign in the box below with your finger or stylus.</p>
              <div className="flex justify-center mb-6">
                <SignaturePad
                  value={signatureDataUrl}
                  onChange={setSignatureDataUrl}
                  width={320}
                  height={140}
                  placeholder="Draw your full signature"
                />
              </div>
              <button
                type="button"
                onClick={handleNext}
                disabled={!canNextFromSignature}
                className="w-full py-3 px-4 rounded-lg bg-teal-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next: Draw initials
              </button>
            </>
          )}

          {step === 'initials' && (
            <>
              <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-1">Step 2: Draw your initials</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Draw your initials in the box below.</p>
              <div className="flex justify-center mb-6">
                <SignaturePad
                  value={initialsDataUrl}
                  onChange={setInitialsDataUrl}
                  width={200}
                  height={80}
                  placeholder="Draw initials"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('signature')}
                  className="flex-1 py-3 px-4 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || status === 'submitting'}
                  className="flex-1 py-3 px-4 rounded-lg bg-teal-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {status === 'submitting' ? 'Saving...' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
