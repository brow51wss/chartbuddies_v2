import type { SupabaseClient } from '@supabase/supabase-js'
import { formatTimeDisplay } from '../components/TimeInput'
import type { MARPRNRecord } from '../types/mar'

function marPrnHasDocumentedHour(record: MARPRNRecord): boolean {
  const h = record.hour
  if (h == null) return false
  return String(h).trim().length > 0
}

/**
 * Upsert/delete linked Progress Notes is driven by MAR documentation completeness, not PRN staff_signature.
 * Signature for the legal record is applied on the Progress Notes entry when required.
 * Requires time, result, and initials (same sequence as the MAR PRN UI).
 */
export function shouldSyncMarPrnRecordToProgressNotes(record: MARPRNRecord): boolean {
  if (!marPrnHasDocumentedHour(record)) return false
  if (!(record.result && String(record.result).trim())) return false
  if (!(record.initials && String(record.initials).trim())) return false
  return true
}

/** YYYY-MM-DD for progress_note_entries.note_date */
export function prnRecordNoteDate(record: MARPRNRecord): string {
  const raw = (record.date || '').trim()
  if (raw.length >= 10) return raw.slice(0, 10)
  return new Date().toISOString().slice(0, 10)
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

export async function upsertProgressNoteFromPRNRecord(
  supabase: SupabaseClient,
  params: {
    patientId: string
    record: MARPRNRecord
    physicianName: string | null
    createdBy: string
  }
): Promise<void> {
  const { patientId, record, physicianName, createdBy } = params
  const noteDate = prnRecordNoteDate(record)
  const notes = formatPRNProgressNoteBody(record)

  const { data: existing, error: fetchError } = await supabase
    .from('progress_note_entries')
    .select('id')
    .eq('source_mar_prn_record_id', record.id)
    .maybeSingle()

  if (fetchError) throw new Error(`Progress note lookup failed: ${fetchError.message}`)

  if (!shouldSyncMarPrnRecordToProgressNotes(record)) {
    if (existing?.id) {
      const { error: delError } = await supabase.from('progress_note_entries').delete().eq('id', existing.id)
      if (delError) throw new Error(`Progress note delete failed: ${delError.message}`)
    }
    return
  }

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('progress_note_entries')
      .update({
        note_date: noteDate,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updateError) throw new Error(`Progress note update failed: ${updateError.message}`)
    return
  }

  const { error: insertError } = await supabase.from('progress_note_entries').insert({
    patient_id: patientId,
    note_date: noteDate,
    notes,
    signature: null,
    physician_name: physicianName,
    is_addendum: false,
    created_by: createdBy,
    source_mar_prn_record_id: record.id,
  })
  if (insertError) throw new Error(`Progress note insert failed: ${insertError.message}`)
}

/**
 * Removes the Progress Note row linked to this MAR PRN record, if any.
 * Refuses when the note has a signature (audit / legal integrity).
 */
export async function deleteLinkedProgressNoteForMarPrnRecordId(
  supabase: SupabaseClient,
  recordId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: row, error } = await supabase
    .from('progress_note_entries')
    .select('id, signature')
    .eq('source_mar_prn_record_id', recordId)
    .maybeSingle()

  if (error) return { ok: false, reason: `Progress note lookup failed: ${error.message}` }
  if (!row) return { ok: true }

  const sig = row.signature != null ? String(row.signature).trim() : ''
  if (sig.length > 0) {
    return {
      ok: false,
      reason:
        'This administration is linked to a signed Progress Note. Change or remove the signature in Progress Notes before deleting this MAR row.',
    }
  }

  const { error: delError } = await supabase.from('progress_note_entries').delete().eq('id', row.id)
  if (delError) return { ok: false, reason: `Progress note delete failed: ${delError.message}` }
  return { ok: true }
}

export async function upsertProgressNoteFromMarPrnRecordId(
  supabase: SupabaseClient,
  params: {
    recordId: string
    patientId: string
    physicianName: string | null
    createdBy: string
  }
): Promise<void> {
  const { data: row, error } = await supabase
    .from('mar_prn_records')
    .select('*')
    .eq('id', params.recordId)
    .single()

  if (error) throw new Error(`Failed to load PRN record: ${error.message}`)
  if (!row) return

  await upsertProgressNoteFromPRNRecord(supabase, {
    patientId: params.patientId,
    record: row as MARPRNRecord,
    physicianName: params.physicianName,
    createdBy: params.createdBy,
  })
}
