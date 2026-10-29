import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon } from '../../../components/AppIcons'

/**
 * The course editor's modal: a dimmed backdrop, a white sheet with a title, a
 * sentence and a close button, closed by Escape or a click outside. Rendered on
 * `document.body`, so it can be opened from inside a form without an Enter in
 * its own inputs submitting that form. `children` lays out the sheet's body; the
 * caller decides where focus starts.
 */
export function EditorModal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string
  description: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  // The latest `onClose`, so Escape always calls the current one.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  }, [onClose])
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') close.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-[2px] sm:items-center">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative m-0 flex max-h-[min(42rem,calc(100dvh-3rem))] w-full flex-col overflow-hidden rounded-3xl bg-white p-0 text-left shadow-[0_30px_80px_-24px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/5 ${
          wide ? 'max-w-2xl' : 'max-w-xl'
        }`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-6 pt-5 pb-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>
        {children}
      </dialog>
    </div>,
    document.body,
  )
}
