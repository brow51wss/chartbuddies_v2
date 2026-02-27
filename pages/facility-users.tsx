import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import ProtectedRoute from '../components/ProtectedRoute'
import AppHeader from '../components/AppHeader'
import { supabase } from '../lib/supabase'
import { getCurrentUserProfile } from '../lib/auth'
import type { UserProfile } from '../types/auth'

interface FacilityUserRow {
  id: string
  first_name: string | null
  middle_name: string | null
  last_name: string | null
  email: string
  role: string
  designation: string | null
  invited_at: string | null
  invite_code: string | null
  verified_at: string | null
}

export default function FacilityUsersPage() {
  const router = useRouter()
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [rows, setRows] = useState<FacilityUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile()
      if (!profile) {
        router.push('/auth/login')
        return
      }

      // Only facility superadmins/PCG (superadmin with hospital_id) can view this page
      if (profile.role !== 'superadmin' || !profile.hospital_id) {
        router.push('/dashboard')
        return
      }

      setUserProfile(profile)

      try {
        // Load users in this facility
        const { data: users, error: usersError } = await supabase
          .from('user_profiles')
          .select('id, email, first_name, middle_name, last_name, role, designation')
          .eq('hospital_id', profile.hospital_id)
          .order('first_name', { ascending: true })

        if (usersError) {
          console.error('Error loading facility users:', usersError)
          setError('Failed to load facility users')
          setLoading(false)
          return
        }

        // Load invites for this facility
        const { data: invites, error: invitesError } = await supabase
          .from('facility_invites')
          .select('id, code, designation, invited_email, invited_at, used_by, used_at')
          .eq('hospital_id', profile.hospital_id)

        if (invitesError) {
          console.error('Error loading invites:', invitesError)
          setError('Failed to load facility invites')
          setLoading(false)
          return
        }

        const invitesByUserId = new Map<string, { invited_at: string | null; invite_code: string | null; verified_at: string | null }>()
        ;(invites || []).forEach((inv) => {
          if (!inv.used_by) return
          const existing = invitesByUserId.get(inv.used_by)
          // Prefer the most recent invite if there are multiple
          if (!existing || (inv.invited_at && (!existing.invited_at || inv.invited_at > existing.invited_at))) {
            invitesByUserId.set(inv.used_by, {
              invited_at: inv.invited_at ?? null,
              invite_code: inv.code ?? null,
              verified_at: inv.used_at ?? null,
            })
          }
        })

        // Rows for verified/active users in the facility
        const userRows: FacilityUserRow[] = (users || []).map((u) => {
          const inviteInfo = invitesByUserId.get(u.id) || null
          return {
            id: u.id,
            first_name: (u as any).first_name ?? null,
            middle_name: (u as any).middle_name ?? null,
            last_name: (u as any).last_name ?? null,
            email: u.email,
            role: u.role,
            designation: u.designation,
            invited_at: inviteInfo?.invited_at ?? null,
            invite_code: inviteInfo?.invite_code ?? null,
            verified_at: inviteInfo?.verified_at ?? null,
          }
        })

        // Rows for invites sent but not yet verified (no account yet)
        const pendingInviteRows: FacilityUserRow[] = (invites || [])
          .filter((inv) => !inv.used_by && inv.invited_email)
          .map((inv) => ({
            id: `invite-${inv.id}`,
            first_name: null,
            middle_name: null,
            last_name: null,
            email: inv.invited_email!,
            role: '—',
            designation: inv.designation ?? null,
            invited_at: inv.invited_at ?? null,
            invite_code: inv.code ?? null,
            verified_at: null,
          }))

        // Combine: verified users first (by name), then pending invites (by date invited, newest first)
        const sortedUsers = [...userRows].sort((a, b) => {
          const aName = [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' ')
          const bName = [b.first_name, b.middle_name, b.last_name].filter(Boolean).join(' ')
          return (aName || '—').localeCompare(bName || '—')
        })
        const sortedPending = [...pendingInviteRows].sort((a, b) => {
          const aAt = a.invited_at || ''
          const bAt = b.invited_at || ''
          return bAt.localeCompare(aAt)
        })
        setRows([...sortedUsers, ...sortedPending])
        setLoading(false)
      } catch (err) {
        console.error('Error loading facility users overview:', err)
        setError('Failed to load facility users')
        setLoading(false)
      }
    }

    load()
  }, [router])

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-lasso-teal" />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Head>
        <title>Facility Users | Lasso EHR</title>
      </Head>
      <AppHeader userProfile={userProfile} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-gray-600 dark:text-gray-400 hover:text-lasso-teal">
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Facility Users</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Users assigned to your facility. For each user you can see their name, email, designation, and whether they joined via an invite.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-md">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Designation</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Date Invited</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Invite Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Date Verified</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      No users found for this facility.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const fullName = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ') || '—'
                    const dateInvited = row.invited_at ? new Date(row.invited_at).toLocaleString() : '—'
                    const dateVerified = row.verified_at ? new Date(row.verified_at).toLocaleString() : '—'
                    const status =
                      row.verified_at ? 'Verified' : row.invited_at ? 'Invited (pending)' : 'Active (no invite record)'

                    return (
                      <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/60">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{fullName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.email}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200 capitalize">{row.role}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{row.designation || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{dateInvited}</td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-800 dark:text-gray-100 tracking-widest">
                          {row.invite_code || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-200">{dateVerified}</td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              row.verified_at
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200'
                                : row.invited_at
                                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200'
                            }`}
                          >
                            {status}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  )
}

