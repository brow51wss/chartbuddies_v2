import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

const API = '/api/patient-photo-capture'

function captureCenterCropFromVideo(
  video: HTMLVideoElement,
  aspectW: number,
  aspectH: number,
  maxEdge: number
): string {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return ''
  const ar = aspectW / aspectH
  let cw = 0
  let ch = 0
  let sx = 0
  let sy = 0
  const videoAr = vw / vh
  if (videoAr > ar) {
    ch = vh
    cw = Math.round(ch * ar)
    sx = Math.round((vw - cw) / 2)
    sy = 0
  } else {
    cw = vw
    ch = Math.round(cw / ar)
    sx = 0
    sy = Math.round((vh - ch) / 2)
  }
  const src = document.createElement('canvas')
  src.width = cw
  src.height = ch
  const sctx = src.getContext('2d')
  if (!sctx) return ''
  sctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch)
  const scale = Math.min(1, maxEdge / Math.max(cw, ch, 1))
  const ow = Math.max(1, Math.round(cw * scale))
  const oh = Math.max(1, Math.round(ch * scale))
  const out = document.createElement('canvas')
  out.width = ow
  out.height = oh
  const octx = out.getContext('2d')
  if (!octx) return ''
  octx.drawImage(src, 0, 0, cw, ch, 0, 0, ow, oh)
  return out.toDataURL('image/jpeg', 0.85)
}

