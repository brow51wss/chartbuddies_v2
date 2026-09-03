import {
  rdsCreateProgressNote,
  rdsDeleteProgressNote,
  rdsListProgressNotes,
  rdsPatchProgressNote,
} from './rdsApi'

function linePrefix(timeLabel?: string, medicationName?: string): string {
  const timePart = timeLabel ? `(from MAR, ${timeLabel})` : '(from MAR)'
  const medPart = medicationName?.trim() ? ` [${medicationName.trim()}]` : ''
  return `${timePart}${medPart}`
}

function stripLine(text: string, prefix: string): string {
  return text
    .split('\n')
    .filter(line => !line.trim().startsWith(prefix))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function findDayNote(patientId: string, noteDate: string) {
  const allNotes = await rdsListProgressNotes(patientId, true)
  return allNotes.find((n: any) =>
    n.note_date && String(n.note_date).slice(0, 10) === noteDate && !n.source_mar_prn_record_id
  ) ?? null
}

export async function upsertMarAdminLineInProgressNotes(params: {
  patientId: string
  createdBy: string
  physicianName?: string | null
  noteDate: string
  timeLabel?: string
  medicationName?: string
  statusLabel: string
  note?: string | null
}): Promise<void> {
  const {
    patientId, createdBy, physicianName, noteDate,
    timeLabel, medicationName, statusLabel, note,
  } = params
  if (medicationName === 'VITALS') return

  const prefix = linePrefix(timeLabel, medicationName)
  const extra = (note || '').trim()
  const block = extra ? `${prefix} ${statusLabel}: ${extra}` : `${prefix} ${statusLabel}`

  const existing = await findDayNote(patientId, noteDate)
  if (existing) {
    const prev = stripLine((existing.notes || '').trim(), prefix)
    const newNotes = prev ? `${prev}\n\n${block}` : block
    await rdsPatchProgressNote(existing.id, { notes: newNotes, updated_at: new Date().toISOString() })
    return
  }

  await rdsCreateProgressNote({
    patient_id: patientId,
    note_date: noteDate,
    notes: block,
    signature: null,
    physician_name: physicianName ?? null,
    is_addendum: false,
    created_by: createdBy,
  })
}

export async function removeMarAdminLineFromProgressNotes(params: {
  patientId: string
  noteDate: string
  timeLabel?: string
  medicationName?: string
}): Promise<void> {
  const { patientId, noteDate, timeLabel, medicationName } = params
  const existing = await findDayNote(patientId, noteDate)
  if (!existing) return
  const prefix = linePrefix(timeLabel, medicationName)
  const cleaned = stripLine((existing.notes || '').trim(), prefix)
  if (cleaned) {
    await rdsPatchProgressNote(existing.id, { notes: cleaned, updated_at: new Date().toISOString() })
  } else {
    await rdsDeleteProgressNote(existing.id)
  }
}
