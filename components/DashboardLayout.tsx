import type { UserProfile, Patient } from '../types/auth'
import AppShellHeader from './AppShellHeader'

function patientInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'
}

function calcAge(dob: string): string {
  if (!dob) return '—'
  const d = new Date(dob + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  const t = new Date()
  let a = t.getFullYear() - d.getFullYear()
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--
  return String(a)
}

interface DashboardLayoutProps {
  userProfile: UserProfile | null
  facilityName: string
  patients: Patient[]
  loadingPatients: boolean
  selectedPatientId: string | null
  onSelectPatient: (id: string) => void
  onAddPatient: () => void
  children: React.ReactNode
}

export default function DashboardLayout({
  userProfile,
  facilityName,
  patients,
  loadingPatients,
  selectedPatientId,
  onSelectPatient,
  onAddPatient,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex flex-col bg-[#f4f7f7] dark:bg-gray-900" style={{ height: '100dvh' }}>
      <AppShellHeader
        userProfile={userProfile}
        facilityName={facilityName}
        onAddPatient={onAddPatient}
      />

      {/* ══════════════ BODY ══════════════ */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-[270px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0 overflow-y-auto">
          <div className="px-4 pt-5 pb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-gray-400 dark:text-gray-500 m-0">
              Residents
            </h2>
          </div>

          <div className="px-2 pb-4 flex-1">
            {loadingPatients ? (
              <p className="px-3 py-3 text-sm text-gray-400">Loading...</p>
            ) : patients.length === 0 ? (
              <p className="px-3 py-3 text-sm text-gray-400">No residents yet.</p>
            ) : (
              patients.map(p => {
                const isActive = p.id === selectedPatientId
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectPatient(p.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[14px] mb-1.5 text-left transition-colors ${
                      isActive
                        ? 'bg-teal-50 dark:bg-teal-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <span className={`w-[42px] h-[42px] rounded-full flex-shrink-0 grid place-items-center font-extrabold text-base ${
                      isActive
                        ? 'bg-lasso-teal text-white'
                        : 'bg-teal-50 dark:bg-gray-700 text-lasso-teal dark:text-teal-300'
                    }`}>
                      {patientInitials(p.patient_name)}
                    </span>
                    <span className="flex flex-col leading-snug min-w-0">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white truncate">
                        {p.patient_name}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Age {calcAge(p.date_of_birth)}
                      </span>
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-7">
          <div className="w-full max-w-[1120px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
