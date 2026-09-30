import type { SupabaseClient } from '@supabase/supabase-js'

export const FACILITY_MONTHLY_CENTS = 2999
export const EXTRA_NURSE_MONTHLY_CENTS = 499
export const INCLUDED_NURSE_SEATS = 2
export const TRIAL_DAYS = 14
export const PAST_DUE_GRACE_DAYS = 7
export const BILLING_SELECT =
  'hospital_id, billing_user_id, status, trial_ends_at, past_due_since, included_nurse_seats, extra_nurse_seats, stripe_customer_id, stripe_subscription_id, stripe_extra_item_id'

export type FacilityBillingStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'grandfathered'

export type FacilitySubscription = {
  hospital_id: string
  billing_user_id: string | null
  status: FacilityBillingStatus
  trial_ends_at: string | null
  past_due_since: string | null
  included_nurse_seats: number
  extra_nurse_seats: number
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  stripe_extra_item_id: string | null
}

export function isPlatformAdmin(profile: { role: string; hospital_id: string | null }): boolean {
  return profile.role === 'superadmin' && !profile.hospital_id
}

export function isFacilityPcg(profile: { role: string; hospital_id: string | null }): boolean {
  return profile.role === 'superadmin' && Boolean(profile.hospital_id)
}

export function isMissingBillingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  const message = (error.message || '').toLowerCase()
  return error.code === '42P01' || error.code === 'PGRST205' || message.includes('facility_subscriptions')
}

export function allowedNurseSeats(sub: FacilitySubscription): number {
  return Math.max(0, (sub.included_nurse_seats || INCLUDED_NURSE_SEATS) + (sub.extra_nurse_seats || 0))
}

export function isNurseSeatRole(role: string): boolean {
  return role === 'nurse' || role === 'head_nurse'
}

/** Oldest nurses keep the included seats. Everyone after the cap is over-seat. */
export function seatedNurseIds(
  nurses: { id: string; created_at: string }[],
  allowed: number
): Set<string> {
  const sorted = [...nurses].sort((a, b) => {
    const timeA = new Date(a.created_at).getTime()
    const timeB = new Date(b.created_at).getTime()
    if (timeA !== timeB) return timeA - timeB
    return a.id.localeCompare(b.id)
  })
  return new Set(sorted.slice(0, Math.max(0, allowed)).map((nurse) => nurse.id))
}

export function trialDaysRemaining(sub: FacilitySubscription, now = new Date()): number | null {
  if (sub.status !== 'trialing' || !sub.trial_ends_at) return null
  const end = new Date(sub.trial_ends_at).getTime()
  if (Number.isNaN(end)) return null
  return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000))
}

export function facilityHasAccess(sub: FacilitySubscription | null, now = new Date()): boolean {
  if (!sub) return false
  if (sub.status === 'active') return true
  if (sub.status === 'past_due') {
    const since = sub.past_due_since ? new Date(sub.past_due_since).getTime() : NaN
    if (Number.isNaN(since)) return false
    return now.getTime() - since < PAST_DUE_GRACE_DAYS * 86_400_000
  }
  if (sub.status === 'trialing') {
    if (!sub.trial_ends_at) return false
    return new Date(sub.trial_ends_at).getTime() > now.getTime()
  }
  return false
}

export async function assertSubscriptionWrite(
  result: { data: { hospital_id: string }[] | null; error: { message?: string } | null }
): Promise<void> {
  if (result.error) throw new Error(result.error.message || 'facility_subscriptions write failed')
  if (!result.data?.length) throw new Error('facility_subscriptions write matched 0 rows')
}

export async function countActiveNurses(
  admin: SupabaseClient,
  hospitalId: string
): Promise<number> {
  const { count, error } = await admin
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('hospital_id', hospitalId)
    .in('role', ['nurse', 'head_nurse'])
    .eq('is_active', true)

  if (error) throw error
  return count ?? 0
}

export async function getFacilitySubscription(
  admin: SupabaseClient,
  hospitalId: string
): Promise<{ subscription: FacilitySubscription | null; tableMissing: boolean }> {
  const { data, error } = await admin
    .from('facility_subscriptions')
    .select(
      BILLING_SELECT
    )
    .eq('hospital_id', hospitalId)
    .maybeSingle()

  if (error) {
    if (isMissingBillingTable(error)) return { subscription: null, tableMissing: true }
    throw error
  }
  return { subscription: (data as FacilitySubscription | null) ?? null, tableMissing: false }
}

export async function getOrCreateFacilitySubscription(
  admin: SupabaseClient,
  hospitalId: string,
  billingUserId?: string | null
): Promise<{ subscription: FacilitySubscription | null; tableMissing: boolean }> {
  const existing = await getFacilitySubscription(admin, hospitalId)
  if (existing.tableMissing || existing.subscription) return existing

  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
  const { data, error } = await admin
    .from('facility_subscriptions')
    .insert({
      hospital_id: hospitalId,
      billing_user_id: billingUserId ?? null,
      status: 'trialing',
      trial_ends_at: trialEnds,
      included_nurse_seats: INCLUDED_NURSE_SEATS,
      extra_nurse_seats: 0,
    })
    .select(
      BILLING_SELECT
    )
    .single()

  if (error) {
    if (isMissingBillingTable(error)) return { subscription: null, tableMissing: true }
    if (error.code === '23505') return getFacilitySubscription(admin, hospitalId)
    throw error
  }

  return { subscription: data as FacilitySubscription, tableMissing: false }
}
