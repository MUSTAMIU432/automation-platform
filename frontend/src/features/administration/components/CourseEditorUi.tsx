import { useId, type ReactNode } from 'react'

import { PlusIcon } from '../../../components/AppIcons'
import type { AdminCourse } from '../api/courseAuthoringApi'

/**
 * The course editor's building blocks: one look for its fields, lists, tabs and
 * buttons - quiet slate surfaces, the brand green kept for the main action and
 * the current place.
 */

export const inputClasses =
  'block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none motion-safe:transition'

export const brandButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl bg-linear-to-b from-brand-600 to-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_rgba(15,74,55,0.9)] hover:from-brand-700 hover:to-brand-800 focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none motion-safe:transition'

export const quietButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition'

export const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:border-red-300 hover:bg-red-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition'

/** A square, icon-only control; `label` names it for screen readers and its tooltip. */
export function IconButton({
  label,
  onClick,
  disabled = false,
  tone = 'neutral',
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger'
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:pointer-events-none disabled:opacity-30 motion-safe:transition-colors ${
        tone === 'danger'
          ? 'hover:bg-red-50 hover:text-red-600'
          : 'hover:bg-slate-100 hover:text-slate-700'
      }`}
    >
      {children}
    </button>
  )
}

const iconProps = {
  'aria-hidden': true,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

export const TrashIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
  </svg>
)

export const EyeIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const ArrowUpIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
)

export const ArrowDownIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg {...iconProps} className={className}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
)

/** Six dots: something that can be dragged. */
export const GripIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className={className}>
    {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
  </svg>
)

const STATUS = {
  draft: {
    label: 'Draft',
    classes: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
  },
  published: {
    label: 'Published',
    classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  archived: {
    label: 'Archived',
    classes: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
  },
} as const

/** Draft, Published or Archived: a pill with a coloured dot. */
export function StatusPill({ status }: { status: AdminCourse['status'] }) {
  const { label, classes, dot } = STATUS[status]
  return (
    <span
      className={`inline-flex h-7 items-center gap-1.5 self-center rounded-full px-3 text-xs font-semibold ring-1 ${classes}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

/** A labelled control with an optional hint under the label. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-800">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-1.5">{children(id)}</div>
    </div>
  )
}

/** A form section: a heading and a sentence on the left, its fields on the right. */
export function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-x-8 gap-y-4 border-t border-slate-200/70 py-7 first:border-t-0 first:pt-0 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
      <div className="min-w-0 space-y-5">{children}</div>
    </section>
  )
}

/** A list of sentences, one input each, with add and remove - in place of "one per line". */
export function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  addLabel: string
}) {
  const set = (index: number, value: string) =>
    onChange(items.map((item, at) => (at === index ? value : item)))
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500"
          >
            {index + 1}
          </span>
          <input
            value={item}
            onChange={(event) => set(index, event.target.value)}
            placeholder={placeholder}
            aria-label={`${label} ${index + 1}`}
            className={inputClasses}
          />
          <IconButton
            label={`Remove ${label.toLowerCase()} ${index + 1}`}
            tone="danger"
            onClick={() => onChange(items.filter((_, at) => at !== index))}
          >
            <TrashIcon />
          </IconButton>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <PlusIcon className="h-4 w-4" /> {addLabel}
      </button>
    </div>
  )
}

export interface TabItem<T extends string> {
  key: T
  label: string
  count?: number
}

/** The editor's sections as tabs: one page, four places, the current one in brand green. */
export function Tabs<T extends string>({
  tabs,
  current,
  onSelect,
  label,
}: {
  tabs: TabItem<T>[]
  current: T
  onSelect: (key: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1 ring-1 ring-slate-900/5"
    >
      {tabs.map((tab) => {
        const selected = tab.key === current
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(tab.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-safe:transition ${
              selected
                ? 'bg-white text-brand-800 shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(15,74,55,0.35)]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  selected ? 'bg-brand-50 text-brand-700' : 'bg-white/70 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
