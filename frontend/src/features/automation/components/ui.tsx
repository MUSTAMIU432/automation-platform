import type { ReactNode } from 'react'

import { badgeClasses, label } from '../utils/labels'
import type { Notice } from '../utils/useOutcome'

export const primaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButton =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-ink shadow-sm hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40 disabled:cursor-not-allowed disabled:opacity-60'
export const dangerButton =
  'inline-flex h-10 items-center justify-center rounded-lg border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60'
export const inputClass =
  'block w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-ink shadow-[inset_0_1px_2px_rgba(20,45,37,0.05)] placeholder:text-sage/60 hover:border-gray-300 focus:border-jade/50 focus:outline-none focus:ring-4 focus:ring-mint/30 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-sage'
export const cardClass =
  'rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:p-6'

export function Badge({ value, text }: { value: string; text?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses(value)}`}
    >
      {text ?? label(value)}
    </span>
  )
}

export function NoticeBanner({ notice }: { notice: Notice | null }) {
  if (!notice) return null
  return (
    <p
      role={notice.kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg px-4 py-3 text-sm ${
        notice.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
      }`}
    >
      {notice.text}
    </p>
  )
}

export function Loading({ what = 'this' }: { what?: string }) {
  return <output className="mt-6 block text-sm text-gray-600">Loading {what}…</output>
}

export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5">
      <p className="text-sm font-semibold text-red-800">We could not load {what}.</p>
      <p className="mt-1 text-sm text-red-700">Check your connection and try again.</p>
      <button type="button" onClick={onRetry} className={`mt-3 ${secondaryButton}`}>
        Try again
      </button>
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {children && <div className="mt-1 text-sm leading-6 text-gray-600">{children}</div>}
    </div>
  )
}

export function Field({
  id,
  label: text,
  error,
  hint,
  optional = false,
  children,
}: {
  id: string
  label: string
  error?: string | null
  /** Guidance, shown under the label so it is read before typing. */
  hint?: string
  /** Say "(optional)" beside the label. */
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {text}
        {optional && <span className="ml-1.5 text-xs font-normal text-sage">(optional)</span>}
      </label>
      {hint && <p className="mt-0.5 text-xs text-sage">{hint}</p>}
      <div className="mt-1.5">{children}</div>
      {error && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

export type StepState = 'done' | 'current' | 'open' | 'locked'

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = 'mt-6',
  numbered = false,
}: {
  tabs: ReadonlyArray<{
    id: T
    label: string
    aside?: boolean
    /** Where this step stands; a `locked` step cannot be opened yet. */
    state?: StepState
    /** Why a locked step is locked, or what an open one is for. */
    note?: string
  }>
  active: T
  onChange: (id: T) => void
  /** Spacing above the tab row. */
  className?: string
  /**
   * Number the tabs in the order the work happens. A tab marked `aside` (a record,
   * like the activity) is set apart at the end and not numbered.
   */
  numbered?: boolean
}) {
  // Each workflow tab's number, counted once, before rendering; `aside` tabs have none.
  const numbers = tabs.map(
    (_tab, index) => tabs.slice(0, index + 1).filter((item) => !item.aside).length,
  )
  return (
    <div
      role="tablist"
      aria-label="Sections"
      className={`${className} flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm`}
    >
      {tabs.map((tab, index) => {
        const selected = active === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-disabled={tab.state === 'locked' || undefined}
            disabled={tab.state === 'locked'}
            // The step's state as a description, so the tab's name stays its label.
            title={
              tab.note ??
              (tab.state === 'done'
                ? 'Done'
                : tab.state === 'current'
                  ? 'The current step'
                  : undefined)
            }
            onClick={() => onChange(tab.id)}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40 disabled:cursor-not-allowed disabled:opacity-50 ${
              tab.aside ? 'ml-auto' : ''
            } ${selected ? 'bg-forest text-white shadow-sm' : 'text-sage hover:bg-mist hover:text-ink disabled:hover:bg-transparent'}`}
          >
            {numbered && !tab.aside && (
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                  selected
                    ? 'bg-white/20 text-white'
                    : tab.state === 'done'
                      ? 'bg-jade text-white'
                      : tab.state === 'current'
                        ? 'bg-mint text-forest ring-2 ring-mint/40'
                        : 'bg-mist text-jade'
                }`}
              >
                {numbers[index]}
              </span>
            )}
            {tab.label}
            {tab.state === 'locked' && (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A short fact in a header: "Owner: MUNA". */
export function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold tracking-wide text-sage uppercase">{term}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}
