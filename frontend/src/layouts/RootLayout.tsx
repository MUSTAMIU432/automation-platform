import { Outlet } from 'react-router-dom'

/**
 * Shared shell for all routes. Domain features render inside <Outlet />;
 * this stays free of any business-domain UI.
 */
export function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-gray-200 px-6 py-4">
        <span className="text-lg font-semibold text-gray-900">Automation Platform</span>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
