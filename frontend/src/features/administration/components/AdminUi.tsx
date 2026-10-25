import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

import type { IdeaStatus } from '../../ideas/api/ideasApi'
import { statusClasses, statusLabel } from '../../ideas/utils/lifecycle'
import type { PageInfo } from '../api/administrationApi'

/**
 * The band every panel's title sits on.
 *
 * The application's own brand green rather than a second accent introduced for
 * the console: a page that reads as "the app, with an admin in it" is the point
 * of the console being *inside* the shell rather than beside it. A gradient from
 * `brand-700` to `brand-600`, so the white title keeps well over 4.5:1 across the
 * whole band.
 */
const PANEL_BAND = 'bg-linear-to-r from-brand-700 to-brand-600'

/**
 * The console's frosted surface: translucent white over the shell's soft colour,
 * with a bright top edge. One class, so every panel and figure is the same glass.
 */
export const glassSurface =
  'border border-white/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_45px_-32px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl'

/**
 * The console's small building blocks: one look for headers, states, badges,
 * tables and paging across every admin page.
 */

export function AdminPageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: string
  description?: string
  /**
   * The way back, above the title. It belongs to the heading rather than in the
   * corner beside it: a control that names where it goes is part of the page's
   * orientation, and beside the title it competes with the title for the same
   * glance. See `BackLink`.
   */
  back?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-6">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/**
 * A titled panel: a coloured title band, then the content.
 *
 * The band is what makes the console read as one screen rather than a stack of
 * unrelated boxes, and it is also where the panel's own actions live - on the
 * right of the band, which is the only place they can be without either floating
 * in the content or being repeated by a header. So a panel has exactly one
 * heading row and one set of buttons: there is nowhere for a duplicate to hide.
 *
 * The buttons themselves stay white-on-light (`secondaryButtonClasses`), so they
 * read as raised out of the band rather than as part of it.
 */
export function AdminCard({
  title,
  children,
  actions,
}: {
  title?: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-2xl ${glassSurface}`}>
      {(title || actions) && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 ${PANEL_BAND} px-5 py-3`}
        >
          {title && (
            <h2 className="text-sm font-bold tracking-wide whitespace-nowrap text-white uppercase">
              {title}
            </h2>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <output className="flex items-center gap-3 px-2 py-10 text-sm text-slate-500">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
      />
      {label}
    </output>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryButtonClasses}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  )
}

