import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">404</h1>
      <p className="text-gray-600">Page not found.</p>
      <Link to="/" className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-800">
        Go to the homepage
      </Link>
    </div>
  )
}
