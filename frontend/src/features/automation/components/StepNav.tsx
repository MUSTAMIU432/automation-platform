import { ArrowRightIcon } from '../../../components/AppIcons'
import type { StepState } from './ui'

export interface Step<T extends string> {
  id: T
  label: string
  aside?: boolean
  state?: StepState
  note?: string
}

/**
 * Previous and next under a step, so a pipeline can be walked in order. A next
 * step that is not open yet is shown, disabled, with what it is waiting for.
 * `anchor` is the element scrolled back into view when the step changes.
 */
export function StepNav<T extends string>({
  steps,
  current,
  onChange,
  anchor,
  label,
}: {
  steps: ReadonlyArray<Step<T>>
  current: T
  onChange: (id: T) => void
  anchor: string
  label: string
}) {
  const flow = steps.filter((step) => !step.aside)
  const index = flow.findIndex((step) => step.id === current)
  if (index < 0) return null
  const previous = flow[index - 1]
  const next = flow[index + 1]

  function go(id: T) {
    onChange(id)
    document.getElementById(anchor)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
  }

  return (
    <nav
      aria-label={label}
      className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-200/70 pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      {previous ? (
        <button
          type="button"
          onClick={() => go(previous.id)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 text-sm font-semibold text-ink hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
        >
          <ArrowRightIcon className="h-4 w-4 rotate-180" />
          Previous: {previous.label}
        </button>
      ) : (
        <span />
      )}
      {next &&
        (next.state === 'locked' ? (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            {next.note && <p className="text-sm text-sage">{next.note}</p>}
            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-100 px-5 text-sm font-semibold text-sage"
            >
              Next: {next.label}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => go(next.id)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            Next: {next.label}
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        ))}
    </nav>
  )
}
