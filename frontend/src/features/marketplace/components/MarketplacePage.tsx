import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { marketIdeasRequest, type MarketIdea } from '../api/marketplaceApi'

function AccessBadge({ idea }: { idea: MarketIdea }) {
  if (idea.hasAccess) {
    return (
      <span className="shrink-0 rounded-full whitespace-nowrap bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        ✓ Unlocked
      </span>
    )
  }
  if (idea.myPurchase?.status === 'pending' || idea.myPurchase?.status === 'awaiting') {
    return (
      <span className="shrink-0 rounded-full whitespace-nowrap bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Payment being confirmed
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full whitespace-nowrap bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
      🔒 Locked
    </span>
  )
}

/**
 * The marketplace at `/app/marketplace`: ideas the platform publishes, each with its title and
 * summary. The price shows only on the idea's own page, where its documentation is unlocked.
 */
export function MarketplacePage() {
  const [ideas, setIdeas] = useState<MarketIdea[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    marketIdeasRequest()
      .then((answer) => {
        if (!cancelled) setIdeas(answer)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section aria-labelledby="marketplace-heading" className="mt-6">
      <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">Marketplace</p>
      <h1 id="marketplace-heading" className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
        Ideas ready to build
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Automation ideas prepared by the platform. Read the summary of any of them; unlock the full
        documentation - the detailed plan behind it - by paying for that idea.
      </p>

      {failed ? (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the marketplace. Please refresh the page.
        </p>
      ) : ideas === null ? (
        <p className="mt-6 text-sm text-gray-500">Loading the marketplace…</p>
      ) : ideas.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="font-semibold text-gray-900">No ideas are published yet.</p>
          <p className="mt-1 text-sm text-gray-600">Check back soon.</p>
        </div>
      ) : (
        <ul aria-label="Ideas for sale" className="mt-6 space-y-4">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <Link
                to={`/app/marketplace/${idea.id}`}
                className="group grid gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-8 sm:p-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AccessBadge idea={idea} />
                    {idea.hasDocument && (
                      <span className="text-xs font-medium text-gray-500">
                        📄 Includes a document
                      </span>
                    )}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900 group-hover:text-brand-800">
                    {idea.title}
                  </h2>
                  <p className="mt-1 line-clamp-3 max-w-4xl text-sm leading-6 text-gray-600 lg:line-clamp-2">
                    {idea.summary}
                  </p>
                </div>
                <div className="flex items-center justify-end border-t border-gray-100 pt-3 sm:border-t-0 sm:pt-0">
                  <span className="inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-sm group-hover:bg-brand-700">
                    {idea.hasAccess ? 'Read it →' : 'View idea →'}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
