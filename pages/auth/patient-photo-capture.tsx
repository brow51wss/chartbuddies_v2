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

  const [status, setStatus] = useState<'loading' | 'invalid' | 'camera' | 'preview' | 'submitting' | 'done'>('loading')
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
    return () => {
      stopStream()
    }
  }, [stopStream])

  useEffect(() => {
    if (typeof token !== 'string') return
    let cancelled = false
    fetch(`${API}?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (!data.valid) {
          setStatus('invalid')
          return
        }
        setPatientName(typeof data.patientName === 'string' ? data.patientName : '')
        setPhotoSavedToPatient(data.patientId != null && String(data.patientId).length > 0)
        setStatus('camera')
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (status !== 'camera') return
    setCameraError('')
    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          await v.play().catch(() => {})
        }
      } catch {
        if (!cancelled) setCameraError('Could not access the camera. Check permissions and use HTTPS.')
      }
    }
    void start()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [status, stopStream])

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
    setStatus('camera')
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

  if (status === 'loading') {
    return (
      <>
        <Head>
          <title>Patient photo - Lasso</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900 text-white">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-400" />
          <p className="mt-4 text-gray-300">Checking link…</p>
        </div>
      </>
    )
  }

  if (status === 'invalid') {
    return (
      <>
        <Head>
          <title>Link invalid - Lasso</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white">
          <div className="max-w-sm text-center">
            <h1 className="text-xl font-semibold mb-2">Link expired or invalid</h1>
            <p className="text-gray-300">Request a new link from the patient form on your computer.</p>
          </div>
        </div>
      </>
    )
  }

  if (status === 'done') {
    return (
      <>
        <Head>
          <title>Photo saved - Lasso</title>
        </Head>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-900 text-white">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-semibold text-teal-300">Photo saved</h1>
            <p className="text-gray-300">
              {photoSavedToPatient ? (
                <>
                  You can close this page. On your computer, refresh the patient screen or reopen edit patient details to see the updated photo.
                </>
              ) : (
                <>
                  You can close this page. On your computer, return to the admission form, open the patient photo dialog, and tap the teal{' '}
                  <strong>Add here</strong> button to place this picture in the chart.
                </>
              )}
            </p>
          </div>
        </div>
      </>
    )
  }

  if (status === 'preview' || status === 'submitting') {
    return (
      <>
        <Head>
          <title>Confirm photo - Lasso</title>
        </Head>
        <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-900 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white">
          <div className="shrink-0 space-y-0.5 text-center">
            <h1 className="text-base font-semibold leading-tight">Preview</h1>
            {patientName && <p className="truncate text-xs text-gray-400">{patientName}</p>}
          </div>
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-1">
            {previewDataUrl && (
              <img
                src={previewDataUrl}
                alt="Captured preview"
                className="max-h-full w-full max-w-md object-contain rounded-xl border border-gray-600 shadow-lg"
              />
            )}
          </div>
          {submitError && (
            <p className="shrink-0 px-1 py-1 text-center text-xs text-red-300">{submitError}</p>
          )}
          <div className="flex shrink-0 flex-wrap justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleRetake}
              disabled={status === 'submitting'}
              className="rounded-lg border border-gray-500 px-4 py-2 text-sm text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === 'submitting'}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
            >
              {status === 'submitting' ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Take patient photo - Lasso</title>
      </Head>
      <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-gray-900 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] text-white">
        <div className="shrink-0 space-y-0.5 text-center">
          <h1 className="text-base font-semibold leading-tight">Patient photo</h1>
          {patientName && <p className="truncate px-1 text-xs text-gray-400">{patientName}</p>}
          <p className="mx-auto max-w-md px-1 text-[10px] leading-snug text-gray-500">
            Align within the frame. Teal corners show the crop area.
          </p>
        </div>

        {cameraError && (
          <p className="mt-1 shrink-0 px-1 text-center text-xs text-red-300">{cameraError}</p>
        )}

        <div className="flex min-h-0 flex-1 items-center justify-center px-1 py-1">
          <div className="relative mx-auto aspect-[3/4] h-full max-h-full w-auto max-w-full min-h-0 rounded-2xl bg-black shadow-xl ring-1 ring-white/10 sm:max-w-md">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            {/* Corner guides */}
            <div className="pointer-events-none absolute inset-3 sm:inset-5">
              <div className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-[3px] border-t-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-l-4 sm:border-t-4" />
              <div className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-[3px] border-t-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-r-4 sm:border-t-4" />
              <div className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-[3px] border-l-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-b-4 sm:border-l-4" />
              <div className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-[3px] border-r-[3px] border-teal-300 opacity-95 sm:h-14 sm:w-14 sm:border-b-4 sm:border-r-4" />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-center pt-1">
          <button
            type="button"
            onClick={handleCapture}
            className="rounded-xl bg-teal-600 px-6 py-2.5 text-base font-semibold text-white shadow-lg hover:bg-teal-500"
          >
            Take photo
          </button>
        </div>
      </div>
    </>
  )
}
