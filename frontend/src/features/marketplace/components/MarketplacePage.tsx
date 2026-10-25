import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  CheckCircleIcon,
  DocumentIcon,
  FlowIcon,
  PencilIcon,
  SearchIcon,
} from '../../../components/AppIcons'
import { formatFileSize } from '../../ideas/utils/attachmentRules'
import { formatPrice, marketIdeasRequest, type MarketIdea } from '../api/marketplaceApi'

type Filter = 'all' | 'available' | 'unlocked'
type Sort = 'featured' | 'newest' | 'price-asc' | 'price-desc'

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'unlocked', label: 'Unlocked' },
]

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'featured', label: 'Featured' },
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
]

/** Each card's cover, chosen by the idea's id so it stays the same between visits. */
const COVERS = [
  'from-brand-700 via-brand-600 to-teal-500',
  'from-teal-700 via-teal-600 to-sky-500',
  'from-emerald-700 via-brand-600 to-brand-400',
  'from-brand-800 via-teal-700 to-cyan-500',
]

function coverFor(id: string): string {
  const sum = [...id].reduce((total, char) => total + char.charCodeAt(0), 0)
  return COVERS[sum % COVERS.length]
}

function isPending(idea: MarketIdea): boolean {
  return idea.myPurchase?.status === 'pending' || idea.myPurchase?.status === 'awaiting'
}

function AccessBadge({ idea }: { idea: MarketIdea }) {
  const base =
    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm backdrop-blur'
  if (idea.hasAccess) {
    return <span className={`${base} bg-white text-emerald-800`}>✓ Unlocked</span>
  }
  if (isPending(idea)) {
    return <span className={`${base} bg-amber-50 text-amber-800`}>Payment being confirmed</span>
  }
  return <span className={`${base} bg-white/20 text-white ring-1 ring-white/40`}>🔒 Locked</span>
}

/**
 * The marketplace at `/app/marketplace`: the documentation the platform sells for its
 * automation ideas. Each card says what the package holds - the implementation guide and the
 * written plan - and what unlocking it costs; the idea's own page is where it is bought and read.
 *
 * Search, filtering and sorting are all on the list already loaded: the catalogue is the
 * platform's own and small, so there is nothing to page through on the server.
 */
