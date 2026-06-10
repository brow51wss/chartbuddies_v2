'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'

type Step = 'welcome' | 'sent' | 'done'

const STEPS: Step[] = ['welcome', 'sent', 'done']
const STEP_LABELS = ['Welcome', 'Setup', 'Done']

function StepIndicator({ current }: { current: Step }) {
  const activeIdx = STEPS.indexOf(current)
  return (
    <div className="flex items-center justify-center mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
              i < activeIdx
                ? 'bg-lasso-navy border-lasso-navy text-white'
                : i === activeIdx
                  ? 'bg-white border-lasso-navy text-lasso-navy'
                  : 'bg-white border-gray-300 text-gray-400'
            }`}>
              {i < activeIdx ? '✓' : i + 1}
            </div>
            <span className={`text-xs mt-1 font-medium ${i <= activeIdx ? 'text-lasso-navy' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`w-12 sm:w-20 h-0.5 mb-5 mx-1 transition-all ${i < activeIdx ? 'bg-lasso-navy' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const router = useRouter()
  const [pageLoading, setPageLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [step, setStep] = useState<Step>('welcome')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [checking, setChecking] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        window.location.replace('/auth/login')
        return
      }
      if (profile.staff_signature && profile.staff_initials) {
        window.location.replace('/dashboard')
        return
      }
      setUserEmail(profile.email)
      setPageLoading(false)
    }
    checkAuth()
  }, [])

  // Auto-poll every 5s while on the 'sent' step
  useEffect(() => {
    if (step !== 'sent') {
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }
    pollRef.current = setInterval(async () => {
      const profile = await getCurrentUserProfile()
      if (profile?.staff_signature && profile?.staff_initials) {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep('done')
      }
    }, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [step])

  const handleSendEmail = async () => {
    setSending(true)
    setSendError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Session expired. Please log in again.')

      const res = await fetch('/api/send-signature-setup-email', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send email.')

      setStep('sent')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleCheckNow = async () => {
    setSendError('')
    setChecking(true)
    const profile = await getCurrentUserProfile()
    setChecking(false)
    if (profile?.staff_signature && profile?.staff_initials) {
      setStep('done')
    } else {
      setSendError("We haven't received your signature yet. Please complete the setup on your phone first.")
    }
  }

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-lasso-navy" />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Account Setup — Lasso</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <span className="text-xl font-bold text-lasso-navy tracking-tight">Lasso</span>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            Skip for now
          </Link>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 py-10">
          <div className="w-full max-w-lg">
            <StepIndicator current={step} />

            {/* ── WELCOME ── */}
            {step === 'welcome' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-lasso-navy/10 mb-4">
                    <svg className="w-8 h-8 text-lasso-navy" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Set up your signature</h1>
                  <p className="text-gray-500 text-sm">Takes about 1 minute — done on your phone or tablet</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Required for MAR documentation</p>
                      <p className="text-gray-500 text-sm mt-0.5">Every medication administration you record must be signed. Your signature confirms you personally administered the medication.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Legal and HIPAA accountability</p>
                      <p className="text-gray-500 text-sm mt-0.5">Care records are legal documents. Your signature creates a verifiable, auditable trail that protects both the resident and you.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Done on your phone — easier to sign</p>
                      <p className="text-gray-500 text-sm mt-0.5">We&apos;ll email you a secure link. Open it on your phone or tablet and draw your signature and initials with your finger.</p>
                    </div>
                  </div>
                </div>

                {sendError && <p className="text-red-600 text-sm text-center mb-4">{sendError}</p>}

                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="w-full bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {sending ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : 'Send Setup Link to My Email'}
                </button>
                <p className="text-center text-xs text-gray-400 mt-3">
                  You can update your signature anytime from your{' '}
                  <Link href="/profile" className="underline hover:text-gray-600">profile</Link>.
                </p>
              </div>
            )}

            {/* ── SENT / WAITING ── */}
            {step === 'sent' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                  <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
                <p className="text-gray-500 text-sm mb-1">We sent a setup link to</p>
                <p className="font-semibold text-lasso-navy mb-6">{userEmail}</p>

                <div className="bg-gray-50 rounded-xl p-4 text-left mb-6 space-y-3">
                  {[
                    'Open the email on your phone or tablet',
                    'Tap the link — it opens a drawing screen',
                    'Draw your signature, then your initials',
                    'Come back here when done',
                  ].map((s, i) => (
                    <div key={s} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-lasso-navy text-white text-xs flex items-center justify-center font-bold mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-gray-700">{s}</p>
                    </div>
                  ))}
                </div>

                {sendError && <p className="text-red-600 text-sm text-center mb-4">{sendError}</p>}

                <button
                  onClick={handleCheckNow}
                  disabled={checking}
                  className="w-full bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {checking ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Checking…
                    </>
                  ) : "I've completed the setup"}
                </button>

                <button
                  onClick={handleSendEmail}
                  disabled={sending}
                  className="w-full mt-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                >
                  {sending ? 'Resending…' : 'Resend email'}
                </button>

                <p className="text-xs text-gray-400 mt-5">
                  This page checks automatically every few seconds once you&apos;ve completed setup on your phone.
                </p>
              </div>
            )}

            {/* ── DONE ── */}
            {step === 'done' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re all set!</h2>
                <p className="text-gray-500 mb-8">
                  Your signature and initials have been saved. You can now sign MAR records and document care.
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors"
                >
                  Go to Dashboard
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  )
}
