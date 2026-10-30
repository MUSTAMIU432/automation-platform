import { Navigate, Outlet } from 'react-router-dom'

import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { AdminSidebar } from './AdminSidebar'
import { ErrorState, LoadingState } from './AdminUi'

/**
 * The administration console's shell: a distinct, dark "Administration"
 * navigation beside the page, inside the ordinary authenticated app shell.
 *
 * **The gate here is presentation.** A user without console access goes to
 * their own dashboard instead, and the console's pages are never mounted, so
 * they never ask for data. No "not authorized" page: the usual way here is
 * signing in after an administrator's session ended on a console page (sign-in
 * returns to where it was asked for), and an everyday user who signs in should
 * simply land in their workspace. The actual boundary is the server: every
 * `admin*` query and mutation is authorized there, so typing `/app/admin` or
 * calling the API directly gets a non-administrator nothing.
 * An unauthenticated visitor never reaches this component - `RequireAuth`
 * sends them to sign in first.
 */
export function AdminLayout() {
  const { status, capabilities, reload } = useAdminCapabilities()

  if (status === 'loading') {
    return <LoadingState label="Checking administrator access…" />
  }
  if (status === 'error') {
    return (
      <ErrorState
        message="We could not check your administrator access. Please try again."
        onRetry={reload}
      />
    )
  }
  if (!capabilities.canAccessConsole) {
    return <Navigate to="/app" replace />
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
