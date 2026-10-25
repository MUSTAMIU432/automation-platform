import { useEffect, useId, useRef } from 'react'

import type { Idea } from '../api/ideasApi'

const NEXT_STEPS = [
  ['Review', 'A reviewer reads your problem story and checks it is clear and complete.'],
  ['Decision', 'You are notified when it is approved, or when changes are asked for.'],
  ['Build', 'An approved idea moves on to be planned and built.'],
] as const

/**
 * The confirmation after "Submit for review" succeeds: a moment that says the
 * idea is in, what happens to it next, and the two ways on - to the ideas list
 * (where it is highlighted) or straight into another one.
 *
 * Only for a submission the server accepted. A submission it refused leaves a
 * draft, and that is reported on the ideas list with the reason instead - a
 * celebration for something that did not happen would be worse than none.
 */
export function SubmittedDialog({
  idea,
  failedUploads = [],
  onViewIdeas,
  onShareAnother,
}: {
  idea: Idea
  failedUploads?: string[]
  onViewIdeas: () => void
  onShareAnother: () => void
}) {
  const titleId = useId()
  const descriptionId = useId()
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    primaryRef.current?.focus()
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onViewIdeas()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onViewIdeas])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8 backdrop-blur-sm motion-safe:animate-[fade-in_150ms_ease-out]">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative isolate m-0 w-full max-w-lg overflow-hidden rounded-3xl border border-white/80 bg-white/90 p-0 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_40px_90px_-30px_rgba(8,75,56,0.6)] ring-1 ring-slate-900/5 backdrop-blur-xl motion-safe:animate-[rise_300ms_ease-out]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-20 -left-16 h-56 w-56 rounded-full bg-brand-200/70 blur-3xl" />
          <div className="absolute -top-10 -right-16 h-48 w-48 rounded-full bg-sky-200/60 blur-3xl" />
        </div>

        <div className="px-6 pt-8 pb-6 text-center sm:px-8">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-teal-500 text-white shadow-[0_0_0_8px_rgba(28,138,99,0.12),0_16px_32px_-12px_rgba(20,99,73,0.8)]">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8"
            >
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                pathLength={1}
                className="[stroke-dasharray:1] motion-safe:animate-[draw-check_500ms_ease-out_150ms_both]"
              />
            </svg>
          </span>
          <h2 id={titleId} className="mt-5 text-2xl font-bold tracking-tight text-gray-900">
            Your idea is submitted
          </h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-gray-600">
            <span className="font-semibold text-gray-900">“{idea.title}”</span> is now with the
            reviewers. You can follow it from your ideas.
          </p>
        </div>

        <div className="mx-6 rounded-2xl border border-white/80 bg-white/70 p-4 ring-1 ring-slate-900/5 sm:mx-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-brand-700 uppercase">
            What happens next
          </p>
          <ol className="mt-3 space-y-3">
            {NEXT_STEPS.map(([name, text], index) => (
              <li key={name} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-200"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-gray-700">
                  <span className="font-semibold text-gray-900">{name}.</span> {text}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {failedUploads.length > 0 && (
          <p
            role="alert"
            className="mx-6 mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200 sm:mx-8"
          >
            {failedUploads.length === 1
              ? `“${failedUploads[0]}” could not be attached. You can add it from the idea.`
              : `${failedUploads.length} files could not be attached: ${failedUploads.join(', ')}. You can add them from the idea.`}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 px-6 pt-6 pb-7 sm:flex-row sm:justify-end sm:px-8">
          <button
            type="button"
            onClick={onShareAnother}
            className="inline-flex h-11 items-center justify-center rounded-full border border-brand-300 bg-white/80 px-5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Share another problem
          </button>
          <button
            ref={primaryRef}
            type="button"
            onClick={onViewIdeas}
            className="inline-flex h-11 items-center justify-center rounded-full bg-linear-to-r from-brand-600 to-brand-500 px-6 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_12px_26px_-12px_rgba(20,99,73,0.85)] hover:from-brand-700 hover:to-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            View my ideas
          </button>
        </div>
      </dialog>
    </div>
  )
}