export default function PatientPhotoCapturePage() {
  const router = useRouter()
  const { token } = router.query
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 'ready' = token valid, waiting for user to tap "Start camera"
  // 'camera' = getUserMedia called, stream active
  const [status, setStatus] = useState<'loading' | 'invalid' | 'ready' | 'camera' | 'preview' | 'submitting' | 'done'>('loading')
  const [patientName, setPatientName] = useState('')
  /** When false, photo was queued for the laptop form (new admission) instead of saved to a patient row. */
  const [photoSavedToPatient, setPhotoSavedToPatient] = useState(true)
  const [previewDataUrl, setPreviewDataUrl] = useState('')
  const [cameraError, setCameraError] = useState('')
  const [submitError, setSubmitError] = useState('')

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => { stopStream() }
  }, [stopStream])

  useEffect(() => {
    if (typeof token !== 'string') return
    let cancelled = false
    fetch(`${API}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
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

  // Called when user taps "Start camera" — the user gesture is required so the
  // browser shows its native "Allow camera access?" popup instead of silently denying.
  const handleStartCamera = useCallback(async () => {
    setCameraError('')

    // In-app browsers (Gmail, Facebook, Instagram, etc.) block camera on iOS and Android.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isInAppBrowser =
      /FBAN|FBAV/.test(ua) ||     // Facebook
      /Instagram/.test(ua) ||     // Instagram
      /LinkedInApp/.test(ua) ||   // LinkedIn
      /Twitter/.test(ua) ||       // X / Twitter
      !navigator.mediaDevices     // any WebView that strips mediaDevices entirely

    if (isInAppBrowser) {
      setCameraError('open-in-browser')
      return
    }

    setStatus('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const v = videoRef.current
      if (v) {
        v.srcObject = stream
        await v.play().catch(() => {})
      }
    } catch (err) {
      stopStream()
      setStatus('ready')
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setCameraError('permission-denied')
      } else {
        setCameraError('generic')
      }
    }
  }, [stopStream])

  const handleCapture = () => {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const dataUrl = captureCenterCropFromVideo(v, 3, 4, 1024)
    if (!dataUrl) return
    setPreviewDataUrl(dataUrl)
    stopStream()
    setStatus('preview')
  }

  const handleRetake = () => {
    setPreviewDataUrl('')
    setSubmitError('')
    setStatus('ready')
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
        setSubmitError(data.error || 'Failed to save')
        setStatus('preview')
        return
      }
      setStatus('done')
    } catch {
      setSubmitError('Network error')
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

  // ── Invalid token ────────────────────────────────────────────────────────
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
            <h1 className="text-xl font-semibold text-teal-300">Photo saved</h1>
            <p className="text-gray-300">
              {photoSavedToPatient ? (
                <>You can close this page. On your computer, refresh the patient screen or reopen edit patient details to see the updated photo.</>
              ) : (
                <>You can close this page. On your computer, return to the admission form, open the patient photo dialog, and tap the teal <strong>Add here</strong> button to place this picture in the chart.</>
              )}
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
        <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-900 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
          <div className="shrink-0 space-y-0.5 text-center">
            <h1 className="text-base font-semibold leading-tight">Preview</h1>
            {patientName && <p className="truncate text-xs text-gray-400">{patientName}</p>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-1">
            {previewDataUrl && (
              <img src={previewDataUrl} alt="Captured preview"
                className="max-h-full w-full max-w-md object-contain rounded-xl border border-gray-600 shadow-lg" />
            )}
          </div>
          {submitError && <p className="shrink-0 px-1 py-1 text-center text-xs text-red-300">{submitError}</p>}
          <div className="flex shrink-0 flex-wrap justify-center gap-2 pt-1">
            <button type="button" onClick={handleRetake} disabled={status === 'submitting'}
              className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50">
              Retake
            </button>
            <button type="button" onClick={handleConfirm} disabled={status === 'submitting'}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50">
              {status === 'submitting' ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Ready (waiting for tap) + Camera (stream active) ────────────────────
  const isReady = status === 'ready'

  return (
    <>
      <Head><title>Take patient photo - Lasso</title></Head>
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-900 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white">

        <div className="shrink-0 space-y-0.5 text-center">
          <h1 className="text-base font-semibold leading-tight">Patient photo</h1>
          {patientName && <p className="truncate px-1 text-xs text-gray-400">{patientName}</p>}
          {!isReady && !cameraError && (
            <p className="mx-auto max-w-md px-1 text-[10px] leading-snug text-gray-500">
              Align within the frame. Teal corners show the crop area.
            </p>
          )}
        </div>

        {/* Error banners */}
        {cameraError === 'open-in-browser' && (
          <div className="mt-3 shrink-0 rounded-xl bg-yellow-900/60 px-4 py-4 text-center text-sm text-yellow-200 ring-1 ring-yellow-500/40">
            <p className="text-base font-semibold">Open this page in your browser</p>
            <p className="mt-2 text-sm text-yellow-300">Your email app blocks camera access.</p>
            <p className="mt-3 text-sm text-yellow-300"><strong>iPhone / iPad</strong></p>
            <p className="text-xs text-yellow-400">Tap the share icon <strong>↑</strong> at the bottom of the screen, then tap <strong>"Open in Safari"</strong>.</p>
            <p className="mt-3 text-sm text-yellow-300"><strong>Android</strong></p>
            <p className="text-xs text-yellow-400">Tap the three-dot menu <strong>⋮</strong> and choose <strong>"Open in Chrome"</strong>.</p>
          </div>
        )}
        {cameraError === 'permission-denied' && (
          <div className="mt-3 shrink-0 rounded-xl bg-red-900/60 px-4 py-4 text-center ring-1 ring-red-500/40">
            <p className="text-base font-semibold text-red-200">Camera access was blocked</p>
            <p className="mt-2 text-sm text-red-300">Your browser needs permission to use the camera.</p>
            <p className="mt-3 text-sm text-red-300"><strong>iPhone / iPad — Safari</strong></p>
            <p className="text-xs text-red-400">Go to <strong>Settings → Safari → Camera</strong> → set to <strong>Allow</strong>, then come back and tap Try again.</p>
            <p className="mt-3 text-sm text-red-300"><strong>iPhone / iPad — Chrome</strong></p>
            <p className="text-xs text-red-400">Tap the <strong>lock icon</strong> in the address bar → <strong>Site settings</strong> → <strong>Camera</strong> → set to <strong>Allow</strong>, then tap Try again.</p>
            <p className="mt-3 text-sm text-red-300"><strong>Android — Chrome</strong></p>
            <p className="text-xs text-red-400">Tap the <strong>lock icon</strong> in the address bar → <strong>Camera</strong> → set to <strong>Allow</strong>, then tap Try again.</p>
            <button type="button" onClick={handleStartCamera}
              className="mt-4 rounded-lg bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-600">
              Try again
            </button>
          </div>
        )}
        {cameraError === 'generic' && (
          <div className="mt-3 shrink-0 rounded-xl bg-red-900/60 px-4 py-3 text-center ring-1 ring-red-500/40">
            <p className="text-sm text-red-200">Could not start the camera. Make sure you are using a secure (HTTPS) link and that camera permission is allowed.</p>
            <button type="button" onClick={handleStartCamera}
              className="mt-3 rounded-lg bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-600">
              Try again
            </button>
          </div>
        )}

        {/* Camera viewfinder */}
        <div className="flex min-h-0 flex-1 items-center justify-center px-1 py-1">
          <div className="relative mx-auto aspect-[3/4] h-full max-h-full w-auto max-w-full min-h-0 rounded-2xl bg-black shadow-xl ring-1 ring-white/10 sm:max-w-md overflow-hidden">
            <video ref={videoRef} playsInline muted autoPlay
              className="absolute inset-0 h-full w-full object-cover" />
            {/* Corner guides — only visible once stream is active */}
            {!isReady && !cameraError && (
              <div className="pointer-events-none absolute inset-3 sm:inset-5">
                <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-l-4 sm:border-t-4" />
                <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-r-4 sm:border-t-4" />
                <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-b-4 sm:border-l-4" />
                <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-b-4 sm:border-r-4" />
              </div>
            )}
            {/* Overlay shown before camera starts */}
            {isReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center px-4">
                <svg className="mb-3 h-14 w-14 text-teal-400 opacity-90" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <p className="text-white text-base font-semibold">Ready to take a photo</p>
                <p className="mt-1 text-gray-300 text-xs">Tap the button below to start the camera</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom action button */}
        <div className="flex shrink-0 justify-center pt-1">
          {isReady ? (
            <button type="button" onClick={handleStartCamera}
              className="rounded-xl bg-teal-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-teal-500 active:scale-95 transition-transform">
              Start camera
            </button>
          ) : !cameraError ? (
            <button type="button" onClick={handleCapture}
              className="rounded-xl bg-teal-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-teal-500 active:scale-95 transition-transform">
              Take photo
            </button>
          ) : null}
        </div>

      </div>
    </>
  )
}
