import { useEffect, useState } from 'react'

import { ideaDecisionLetterRequest, type OwnerDecisionLetter } from '../api/decisionLettersApi'
import { CollapseButton } from '../../../components/CollapseButton'
import { useCollapsed } from '../../../components/useCollapsed'
import { formatDate } from '../utils/reviewLabels'

/**
 * The letter the platform sent the owner about its decision, at the top of their idea.
 *
 * Drawn only when the server returns one, which it does for the idea's author and only
 * once a platform administrator has sent it. An approval is a celebration; a rejection
 * is a warm, respectful letter - the same text the administrator sent, as written.
 */
export function DecisionLetterCard({
  ideaId,
  showNextStep = true,
}: {
  ideaId: string
  /** Whether to add "what happens next" to an approval - off where the page already says it. */
  showNextStep?: boolean
}) {
  const [letter, setLetter] = useState<{ ideaId: string; letter: OwnerDecisionLetter } | null>(null)

  useEffect(() => {
    let cancelled = false
    ideaDecisionLetterRequest(ideaId)
      .then((answer) => {
        if (!cancelled && answer !== null) setLetter({ ideaId, letter: answer })
      })
      .catch(() => {
        // No letter to show is the same, to the reader, as no letter yet.
      })
    return () => {
      cancelled = true
    }
  }, [ideaId])

  if (letter === null || letter.ideaId !== ideaId) return null
  return <LetterCard letter={letter.letter} showNextStep={showNextStep} />
}

/**
 * The letter itself: the decision in a line, the letter's opening with the rest a
 * click away (a letter runs to several paragraphs, and this card sits beside the
 * idea), and for an approval what happens next.
 */
function LetterCard({
  letter,
  showNextStep,
}: {
  letter: OwnerDecisionLetter
  showNextStep: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [open, toggle] = useCollapsed('idea-detail:decision-letter', true)
  const { decision, message, sentAt } = letter
  const approved = decision === 'approved'
  const long = message.length > 280 || message.split('\n').length > 6

  return (
    <section
      id="decision-letter"
      aria-labelledby="decision-letter-heading"
      className={`scroll-mt-24 overflow-hidden rounded-3xl border shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] ${
        approved ? 'border-jade/20' : 'border-slate-200'
      }`}
    >
      <div
        className={`flex items-start gap-3 px-5 py-4 ${
          approved
            ? 'bg-gradient-to-br from-mint/50 via-mint/20 to-white'
            : 'bg-gradient-to-br from-slate-100 to-white'
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_10px_20px_-10px_rgba(8,75,56,0.7)] ${
            approved ? 'bg-jade' : 'bg-slate-500'
          }`}
        >
          {approved ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6"
            >
              <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m4 7 8 6 8-6" />
            </svg>
          )}
        </span>
        <div className="min-w-0">
          <h2 id="decision-letter-heading" className="text-base font-bold leading-snug text-ink">
            {approved ? 'Congratulations! Your idea has been approved' : 'A letter about your idea'}
          </h2>
          <p className="mt-0.5 text-xs text-sage">From the platform team · {formatDate(sentAt)}</p>
        </div>
        <span className="ml-auto">
          <CollapseButton
            open={open}
            onToggle={toggle}
            controls="decision-letter-body"
            label="the letter"
          />
        </span>
      </div>

      {open && (
        <div id="decision-letter-body" className="bg-white px-5 py-4">
          <p
            className={`text-sm leading-6 whitespace-pre-line text-ink/80 ${long && !expanded ? 'line-clamp-6' : ''}`}
          >
            {message}
          </p>
          {long && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 rounded text-sm font-semibold text-jade hover:text-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
            >
              {expanded ? 'Show less' : 'Read the full letter'}
            </button>
          )}
          {approved && showNextStep && (
            <div className="mt-4 flex gap-3 rounded-2xl bg-mist/70 p-3.5 ring-1 ring-inset ring-jade/10">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mt-0.5 h-5 w-5 shrink-0 text-jade"
              >
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
              <p className="text-sm leading-6 text-ink/80">
                <span className="font-semibold text-forest">What happens next:</span> the review
                team is preparing your proposal. You will be notified when it is ready to read, and
                nothing goes ahead until you give your go-ahead.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
