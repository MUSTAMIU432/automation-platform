import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CloseIcon, PencilIcon } from '../../../components/AppIcons'
import { updateOpportunity, type Opportunity } from '../api/automationApi'
import { label } from '../utils/labels'
import { useOutcome } from '../utils/useOutcome'
import { Field, inputClass, NoticeBanner, primaryButton, secondaryButton } from './ui'

/**
 * Editing how an opportunity is presented - its name, brief and urgency - in a
 * dialog. Opened from the idea card's menu, only when the server says this viewer
 * may manage the opportunity; `updateOpportunity` checks again on save.
 *
 * Rendered into the document body, so a card's own blur or overflow cannot clip
 * it. Escape and the close button leave it unsaved; the page behind stops
 * scrolling while it is open.
 */
export function OpportunityEditDialog({
  opportunity,
  onClose,
  onSaved,
}: {
  opportunity: Opportunity
  onClose: () => void
  onSaved: (opportunity: Opportunity) => void
}) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const edit = useOutcome()
  const [title, setTitle] = useState(opportunity.title)
  const [summary, setSummary] = useState(opportunity.summary)
  const [priority, setPriority] = useState<string>(opportunity.priority)

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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-forest/40 px-3 py-6 backdrop-blur-sm sm:items-center sm:px-6">
      <dialog
        open
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative m-0 w-full max-w-2xl overflow-hidden rounded-3xl border border-white bg-white text-left shadow-2xl"
      >
        <form
          aria-label="Edit opportunity"
          onSubmit={(event) => {
            event.preventDefault()
            void edit.run(
              () =>
                updateOpportunity({
                  input: { id: opportunity.id, title, summary, priority },
                }),
              (payload) => {
                if (payload.opportunity) onSaved(payload.opportunity)
              },
            )
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-gray-100 bg-gradient-to-br from-mint/25 to-white px-5 py-4 sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-jade shadow-sm ring-1 ring-jade/10"
              >
                <PencilIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="text-base font-bold text-ink">
                  Update how this opportunity is presented
                </h2>
                <p className="mt-0.5 text-sm text-sage">
                  The name, the brief and the urgency the delivery team works from. The idea itself
                  is not changed.
                </p>
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
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <NoticeBanner notice={edit.notice && !edit.notice.field ? edit.notice : null} />
            <Field
              id="opp-title"
              label="Opportunity name"
              hint="Shown on the opportunity card and carried over to its project."
              error={edit.notice?.field === 'title' ? edit.notice.text : null}
            >
              <input
                id="opp-title"
                className={inputClass}
                value={title}
                placeholder="e.g. Automated tax collection and reconciliation"
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <Field
              id="opp-summary"
              label="Brief for the delivery team"
              optional
              hint="What will be built and why, in a few sentences a developer can act on."
              error={edit.notice?.field === 'summary' ? edit.notice.text : null}
            >
              <textarea
                id="opp-summary"
                rows={5}
                className={`${inputClass} resize-y`}
                value={summary}
                placeholder="e.g. A platform that records tax payments, issues receipts and reports outstanding balances."
                onChange={(event) => setSummary(event.target.value)}
              />
            </Field>
            <Field
              id="opp-priority"
              label="Delivery urgency"
              hint="How soon this should be picked up compared with other opportunities."
              error={edit.notice?.field === 'priority' ? edit.notice.text : null}
            >
              <select
                id="opp-priority"
                className={`${inputClass} sm:max-w-xs`}
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                {['high', 'medium', 'low'].map((value) => (
                  <option key={value} value={value}>
                    {label(value)} priority
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} className={secondaryButton}>
              Cancel
            </button>
            <button type="submit" disabled={edit.busy || !title.trim()} className={primaryButton}>
              {edit.busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </dialog>
    </div>,
    document.body,
  )
}
