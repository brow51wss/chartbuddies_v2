/**
 * RDS-based equivalents of the Supabase helpers in lib/prn-progress-notes.ts.
 * These use the /api/rds/* routes instead of Supabase directly.
 */

import { formatTimeDisplay } from '../components/TimeInput'
import type { MARPRNRecord } from '../types/mar'
import { localTodayYMD, ymdFromDateInput } from './calendarDate'
import {
  rdsGetProgressNoteByPrnRecordId,
  rdsCreateProgressNote,
  rdsPatchProgressNote,
  rdsDeleteProgressNote,
  rdsListPrnRecords,
} from './rdsApi'

// ---------------------------------------------------------------------------
// Helpers shared with the original module
// ---------------------------------------------------------------------------

function marPrnHasDocumentedHour(record: MARPRNRecord): boolean {
  const h = record.hour
  if (h == null) return false
  return String(h).trim().length > 0
}

export function shouldSyncMarPrnRecordToProgressNotes(record: MARPRNRecord): boolean {
  // Require initials (who logged it). Hour is informational only — the note body
  // already handles a missing time gracefully, so we don't gate sync on it.
  if (!(record.initials && String(record.initials).trim())) return false
  return true
}

export function prnRecordNoteDate(record: MARPRNRecord): string {
  const raw = ymdFromDateInput(record.date)
  if (raw.length >= 10) return raw
  return localTodayYMD()
}

export function formatPRNProgressNoteBody(record: MARPRNRecord): string {
  const timeLabel = record.hour ? formatTimeDisplay(record.hour) : null
  const header = timeLabel ? `(from MAR PRN, ${timeLabel})` : '(from MAR PRN)'
  const lines = [
    header,
    `Medication: ${(record.medication || '').trim() || '—'}`,
    `Dosage: ${(record.dosage || '').trim() || '—'}`,
    `Reason/Indication: ${(record.reason || '').trim() || '—'}`,
  ]
  if ((record.note || '').trim()) {
    lines.push(`Additional note: ${(record.note || '').trim()}`)
  }
  lines.push(`Result: ${(record.result || '').trim() || '—'}`)
  const inits = (record.initials || '').trim()
  if (inits) {
    lines.push(`MAR initials: ${inits}`)
  }
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// RDS versions of the upsert / delete helpers
// ---------------------------------------------------------------------------

export async function upsertProgressNoteFromPRNRecordRds(params: {
  patientId: string
  record: MARPRNRecord
  physicianName: string | null
  createdBy: string
}): Promise<void> {
  const { patientId, record, physicianName, createdBy } = params
  const noteDate = prnRecordNoteDate(record)
  const notes = formatPRNProgressNoteBody(record)

  const existing = await rdsGetProgressNoteByPrnRecordId(record.id)

  if (!shouldSyncMarPrnRecordToProgressNotes(record)) {
    if (existing?.id) {
      await rdsDeleteProgressNote(existing.id)
    }
    return
  }

  if (existing?.id) {
    await rdsPatchProgressNote(existing.id, {
      note_date: noteDate,
      notes,
      updated_at: new Date().toISOString(),
    })
    return
  }

  await rdsCreateProgressNote({
    patient_id: patientId,
    note_date: noteDate,
    notes,
    signature: null,
    physician_name: physicianName,
    is_addendum: false,
    created_by: createdBy,
    source_mar_prn_record_id: record.id,
  })
}

export async function deleteLinkedProgressNoteForMarPrnRecordIdRds(
  recordId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  let row: any = null
  try {
    row = await rdsGetProgressNoteByPrnRecordId(recordId)
  } catch (e: any) {
    return { ok: false, reason: `Progress note lookup failed: ${e.message}` }
  }

  if (!row) return { ok: true }

  const sig = row.signature != null ? String(row.signature).trim() : ''
  if (sig.length > 0) {
    return {
      ok: false,
      reason:
        'This administration is linked to a signed Progress Note. Change or remove the signature in Progress Notes before deleting this MAR row.',
    }
  }

  try {
    await rdsDeleteProgressNote(row.id)
  } catch (e: any) {
    return { ok: false, reason: `Progress note delete failed: ${e.message}` }
  }
  return { ok: true }
}

export async function upsertProgressNoteFromMarPrnRecordIdRds(params: {
  recordId: string
  marFormId: string
  patientId: string
  physicianName: string | null
  createdBy: string
}): Promise<void> {
  const records = await rdsListPrnRecords(params.marFormId)
  const row = records.find((r: any) => r.id === params.recordId)
  if (!row) return
  await upsertProgressNoteFromPRNRecordRds({
    patientId: params.patientId,
    record: row as MARPRNRecord,
    physicianName: params.physicianName,
    createdBy: params.createdBy,
  })
}
