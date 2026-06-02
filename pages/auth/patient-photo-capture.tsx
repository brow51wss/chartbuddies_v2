import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const API = '/api/patient-photo-capture'
const MAX_EDGE = 1024

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height, 1))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('canvas')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')) }
    img.src = url
  })
}

export default function PatientPhotoCapturePage() {
  const router = useRouter()
  const { token } = router.query
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'preview' | 'submitting' | 'done'>('loading')
  const [patientName, setPatientName] = useState('')
  const [photoSavedToPatient, setPhotoSavedToPatient] = useState(true)
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (typeof token !== 'string') return
    let cancelled = false
    fetch(`${API}?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (!data.valid) { setStatus('invalid'); return }
        setPatientName(typeof data.patientName === 'string' ? data.patientName : '')
        setPhotoSavedToPatient(data.patientId != null && String(data.patientId).length > 0)
        setStatus('ready')
      })
      .catch(() => { if (!cancelled) setStatus('invalid') })
    return () => { cancelled = true }
  }, [token])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const dataUrl = await compressImage(file)
      setPreviewDataUrl(dataUrl)
      setSubmitError('')
      setStatus('preview')
    } catch {
      setSubmitError('Could not read the photo. Please try again.')
    }
    // reset so the same file can be re-selected after retake
    e.target.value = ''
  }

  const handleRetake = () => {
    setPreviewDataUrl('')
    setSubmitError('')
    setStatus('ready')
    // trigger the file picker again
    setTimeout(() => inputRef.current?.click(), 50)
  }

  const handleConfirm = async () => {
    if (typeof token !== 'string' || !previewDataUrl) return
    setSubmitError('')
    setStatus('submitting')
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, photoDataUrl: previewDataUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to save. Please try again.')
        setStatus('preview')
        return
      }
      setStatus('done')
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
      setStatus('preview')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <>
        <Head><title>Patient photo - Lasso</title></Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400" />
          <p className="mt-4 text-gray-300">Checking link…</p>
        </div>
      </>
    )
  }

  // ── Invalid ──────────────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <>
        <Head><title>Link invalid - Lasso</title></Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold mb-2">Link expired or invalid</h1>
            <p className="text-gray-300">Request a new link from the patient form on your computer.</p>
          </div>
        </div>
      </>
    )
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (status === 'done') {
    return (
      <>
        <Head><title>Photo saved - Lasso</title></Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white">
          <div className="max-w-sm text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-600/20">
              <svg className="h-8 w-8 text-teal-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-teal-300">Photo saved</h1>
            <p className="text-gray-300">
              {photoSavedToPatient
                ? 'You can close this page. On your computer, refresh the patient screen to see the updated photo.'
                : <>You can close this page. On your computer, return to the admission form, open the patient photo dialog, and tap the teal <strong>Add here</strong> button.</>
              }
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Preview / Submitting ─────────────────────────────────────────────────
  if (status === 'preview' || status === 'submitting') {
    return (
      <>
        <Head><title>Confirm photo - Lasso</title></Head>
        <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-900 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-white">
          <div className="shrink-0 text-center mb-3">
            <h1 className="text-lg font-semibold">Looks good?</h1>
            {patientName && <p className="text-xs text-gray-400 mt-0.5">{patientName}</p>}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            {previewDataUrl && (
              <img src={previewDataUrl} alt="Photo preview"
                className="max-h-full max-w-full rounded-2xl object-contain shadow-xl border border-white/10" />
            )}
          </div>
          {submitError && (
            <p className="shrink-0 mt-2 text-center text-sm text-red-300">{submitError}</p>
          )}
          <div className="flex shrink-0 gap-3 mt-4">
            <button type="button" onClick={handleRetake} disabled={status === 'submitting'}
              className="flex-1 rounded-xl border border-gray-500 py-3 text-sm font-medium text-gray-200 disabled:opacity-50">
              Retake
            </button>
            <button type="button" onClick={handleConfirm} disabled={status === 'submitting'}
              className="flex-1 rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {status === 'submitting' ? 'Saving…' : 'Use this photo'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Ready — tap to open camera ───────────────────────────────────────────
  return (
    <>
      <Head><title>Take patient photo - Lasso</title></Head>
      {/* Hidden file input — capture="environment" opens back camera directly */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-900 px-6 text-white text-center">
        <svg className="h-20 w-20 text-teal-400 opacity-90" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
        </svg>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Patient photo</h1>
          {patientName && <p className="text-gray-400">{patientName}</p>}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full max-w-xs rounded-2xl bg-teal-600 py-4 text-lg font-semibold text-white shadow-lg active:scale-95 transition-transform"
        >
          Open camera
        </button>
        <p className="text-xs text-gray-500">Your camera will open. Take the photo, then confirm.</p>
      </div>
    </>
  )
}
