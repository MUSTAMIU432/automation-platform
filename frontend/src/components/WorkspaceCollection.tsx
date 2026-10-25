import type { ComponentType, ReactNode } from 'react'

import { BulbIcon, ChartIcon, DocumentIcon, FolderIcon, ShieldCheckIcon } from './AppIcons'
import { collectionCardClasses } from './glassStyles'

/**
 * The building blocks of a workspace collection page - Organizations and Teams
 * share them, so the two read as one product: a header with an illustration, an
 * empty state that invites the first one, and the note under the create form.
 */

type IconType = ComponentType<{ className?: string }>

/** The page's title, what it is for, and an illustration on the right. */
export function CollectionHero({
  title,
  description,
  art,
}: {
  title: string
  description: ReactNode
  art: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
        <p className="mt-3 text-base leading-7 text-gray-600">{description}</p>
      </div>
      <div className="hidden w-72 shrink-0 md:block">{art}</div>
    </div>
  )
}

const ORBIT: Array<[IconType, string]> = [
  [BulbIcon, 'left-[18%] top-2'],
  [DocumentIcon, 'right-[18%] top-0'],
  [FolderIcon, 'left-[6%] top-[52%]'],
  [ChartIcon, 'right-[6%] top-[52%]'],
]

/**
 * Nothing here yet, said warmly: an illustration of the thing at the centre of
 * the work it holds, what it is for, a button that takes the reader to the
 * create form beside it, and three things it gives them.
 */
export function EmptyCollection({
  Icon,
  title,
  children,
  actionLabel,
  onAction,
  benefits,
}: {
  Icon: IconType
  title: string
  children: ReactNode
  actionLabel: string
  onAction: () => void
  /** What it gives the reader: an icon, a short title and one line under it. */
  benefits: Array<[IconType, string, string]>
}) {
  return (
    <div className={`${collectionCardClasses} text-center`}>
      <div aria-hidden="true" className="relative mx-auto h-40 max-w-sm">
        <svg viewBox="0 0 320 160" className="absolute inset-0 h-full w-full" fill="none">
          <path
            d="M30 120 A130 110 0 0 1 290 120"
            className="stroke-brand-200"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
        </svg>
        {ORBIT.map(([OrbitIcon, place]) => (
          <span
            key={place}
            className={`absolute flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-600 shadow-[0_8px_18px_-10px_rgba(8,75,56,0.6)] ring-1 ring-brand-100 ${place}`}
          >
            <OrbitIcon className="h-5 w-5" />
          </span>
        ))}
        <span className="absolute top-9 left-1/2 flex h-24 w-32 -translate-x-1/2 items-center justify-center">
          <span className="absolute inset-x-3 -top-2 h-16 -rotate-6 rounded-xl bg-brand-500" />
          <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-white text-brand-700 shadow-[0_18px_32px_-16px_rgba(8,75,56,0.7)] ring-1 ring-brand-100">
            <Icon className="h-10 w-10" />
          </span>
        </span>
      </div>

      <p className="mt-4 text-xl font-bold text-gray-900">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">{children}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-linear-to-r from-brand-700 to-brand-600 px-6 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_12px_26px_-12px_rgba(20,99,73,0.85)] hover:from-brand-800 hover:to-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <span aria-hidden="true" className="mr-1.5 text-base leading-none">
          +
        </span>
        {actionLabel}
      </button>

      <ul className="mt-7 grid gap-4 border-t border-brand-100 pt-5 text-left sm:grid-cols-3 sm:gap-3">
        {benefits.map(([BenefitIcon, benefit, detail]) => (
          <li key={benefit} className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700 ring-1 ring-brand-100">
              <BenefitIcon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">{benefit}</span>
              <span className="block text-xs leading-5 text-gray-500">{detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Under a create form: what the reader becomes by creating it. */
export function OwnerNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-5 flex gap-3 rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
      <ShieldCheckIcon className="h-6 w-6 shrink-0 text-brand-600" />
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-sm leading-6 text-gray-600">{children}</p>
      </div>
    </div>
  )
}

/**
 * A form field with an icon inside it, on the left: centred for a one-line
 * input, at the first line for a text area (`top`).
 */
export function IconField({
  Icon,
  top = false,
  children,
}: {
  Icon: IconType
  top?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative">
      <Icon
        className={`pointer-events-none absolute left-3.5 z-10 h-4 w-4 text-gray-500 ${
          top ? 'top-3.5' : 'top-1/2 -translate-y-1/2'
        }`}
      />
      {children}
    </div>
  )
}