export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${statusClasses(status)}`}
    >
      {statusLabel(status)}
    </span>
  )
}

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'admin'

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-emerald-50 text-emerald-700',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-red-50 text-red-700',
  info: 'bg-blue-50 text-blue-700',
  admin: 'bg-violet-50 text-violet-700',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {children}
    </span>
  )
}

/** A content cell the server withheld: says so rather than looking empty. */
export function Restricted({ children = 'Restricted' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-slate-500 italic">
      <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
        <path d="M10 2a4 4 0 0 0-4 4v2H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V6a4 4 0 0 0-4-4Zm2 6H8V6a2 2 0 1 1 4 0v2Z" />
      </svg>
      {children}
    </span>
  )
}

export function AdminTable({
  label,
  columns,
  children,
}: {
  label: string
  columns: string[]
  children: ReactNode
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table aria-label={label} className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-4 py-2.5 text-xs font-semibold tracking-wide whitespace-nowrap text-slate-500 uppercase"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  )
}

export const cellClasses = 'px-4 py-3 align-top text-slate-700'

export function AdminPagination({
  label,
  pageInfo,
  onOffsetChange,
}: {
  label: string
  pageInfo: PageInfo
  onOffsetChange: (offset: number) => void
}) {
  if (pageInfo.totalCount === 0) return null
  const first = pageInfo.offset + 1
  const last = Math.min(pageInfo.offset + pageInfo.limit, pageInfo.totalCount)

  return (
    <nav
      aria-label={label}
      className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600"
    >
      <p>
        Showing <span className="font-semibold text-slate-900">{first}</span>–
        <span className="font-semibold text-slate-900">{last}</span> of{' '}
        <span className="font-semibold text-slate-900">{pageInfo.totalCount}</span>
      </p>
      {(pageInfo.hasPreviousPage || pageInfo.hasNextPage) && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!pageInfo.hasPreviousPage}
            onClick={() => onOffsetChange(Math.max(0, pageInfo.offset - pageInfo.limit))}
            className={secondaryButtonClasses}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!pageInfo.hasNextPage}
            onClick={() => onOffsetChange(pageInfo.offset + pageInfo.limit)}
            className={secondaryButtonClasses}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  )
}

/**
 * The band and the number colour for one metric.
 *
 * Six steps rather than one, because a row of eight identical green cards is a
 * row nobody scans: the eye needs the colour to separate the figures, and it can
 * only do that if the colour means something. So green is the platform growing
 * (users, approved), amber is work outstanding (reviews, changes requested),
 * red is the one number nobody wants (rejected), and cyan/violet/sky are there to
 * keep the rest apart.
 */
const METRIC_TONES = {
  brand: { tile: 'from-brand-500 to-teal-500', glow: 'bg-brand-300/40', value: 'text-brand-700' },
  cyan: { tile: 'from-cyan-500 to-sky-500', glow: 'bg-cyan-300/40', value: 'text-cyan-700' },
  violet: {
    tile: 'from-violet-500 to-fuchsia-500',
    glow: 'bg-violet-300/40',
    value: 'text-violet-700',
  },
  amber: { tile: 'from-amber-400 to-orange-500', glow: 'bg-amber-300/40', value: 'text-amber-600' },
  sky: { tile: 'from-sky-500 to-blue-500', glow: 'bg-sky-300/40', value: 'text-sky-700' },
  red: { tile: 'from-red-500 to-rose-500', glow: 'bg-red-300/40', value: 'text-red-600' },
} as const

export type MetricTone = keyof typeof METRIC_TONES

/**
 * One figure, as a glass card with a coloured icon tile.
 *
 * The tile carries the icon and nothing else, because the number is the content.
 * Beside it the label is the small uppercase word that names the figure, the
 * value is large and coloured to match its tile, and `hint` is the one qualifier
 * that number cannot carry alone ("4 active" beside "4 accounts"). A soft glow of
 * the same colour sits behind the glass, so the row reads at a glance.
 *
 * **`tabular-nums` is not decoration.** These are counts read in a row against
 * each other, and a proportional digit makes two figures of the same length
 * different widths, which is exactly the comparison the row exists to support.
 *
 * With `to`, the whole card is a link to the list the figure summarises - the
 * place to act on the number - and lifts on hover so it reads as one.
 */
export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  to,
}: {
  label: string
  value: number | string
  hint?: string
  icon: ReactNode
  tone?: MetricTone
  to?: string
}) {
  const colors = METRIC_TONES[tone]
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full blur-2xl ${colors.glow}`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight tabular-nums ${colors.value}`}>
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_10px_22px_-12px_rgba(15,23,42,0.6)] ${colors.tile}`}
        >
          {icon}
        </span>
      </div>
    </>
  )
  const card = `relative isolate flex flex-col overflow-hidden rounded-2xl p-5 ${glassSurface}`
  if (!to) return <div className={card}>{body}</div>
  return (
    <Link
      to={to}
      className={`${card} transition hover:-translate-y-0.5 hover:bg-white/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0`}
    >
      {body}
    </Link>
  )
}

export function DetailList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([term, value]) => (
        <div key={term} className="min-w-0">
          <dt className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{term}</dt>
          <dd className="mt-0.5 text-sm break-words text-slate-800">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export const secondaryButtonClasses =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50'

export const primaryButtonClasses =
  'rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-not-allowed disabled:opacity-50'

export const dangerButtonClasses =
  'rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50'

export const controlClasses =
  'min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:ring-2 focus:ring-slate-200 focus:outline-none'

export function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  if (tone === 'error') {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
        {children}
      </p>
    )
  }
  return (
    <output className="block rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {children}
    </output>
  )
}
