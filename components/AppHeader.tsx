import AppShellHeader from './AppShellHeader'
import type { UserProfile } from '../types/auth'

interface AppHeaderProps {
  userProfile?: UserProfile | null
  onLogout?: () => void | Promise<void>
  patientId?: string
  patientName?: string
}

/** Thin alias so every existing page uses the current Resident Records header. */
export default function AppHeader({ userProfile, onLogout, patientId, patientName }: AppHeaderProps) {
  return (
    <AppShellHeader
      userProfile={userProfile}
      onLogout={onLogout}
      patientId={patientId}
      patientName={patientName}
    />
  )
}
