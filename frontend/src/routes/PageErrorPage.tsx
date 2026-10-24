import { useEffect } from 'react'
import { Link, useRouteError } from 'react-router-dom'

/**
 * What a page shows when it fails to render, inside the app's own header and navigation
 * rather than the router's developer screen. The error itself goes to the console for
 * whoever debugs it; the reader gets a plain way to try again or leave.
 */
export function PageErrorPage() {
  const error = useRouteError()
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section
      role="alert"
      className="mx-auto mt-10 max-w-xl rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center shadow-sm"
    >
      <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">
        Something went wrong
      </p>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">This page could not be shown.</h1>
      <p className="mt-2 text-sm text-gray-600">
        Reloading usually fixes it - especially after the platform has just been updated. If it
        keeps happening, tell the platform team what you were doing.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
        >
          Reload the page
        </button>
        <Link
          to="/app"
          className="inline-flex h-10 items-center rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50"
        >
          Go home
        </Link>
      </div>
    </section>
  )
}
