'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import SignaturePad from '../components/SignaturePad'

type Step = 'welcome' | 'signature' | 'initials' | 'done'

function usePadSize() {
  const getSize = useCallback(() => {
    if (typeof window === 'undefined') return { sigW: 380, sigH: 160, iniW: 240, iniH: 100 }
    const w = Math.min(window.innerWidth * 0.88, 480)
    return {
      sigW: Math.round(w),
      sigH: Math.round((160 / 380) * w),
      iniW: Math.round(w * 0.6),
      iniH: Math.round((100 / 240) * w * 0.6)
    }
  }, [])
  const [size, setSize] = useState(getSize)
  useEffect(() => {
    setSize(getSize())
    const onResize = () => setSize(getSize())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [getSize])
  return size
}

const STEPS: Step[] = ['welcome', 'signature', 'initials', 'done']

function StepIndicator({ current }: { current: Step }) {
  const labels = ['Welcome', 'Signature', 'Initials', 'Done']
  const activeIdx = STEPS.indexOf(current)
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {labels.map((label, i) => (
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
            <span className={`text-xs mt-1 font-medium ${i === activeIdx ? 'text-lasso-navy' : i < activeIdx ? 'text-lasso-navy' : 'text-gray-400'}`}>
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div className={`w-10 sm:w-16 h-0.5 mb-5 mx-1 transition-all ${i < activeIdx ? 'bg-lasso-navy' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function Onboarding() {
  const router = useRouter()
  const padSize = usePadSize()

  const [pageLoading, setPageLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('welcome')
  const [signatureDataUrl, setSignatureDataUrl] = useState('')
  const [initialsDataUrl, setInitialsDataUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        window.location.replace('/auth/login')
        return
      }
      if (profile.role !== 'nurse') {
        window.location.replace('/dashboard')
        return
      }
      if (profile.staff_signature && profile.staff_initials) {
        window.location.replace('/dashboard')
        return
      }
      setUserId(profile.id)
      setPageLoading(false)
    }
    checkAuth()
  }, [])

  const handleUploadAndSave = async () => {
    if (!signatureDataUrl) { setError('Please draw your signature first.'); return }
    if (!initialsDataUrl) { setError('Please draw your initials first.'); return }
    setSaving(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Session expired. Please log in again.')

      // Get pre-signed S3 upload URLs for both
      const [sigRes, iniRes] = await Promise.all([
        fetch('/api/signature-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: 'signature' })
        }),
        fetch('/api/signature-upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ type: 'initials' })
        })
      ])
      const [sigData, iniData] = await Promise.all([sigRes.json(), iniRes.json()])
      if (!sigData.uploadUrl || !iniData.uploadUrl) throw new Error('Failed to get upload URLs.')

      // Convert data URLs to blobs and upload to S3
      const toBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob()
      const [sigBlob, iniBlob] = await Promise.all([toBlob(signatureDataUrl), toBlob(initialsDataUrl)])
      const [sigUpload, iniUpload] = await Promise.all([
        fetch(sigData.uploadUrl, { method: 'PUT', body: sigBlob, headers: { 'Content-Type': 'image/jpeg' } }),
        fetch(iniData.uploadUrl, { method: 'PUT', body: iniBlob, headers: { 'Content-Type': 'image/jpeg' } })
      ])
      if (!sigUpload.ok || !iniUpload.ok) throw new Error('Upload failed. Please try again.')

      // Save S3 keys to user_profiles in Supabase
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          staff_signature: `s3:${sigData.key}`,
          staff_initials: `s3:${iniData.key}`
        })
        .eq('id', userId)
      if (updateError) throw new Error('Failed to save. Please try again.')

      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSaving(false)
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
                  <p className="text-gray-500 text-sm">Takes about 1 minute</p>
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
                      <p className="text-gray-500 text-sm mt-0.5">Care records are legal documents. Your signature creates a verifiable, auditable trail that protects both the resident and you as a caregiver.</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">Your initials for quick entries</p>
                      <p className="text-gray-500 text-sm mt-0.5">Initials are used for brief confirmations and PRN records, keeping documentation fast without sacrificing accountability.</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setStep('signature')}
                  className="w-full bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors"
                >
                  Get Started
                </button>
                <p className="text-center text-xs text-gray-400 mt-3">
                  You can update your signature anytime in your{' '}
                  <Link href="/profile" className="underline hover:text-gray-600">profile</Link>.
                </p>
              </div>
            )}

            {/* ── SIGNATURE ── */}
            {step === 'signature' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Draw your signature</h2>
                <p className="text-sm text-gray-500 mb-6">Use your finger or stylus. This will appear on every MAR entry you sign.</p>

                <div className="flex justify-center mb-2">
                  <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <SignaturePad
                      value={signatureDataUrl}
                      onChange={setSignatureDataUrl}
                      width={padSize.sigW}
                      height={padSize.sigH}
                      placeholder="Sign here"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mb-6">Draw inside the box above, then tap Clear to redo.</p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('welcome')}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (!signatureDataUrl) { setError('Please draw your signature before continuing.'); return }
                      setError('')
                      setStep('initials')
                    }}
                    className="flex-1 bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors"
                  >
                    Next
                  </button>
                </div>
                {error && <p className="text-red-600 text-sm text-center mt-3">{error}</p>}
              </div>
            )}

            {/* ── INITIALS ── */}
            {step === 'initials' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Draw your initials</h2>
                <p className="text-sm text-gray-500 mb-6">Used for quick confirmations and PRN records.</p>

                <div className="flex justify-center mb-2">
                  <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <SignaturePad
                      value={initialsDataUrl}
                      onChange={setInitialsDataUrl}
                      width={padSize.iniW}
                      height={padSize.iniH}
                      placeholder="Initials here"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mb-6">Draw inside the box above, then tap Clear to redo.</p>

                {error && <p className="text-red-600 text-sm text-center mb-4">{error}</p>}

                <div className="flex gap-3">
                  <button
                    onClick={() => { setError(''); setStep('signature') }}
                    disabled={saving}
                    className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleUploadAndSave}
                    disabled={saving}
                    className="flex-1 bg-lasso-navy text-white py-3 rounded-xl font-semibold hover:bg-lasso-navy/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : 'Save & Continue'}
                  </button>
                </div>
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
                <p className="text-gray-500 mb-8">Your signature and initials have been saved. You can now sign MAR records and document care.</p>
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
