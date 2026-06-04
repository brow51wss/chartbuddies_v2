/**
 * Client-side helpers for calling /api/rds/* routes.
 * All calls attach the current Supabase session token so the API layer
 * can verify identity and enforce facility-level access control.
 */

import { supabase } from './supabase'

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function rdsApiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export async function rdsListPatients(): Promise<any[]> {
  return rdsApiFetch('/api/rds/patients')
}

export async function rdsGetPatient(id: string): Promise<any> {
  return rdsApiFetch(`/api/rds/patients/${id}`)
}

export async function rdsCreatePatient(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/patients', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchPatient(id: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeletePatient(id: string): Promise<void> {
  return rdsApiFetch(`/api/rds/patients/${id}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// MAR Forms
// ---------------------------------------------------------------------------

export async function rdsListMarForms(patientId: string): Promise<any[]> {
  return rdsApiFetch(`/api/rds/mar/forms?patient_id=${patientId}`)
}

export async function rdsGetMarForm(formId: string): Promise<any> {
  return rdsApiFetch(`/api/rds/mar/forms/${formId}`)
}

export async function rdsCreateMarForm(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/forms', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchMarForm(formId: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/mar/forms/${formId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeleteMarForm(formId: string): Promise<void> {
  return rdsApiFetch(`/api/rds/mar/forms/${formId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// MAR Medications
// ---------------------------------------------------------------------------

export async function rdsListMarMedications(marFormId: string): Promise<any[]> {
  return rdsApiFetch(`/api/rds/mar/medications?mar_form_id=${marFormId}`)
}

export async function rdsCreateMarMedication(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/medications', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchMarMedication(medId: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/mar/medications/${medId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeleteMarMedication(medId: string): Promise<void> {
  return rdsApiFetch(`/api/rds/mar/medications/${medId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// MAR Administrations
// ---------------------------------------------------------------------------

export async function rdsUpsertAdministration(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/administrations', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// MAR Vital Signs
// ---------------------------------------------------------------------------

export async function rdsUpsertVitalSigns(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/vital-signs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ---------------------------------------------------------------------------
// MAR PRN Medications
// ---------------------------------------------------------------------------

export async function rdsListPrnMedications(marFormId: string): Promise<any[]> {
  return rdsApiFetch(`/api/rds/mar/prn-medications?mar_form_id=${marFormId}`)
}

export async function rdsCreatePrnMedication(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/prn-medications', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchPrnMedication(prnMedId: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/mar/prn-medications/${prnMedId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeletePrnMedication(prnMedId: string): Promise<void> {
  return rdsApiFetch(`/api/rds/mar/prn-medications/${prnMedId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// MAR PRN Records
// ---------------------------------------------------------------------------

export async function rdsListPrnRecords(marFormId: string): Promise<any[]> {
  return rdsApiFetch(`/api/rds/mar/prn-records?mar_form_id=${marFormId}`)
}

export async function rdsCreatePrnRecord(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/mar/prn-records', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchPrnRecord(prnRecordId: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/mar/prn-records/${prnRecordId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeletePrnRecord(prnRecordId: string): Promise<void> {
  return rdsApiFetch(`/api/rds/mar/prn-records/${prnRecordId}`, { method: 'DELETE' })
}

// ---------------------------------------------------------------------------
// Progress Notes
// ---------------------------------------------------------------------------

export async function rdsListProgressNotes(patientId: string, includeAddendums = false): Promise<any[]> {
  return rdsApiFetch(
    `/api/rds/progress-notes?patient_id=${patientId}${includeAddendums ? '&include_addendums=true' : ''}`,
  )
}

export async function rdsGetProgressNoteByPrnRecordId(prnRecordId: string): Promise<any | null> {
  return rdsApiFetch(`/api/rds/progress-notes?source_mar_prn_record_id=${prnRecordId}`)
}

export async function rdsCreateProgressNote(body: Record<string, any>): Promise<any> {
  return rdsApiFetch('/api/rds/progress-notes', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function rdsPatchProgressNote(noteId: string, body: Record<string, any>): Promise<any> {
  return rdsApiFetch(`/api/rds/progress-notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function rdsDeleteProgressNote(noteId: string): Promise<void> {
  return rdsApiFetch(`/api/rds/progress-notes/${noteId}`, { method: 'DELETE' })
}
