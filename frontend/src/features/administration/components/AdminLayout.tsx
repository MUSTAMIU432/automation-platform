import { Link, Outlet } from 'react-router-dom'

import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { AdminSidebar } from './AdminSidebar'
import { ErrorState, LoadingState } from './AdminUi'

/**
 * The administration console's shell: a distinct, dark "Administration"
 * navigation beside the page, inside the ordinary authenticated app shell.
 *
 * **The gate here is presentation.** A user without console access sees a
 * "not authorized" panel instead of the console, and the console's pages are
 * never mounted, so they never ask for data. But the actual boundary is the
 * server: every `admin*` query and mutation is authorized there, so typing
 * `/app/admin` or calling the API directly gets a non-administrator nothing.
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
    return (
      <section
        aria-labelledby="admin-forbidden-title"
        className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm"
      >
        <p className="text-xs font-bold tracking-widest text-slate-500 uppercase">403</p>
        <h1 id="admin-forbidden-title" className="mt-2 text-xl font-bold text-slate-900">
          Not authorized
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The administration console is for platform administrators. Being an owner or reviewer of
          an organization does not grant access to it.
        </p>
        <Link
          to="/app"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Back to your workspace
        </Link>
      </section>
    )
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
