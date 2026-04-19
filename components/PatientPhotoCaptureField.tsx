import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { compressImageFileToDataUrl } from '../lib/compressImageToDataUrl'
import { PATIENT_SUMMARY_PHOTO_PLACEHOLDER } from './PatientSummaryCard'

type Props = {
  /**
   * When set, confirming on the phone writes `patient_photo` on that row.
   * When null (e.g. admissions before insert), the phone flow stores the image server-side; the same teal control is used twice: email link, then add here.
   */
  patientId: string | null
  value: string | null
  onChange: (next: string | null) => void
  disabled?: boolean
  readOnly?: boolean
}

export function PatientPhotoCaptureField({ patientId, value, onChange, disabled = false, readOnly = false }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [sendingLink, setSendingLink] = useState(false)
  const [pickingUp, setPickingUp] = useState(false)
  const [linkMessage, setLinkMessage] = useState('')
  const [linkError, setLinkError] = useState('')
  /** New admission only: after email link is sent, same right button pulls the photo onto this form. */
  const [admissionAwaitingPickup, setAdmissionAwaitingPickup] = useState(false)

  const canEdit = !readOnly && !disabled

  useEffect(() => {
    if (patientId) setAdmissionAwaitingPickup(false)
  }, [patientId])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await compressImageFileToDataUrl(file, { maxEdge: 1024, quality: 0.82 })
      onChange(dataUrl)
      setModalOpen(false)
    } catch {
      setLinkError('Could not read that image. Try another file.')
    }
  }

  const sendPhoneLink = async () => {
    setLinkError('')
    setLinkMessage('')
    setSendingLink(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setLinkError('Please sign in again.')
        return
      }
      const res = await fetch('/api/send-patient-photo-capture-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientId: patientId ?? null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkError(data.error || 'Failed to send email')
        return
      }
      if (!patientId) setAdmissionAwaitingPickup(true)
      setLinkMessage(data.message || 'Email sent. Open the link on your phone to take the photo.')
    } catch {
      setLinkError('Network error')
    } finally {
      setSendingLink(false)
    }
  }

  const pickupFromPhone = async () => {
    setLinkError('')
    setLinkMessage('')
    setPickingUp(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setLinkError('Please sign in again.')
        return
      }
      const res = await fetch('/api/patient-photo-pickup', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkError(data.error || 'Failed to load photo')
        return
      }
      if (data.photoDataUrl) {
        setAdmissionAwaitingPickup(false)
        onChange(data.photoDataUrl)
        setModalOpen(false)
      } else {
        setLinkMessage('No photo ready yet. Finish and confirm on your phone, then try again.')
      }
    } catch {
      setLinkError('Network error')
    } finally {
      setPickingUp(false)
    }
  }

  const handlePhoneColumnClick = async () => {
    if (patientId) {
      await sendPhoneLink()
      return
    }
    if (!admissionAwaitingPickup) {
      await sendPhoneLink()
      return
    }
    await pickupFromPhone()
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/50 p-4 text-center">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        Patient photo
      </label>
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
          {value && (value.startsWith('data:image') || value.startsWith('http')) ? (
            <img src={value} alt="Patient" className="h-full w-full object-cover" />
          ) : (
            <img
              src={PATIENT_SUMMARY_PHOTO_PLACEHOLDER}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      </div>

      {canEdit && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              setModalOpen(true)
              setLinkError('')
              setLinkMessage('')
            }}
            className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-2.5 text-gray-700 shadow-sm hover:border-lasso-teal hover:text-lasso-teal dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-lasso-teal"
            aria-label="Add or change patient photo"
            title="Add or change photo"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="patient-photo-modal-title"
        >
          <div className="max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800">
            <h2 id="patient-photo-modal-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Patient photo
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {patientId
                ? 'Upload a file from this device, or tap the phone icon to email yourself a link. When you confirm on the phone, the photo is saved to this patient.'
                : 'Upload a file from this device, or use the teal button twice: first tap emails a link to your phone; after you confirm the photo there, tap the same button again to add it to this form.'}
            </p>

            <div className="mt-4 flex flex-row gap-3">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                Upload
              </button>

              <button
                type="button"
                onClick={handlePhoneColumnClick}
                disabled={sendingLink || pickingUp}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-lasso-teal px-4 py-2.5 text-sm font-medium text-white hover:bg-lasso-blue disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={
                  !patientId && admissionAwaitingPickup
                    ? 'Add photo from phone to this form'
                    : 'Email link to capture photo on phone'
                }
                title={
                  !patientId && admissionAwaitingPickup
                    ? 'Add photo from phone to this form'
                    : 'Email link to capture photo on phone'
                }
              >
                {sendingLink ? (
                  'Sending…'
                ) : pickingUp ? (
                  'Adding…'
                ) : !patientId && admissionAwaitingPickup ? (
                  'Add here'
                ) : (
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                )}
              </button>
            </div>

            {linkMessage && <p className="mt-3 text-sm text-green-700 dark:text-green-300">{linkMessage}</p>}
            {linkError && <p className="mt-3 text-sm text-red-600 dark:text-red-300">{linkError}</p>}

            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setModalOpen(false)
                }}
                className="mt-3 text-sm text-red-600 hover:underline dark:text-red-400"
              >
                Remove photo
              </button>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false)
                  setLinkError('')
                  setLinkMessage('')
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
