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
        <div className="min-h-screen flex flex-col items-center p-4 pb-8 bg-gray-900 text-white">
          <h1 className="text-lg font-semibold mt-4 mb-1 text-center">Preview</h1>
          {patientName && <p className="text-sm text-gray-400 mb-4 text-center">{patientName}</p>}
          {previewDataUrl && (
            <img src={previewDataUrl} alt="Captured preview" className="max-w-full max-h-[60vh] rounded-xl border border-gray-600 shadow-lg" />
          )}
          {submitError && <p className="mt-3 text-sm text-red-300 text-center">{submitError}</p>}
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              onClick={handleRetake}
              disabled={status === 'submitting'}
              className="px-5 py-2.5 rounded-lg border border-gray-500 text-gray-200 hover:bg-gray-800 disabled:opacity-50"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={status === 'submitting'}
              className="px-5 py-2.5 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-500 disabled:opacity-50"
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
      <div className="min-h-screen flex flex-col bg-gray-900 text-white p-4">
        <h1 className="text-lg font-semibold text-center mt-2">Patient photo</h1>
        {patientName && <p className="text-sm text-gray-400 text-center mt-1">{patientName}</p>}
        <p className="text-xs text-gray-500 text-center mt-2 max-w-md mx-auto">
          Align the patient within the frame. Corners mark the crop area.
        </p>

        {cameraError && (
          <p className="mt-4 text-sm text-red-300 text-center max-w-md mx-auto">{cameraError}</p>
        )}

        <div className="flex-1 flex items-center justify-center py-4">
          <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-xl">
            <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
            {/* Corner guides */}
            <div className="pointer-events-none absolute inset-5">
              <div className="absolute left-0 top-0 h-14 w-14 rounded-tl-2xl border-l-4 border-t-4 border-teal-300 opacity-95 shadow-sm" />
              <div className="absolute right-0 top-0 h-14 w-14 rounded-tr-2xl border-r-4 border-t-4 border-teal-300 opacity-95 shadow-sm" />
              <div className="absolute bottom-0 left-0 h-14 w-14 rounded-bl-2xl border-b-4 border-l-4 border-teal-300 opacity-95 shadow-sm" />
              <div className="absolute bottom-0 right-0 h-14 w-14 rounded-br-2xl border-b-4 border-r-4 border-teal-300 opacity-95 shadow-sm" />
            </div>
          </div>
        </div>

        <div className="pb-safe flex justify-center">
          <button
            type="button"
            onClick={handleCapture}
            className="px-8 py-3 rounded-xl bg-teal-600 text-white font-semibold text-lg hover:bg-teal-500 shadow-lg"
          >
            Take photo
          </button>
        </div>
      </div>
    </>
  )
}
