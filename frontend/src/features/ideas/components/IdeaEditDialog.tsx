import { useEffect, useId, useRef } from 'react'

import { CloseIcon, PencilIcon } from '../../../components/AppIcons'
import type { Idea } from '../api/ideasApi'
import { IdeaForm } from './IdeaForm'

/**
 * Editing an idea without leaving the list: the same guided form the edit page
 * uses, in a dialog over the list. Opened only for an idea the server says this
 * viewer may edit (`viewerCanEdit`); `updateIdea` checks again on save.
 *
 * Escape and the close button leave it unsaved; the page behind stops
 * scrolling while it is open.
 */
export function IdeaEditDialog({
  idea,
  onClose,
  onSaved,
}: {
  idea: Idea
  onClose: () => void
  onSaved: (idea: Idea) => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const revising = idea.status === 'CHANGES_REQUESTED'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-forest/40 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8 lg:items-center lg:overflow-hidden">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white bg-slate-50 text-left shadow-2xl lg:h-[calc(100dvh-4rem)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-gradient-to-br from-mint/30 to-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-jade shadow-sm ring-1 ring-jade/10"
            >
              <PencilIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold text-ink">
                {revising ? 'Revise your idea' : 'Edit your draft'}
              </h2>
              <p className="mt-0.5 truncate text-sm text-sage">{idea.title}</p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sage hover:bg-white hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="flex flex-col p-3 sm:p-5 lg:min-h-0 lg:flex-1">
          <IdeaForm
            organizationId={idea.organizationId}
            idea={idea}
            onSaved={onSaved}
            onCancel={onClose}
          />
        </div>
      </dialog>
    </div>
  )
}
