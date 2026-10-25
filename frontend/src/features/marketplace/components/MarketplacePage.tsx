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

function isPending(idea: MarketIdea): boolean {
  return idea.myPurchase?.status === 'pending' || idea.myPurchase?.status === 'awaiting'
}

function AccessBadge({ idea }: { idea: MarketIdea }) {
  const base =
    'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 backdrop-blur'
  if (idea.hasAccess) {
    return (
      <span className={`${base} bg-emerald-50/80 text-emerald-800 ring-emerald-200/70`}>
        ✓ Unlocked
      </span>
    )
  }
  if (isPending(idea)) {
    return (
      <span className={`${base} bg-amber-50/80 text-amber-800 ring-amber-200/70`}>
        Payment being confirmed
      </span>
    )
  }
  return <span className={`${base} bg-white/70 text-gray-700 ring-slate-200/80`}>🔒 Locked</span>
}

/** A frosted panel: translucent white over the soft colour behind the page. */
const glass =
  'border border-white/80 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_50px_-34px_rgba(8,75,56,0.45)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl'

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
    <section aria-labelledby="marketplace-heading" className="relative isolate mt-4">
      {/* Soft colour behind the page, so every glass panel has something to blur. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-24 left-[8%] h-80 w-80 rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute top-40 right-[5%] h-96 w-96 rounded-full bg-teal-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-sky-100/70 blur-3xl" />
      </div>

      <div className={`rounded-[2rem] px-6 py-10 sm:px-12 sm:py-14 ${glass}`}>
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-brand-700 uppercase">
              Marketplace
            </p>
            <h1
              id="marketplace-heading"
              className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl"
            >
              Ideas ready to{' '}
              <span className="bg-linear-to-r from-brand-600 to-teal-500 bg-clip-text text-transparent">
                build
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
              Implementation documentation for automation ideas. Read any summary for free; unlock
              the full package - the implementation guide and the written plan - to start building.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2 text-sm text-gray-700">
              {['Step-by-step guide', 'Download and keep', 'Mobile money, bank or card'].map(
                (point) => (
                  <li
                    key={point}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 ring-1 ring-slate-200/70"
                  >
                    <CheckCircleIcon className="h-4 w-4 text-brand-600" />
                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>
          {ideas !== null && ideas.length > 0 && (
            <dl className="grid grid-cols-3 divide-x divide-slate-200/80 rounded-2xl bg-white/60 py-4 ring-1 ring-white">
              <HeroStat label="Packages" value={String(ideas.length)} />
              <HeroStat label="Unlocked" value={String(unlockedCount)} />
              <HeroStat
                label="From"
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
        <div className={`mt-6 rounded-3xl px-6 py-14 text-center ${glass}`}>
          <p className="font-semibold text-gray-900">No ideas are published yet.</p>
          <p className="mt-1 text-sm text-gray-600">Check back soon.</p>
        </div>
      ) : (
        <>
          <div
            className={`mt-8 flex flex-col gap-3 rounded-2xl p-2 md:flex-row md:items-center ${glass}`}
          >
            <label className="sr-only" htmlFor="market-search">
              Search the marketplace
            </label>
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="market-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ideas"
                className="h-11 w-full rounded-xl border border-transparent bg-white/70 pr-3 pl-11 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-200 focus:outline-none"
              />
            </div>
            <fieldset className="flex min-w-0 rounded-xl bg-slate-900/[0.04] p-1">
              <legend className="sr-only">Show</legend>
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filter === option.value}
                  onClick={() => setFilter(option.value)}
                  className={`h-9 flex-1 rounded-lg px-4 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 md:flex-none ${
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
              className="h-11 rounded-xl border border-transparent bg-white/70 px-3 text-sm font-medium text-gray-800 focus:border-brand-300 focus:ring-2 focus:ring-brand-200 focus:outline-none"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <p className="mt-6 text-sm text-gray-500" aria-live="polite">
            {shown.length === 1 ? '1 idea' : `${shown.length} ideas`}
          </p>

          {shown.length === 0 ? (
            <div className={`mt-3 rounded-3xl px-6 py-12 text-center ${glass}`}>
              <p className="font-semibold text-gray-900">No ideas match.</p>
              <p className="mt-1 text-sm text-gray-600">Try another search or filter.</p>
            </div>
          ) : (
            <ul
              aria-label="Ideas for sale"
              className="mt-3 grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
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
    <div className="px-4 text-center">
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-1 truncate text-xl font-bold text-gray-900">{value}</dd>
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
      className={`group flex h-full flex-col rounded-3xl p-6 transition hover:-translate-y-0.5 hover:bg-white/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_28px_60px_-34px_rgba(8,75,56,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0 ${glass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-teal-500 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_12px_24px_-12px_rgba(20,99,73,0.8)]">
          <FlowIcon className="h-6 w-6" />
        </span>
        <AccessBadge idea={idea} />
      </div>

      <h2 className="mt-5 line-clamp-2 text-lg leading-snug font-semibold text-gray-900 group-hover:text-brand-800">
        {idea.title}
      </h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-600">{idea.summary}</p>

      {(idea.documentInfo || idea.hasWrittenDocumentation) && (
        <div className="mt-5 space-y-2 text-sm text-gray-700">
          {idea.documentInfo && (
            <p className="flex items-center gap-2">
              <DocumentIcon className="h-4 w-4 shrink-0 text-brand-600" />
              <span>
                Implementation guide{' '}
                <span className="text-gray-400">
                  · {idea.documentInfo.format} · {formatFileSize(idea.documentInfo.size)}
                </span>
              </span>
            </p>
          )}
          {idea.hasWrittenDocumentation && (
            <p className="flex items-center gap-2">
              <PencilIcon className="h-4 w-4 shrink-0 text-brand-600" />
              Written implementation plan
            </p>
          )}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        {idea.hasAccess ? (
          <span className="text-sm font-semibold text-emerald-700">In your library</span>
        ) : (
          <span className="text-2xl font-bold tracking-tight text-gray-900">
            {formatPrice(idea.price, idea.currency)}
          </span>
        )}
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:text-brand-800">
          {action}
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </span>
      </div>
    </Link>
  )
}