export function MarketplacePage() {
  const [ideas, setIdeas] = useState<MarketIdea[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('featured')

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

  const shown = useMemo(() => {
    if (ideas === null) return []
    const needle = query.trim().toLowerCase()
    const matching = ideas.filter((idea) => {
      if (filter === 'available' && idea.hasAccess) return false
      if (filter === 'unlocked' && !idea.hasAccess) return false
      if (!needle) return true
      return `${idea.title} ${idea.summary}`.toLowerCase().includes(needle)
    })
    if (sort === 'featured') return matching
    // `sort` is stable, so ideas that tie keep the platform's own order.
    return [...matching].sort((a, b) => {
      if (sort === 'price-asc') return a.price - b.price
      if (sort === 'price-desc') return b.price - a.price
      return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '')
    })
  }, [ideas, query, filter, sort])

  const unlockedCount = ideas?.filter((idea) => idea.hasAccess).length ?? 0
  const paidPrices = ideas?.map((idea) => idea.price).filter((price) => price > 0) ?? []
  const fromPrice = paidPrices.length > 0 ? Math.min(...paidPrices) : null

  return (
    <section aria-labelledby="marketplace-heading" className="mt-4">
      <div className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-brand-800 via-brand-700 to-teal-600 px-6 py-8 text-white shadow-[0_30px_70px_-40px_rgba(8,75,56,0.9)] sm:px-10 sm:py-10">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-teal-300/30 blur-3xl" />
          <div className="absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-brand-400/25 blur-3xl" />
        </div>
        <div className="grid items-end gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold tracking-[0.18em] uppercase ring-1 ring-white/25">
              Marketplace
            </p>
            <h1
              id="marketplace-heading"
              className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
            >
              Ideas ready to build
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/85 sm:text-base sm:leading-7">
              Implementation documentation for automation ideas, prepared by the platform. Read any
              summary for free; unlock the full package - the implementation guide and the written
              plan behind it - to start building.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/90">
              {[
                'Step-by-step implementation guide',
                'Yours to download and keep',
                'Pay by mobile money, bank or card',
              ].map((point) => (
                <li key={point} className="inline-flex items-center gap-1.5">
                  <CheckCircleIcon className="h-4 w-4 text-teal-200" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          {ideas !== null && ideas.length > 0 && (
            <dl className="grid grid-cols-3 gap-3">
              <HeroStat label="Packages" value={String(ideas.length)} />
              <HeroStat label="Unlocked by you" value={String(unlockedCount)} />
              <HeroStat
                label="Starting from"
                value={fromPrice === null ? 'Free' : formatPrice(fromPrice, ideas[0].currency)}
              />
            </dl>
          )}
        </div>
      </div>

      {failed ? (
        <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          We could not load the marketplace. Please refresh the page.
        </p>
      ) : ideas === null ? (
        <p className="mt-6 text-sm text-gray-500">Loading the marketplace…</p>
      ) : ideas.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-brand-200 bg-white/70 px-6 py-14 text-center">
          <p className="font-semibold text-gray-900">No ideas are published yet.</p>
          <p className="mt-1 text-sm text-gray-600">Check back soon.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white bg-white/85 p-3 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/5 backdrop-blur md:flex-row md:items-center">
            <label className="sr-only" htmlFor="market-search">
              Search the marketplace
            </label>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="market-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ideas"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none"
              />
            </div>
            <fieldset className="flex min-w-0 rounded-xl bg-slate-100 p-1">
              <legend className="sr-only">Show</legend>
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`h-9 flex-1 rounded-lg px-4 text-sm font-semibold whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 md:flex-none ${
                    filter === option.value
                      ? 'bg-white text-brand-800 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </fieldset>
            <label className="sr-only" htmlFor="market-sort">
              Sort by
            </label>
            <select
              id="market-sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-gray-800 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-5 text-sm text-gray-600" aria-live="polite">
            {shown.length === 1 ? '1 idea' : `${shown.length} ideas`}
          </p>

          {shown.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
              <p className="font-semibold text-gray-900">No ideas match.</p>
              <p className="mt-1 text-sm text-gray-600">Try another search or filter.</p>
            </div>
          ) : (
            <ul
              aria-label="Ideas for sale"
              className="mt-3 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
            >
              {shown.map((idea) => (
                <li key={idea.id}>
                  <IdeaCard idea={idea} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 backdrop-blur">
      <dt className="text-[11px] font-semibold tracking-wide text-white/75 uppercase">{label}</dt>
      <dd className="mt-1 truncate text-lg font-bold sm:text-xl">{value}</dd>
    </div>
  )
}

/** One documentation package: what it is about, what it holds, and what unlocking it costs. */
function IdeaCard({ idea }: { idea: MarketIdea }) {
  const pending = isPending(idea)
  const action = idea.hasAccess ? 'Read it' : pending ? 'View status' : 'View idea'

  return (
    <Link
      to={`/app/marketplace/${idea.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_16px_40px_-30px_rgba(8,75,56,0.55)] transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_26px_54px_-30px_rgba(8,75,56,0.65)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0"
    >
      <div className={`relative h-32 overflow-hidden bg-linear-to-br p-4 ${coverFor(idea.id)}`}>
        <div
          aria-hidden="true"
          className="absolute -right-10 -bottom-14 h-40 w-40 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -top-12 right-16 h-24 w-24 rounded-full bg-white/10"
        />
        <div className="relative flex items-start justify-between gap-2">
          <AccessBadge idea={idea} />
          {idea.documentInfo && (
            <span className="rounded-full bg-black/15 px-2.5 py-1 text-xs font-semibold text-white">
              {idea.documentInfo.format}
            </span>
          )}
        </div>
        <span className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur">
          <FlowIcon className="h-6 w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h2 className="line-clamp-2 text-lg leading-snug font-bold text-gray-900 group-hover:text-brand-800">
          {idea.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{idea.summary}</p>

        {(idea.documentInfo || idea.hasWrittenDocumentation) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {idea.documentInfo && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-slate-200">
                <DocumentIcon className="h-4 w-4 text-brand-600" />
                Implementation guide · {formatFileSize(idea.documentInfo.size)}
              </span>
            )}
            {idea.hasWrittenDocumentation && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 ring-1 ring-slate-200">
                <PencilIcon className="h-4 w-4 text-brand-600" />
                Written plan
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        {idea.hasAccess ? (
          <span className="text-sm font-semibold text-emerald-700">In your library</span>
        ) : (
          <span>
            <span className="block text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
              Price
            </span>
            <span className="block text-lg font-bold text-gray-900">
              {formatPrice(idea.price, idea.currency)}
            </span>
          </span>
        )}
        <span className="inline-flex h-10 items-center rounded-xl bg-linear-to-r from-brand-600 to-brand-500 px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_10px_22px_-12px_rgba(20,99,73,0.9)] group-hover:from-brand-700 group-hover:to-brand-600">
          {action} →
        </span>
      </div>
    </Link>
  )
}
