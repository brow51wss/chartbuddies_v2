import type { SupabaseClient } from '@supabase/supabase-js'

/** Normalize MAR-style month/year (e.g. "February 2026", "2026-02") to YYYY-MM for progress_note_monthly_summaries. */
export function monthYearToYYYYMM(monthYear: string): string | null {
  const raw = String(monthYear || '').trim().replace(/\//g, '-')
  const parts = raw.split('-').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n))
  let y = parts[0]
  let m = parts[1]
  if (parts.length >= 2 && m > 12) {
    ;[y, m] = [m, y]
  }
  if (y && m && m >= 1 && m <= 12) {
    return `${y}-${String(m).padStart(2, '0')}`
  }
  const months: Record<string, number> = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  }
  const lower = raw.toLowerCase()
  for (const [name, num] of Object.entries(months)) {
    if (lower.includes(name)) {
      const match = raw.match(/\b(19|20)\d{2}\b/)
      const year = match ? parseInt(match[0], 10) : new Date().getFullYear()
      return `${year}-${String(num).padStart(2, '0')}`
    }
  }
  return null
}

/** Ensure a progress_note_monthly_summary exists for this patient + month (e.g. when a MAR is created). */
export async function ensureProgressNoteSummaryForMonth(
  supabase: SupabaseClient,
  patientId: string,
  monthYear: string,
  createdBy: string
): Promise<void> {
  const monthKey = monthYearToYYYYMM(monthYear)
  if (!monthKey) return
  const { data: existing } = await supabase
    .from('progress_note_monthly_summaries')
    .select('id')
    .eq('patient_id', patientId)
    .eq('month_year', monthKey)
    .limit(1)
    .maybeSingle()
  if (existing) return
  await supabase.from('progress_note_monthly_summaries').insert({
    patient_id: patientId,
    month_year: monthKey,
    created_by: createdBy
  })
}
