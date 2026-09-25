import { useNavigate } from 'react-router-dom'

import { useAuth } from '../features/identity/auth/AuthContext'
import { OrganizationSwitcher } from '../features/organizations/components/OrganizationSwitcher'
import { OrganizationWorkspace } from '../features/organizations/components/OrganizationWorkspace'

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  function handleLogout() {
    void logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Automation Platform
            </p>
            <p className="mt-0.5 text-sm text-gray-500">Authenticated workspace</p>
          </div>
          <div className="flex items-center gap-4">
            <OrganizationSwitcher />
            <span className="hidden text-sm text-gray-500 md:inline">{user?.email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand-700">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
            Choose where your work happens.
          </h1>
          <p className="mt-3 text-base leading-7 text-gray-600">
            Your organizations keep shared work together. Pick an existing workspace below or start
            a new one.
          </p>
        </div>

        <OrganizationWorkspace />
      </main>
    </div>
  )
}
