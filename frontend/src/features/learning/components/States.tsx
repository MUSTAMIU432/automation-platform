import type { ReactNode } from 'react'

import { glassPanel, secondaryButton } from './ui'

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <output className="flex items-center gap-3 px-2 py-12 text-sm text-slate-500">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600"
      />
      {label}
    </output>
  )
}

export function ErrorNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800"
    >
      <span>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryButton}>
          Try again
        </button>
      )}
    </div>
  )
}

export function Empty({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className={`${glassPanel} px-6 py-12 text-center`}>
      <p className="text-base font-semibold text-slate-800">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  const value = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
        <span>{label}</span>
        <span className="text-slate-700">{value}%</span>
      </div>
      <progress value={value} max={100} aria-label={label} className="sr-only">
        {value}%
      </progress>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-500 to-mint motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

/** The small "Easy / Medium / Hard" or status label. */
export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ${className}`}
    >
      {children}
    </span>
  )
}
