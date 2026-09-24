import { useNavigate } from 'react-router-dom'

import { useAuth } from '../features/identity/auth/AuthContext'

/**
 * Minimal placeholder for the authenticated application area. S1-003 is
 * about proving the login/session lifecycle end to end, not building any
 * real product surface - that starts with later Identity/domain tasks.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">Automation Platform</h1>
      <p className="text-gray-600">
        Signed in as <span className="font-medium text-gray-900">{user?.email}</span>.
      </p>
      <button
        type="button"
        onClick={handleLogout}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        Sign out
      </button>
    </div>
  )
}
