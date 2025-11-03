import { supabase } from './supabase'
import type { UserProfile, Role } from '../types/auth'

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getUserProfile(userId?: string): Promise<UserProfile | null> {
  const user = userId ? { id: userId } : await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId || user.id)
    .single()

  if (error) {
    console.error('Error fetching user profile:', error)
    // If RLS error, try alternative approach
    if (error.code === 'PGRST301' || error.message?.includes('policy')) {
      console.log('RLS policy issue detected, attempting direct query...')
      // This should work because user can always see own profile
    }
    return null
  }
  
  if (!data) {
    console.log('No profile data returned for user:', userId || user.id)
    return null
  }
  
  return data as UserProfile
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = await getCurrentUser()
  if (!user) return null
  return getUserProfile(user.id)
}

export function hasRole(userProfile: UserProfile | null, roles: Role[]): boolean {
  if (!userProfile) return false
  return roles.includes(userProfile.role)
}

export function canAccessHospital(userProfile: UserProfile | null, hospitalId: string): boolean {
  if (!userProfile) return false
  if (userProfile.role === 'superadmin') return true
  return userProfile.hospital_id === hospitalId
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

