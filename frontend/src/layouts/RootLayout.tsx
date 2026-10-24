import { Link, Outlet } from 'react-router-dom'

/**
 * Shared shell for all routes. Domain features render inside <Outlet />;
 * this stays free of any business-domain UI.
 */
export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-gray-900 hover:text-brand-700">
          MUSTANET
        </Link>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
