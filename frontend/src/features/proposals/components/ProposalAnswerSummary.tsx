import { useEffect, useState } from 'react'

import { AGREEMENT_WORDS, proposalAnswerRequest, type ProposalAnswer } from '../api/proposalsApi'

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** One answer as a cell: what was asked, and the owner's answer under it. */
function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-mist/50 px-3.5 py-2.5 ring-1 ring-inset ring-jade/10">
      <dt className="text-xs text-sage">{term}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  )
}

/**
 * The owner's answers to the proposal, as everyone who acts on them reads them: the
 * decision first, then each answer on a line of its own.
 */
export function ProposalAnswerSummary({
  answer,
  title,
}: {
  answer: ProposalAnswer
  /** A heading inside the card, naming what the answers are for. */
  title?: string
}) {
  const proceed = answer.decision === 'proceed'
  return (
    <div
      className={`rounded-2xl border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(20,45,37,0.05)] ${
        proceed ? 'border-jade/20' : 'border-rose-200'
      }`}
    >
      {title && (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-sage">{title}</p>
      )}
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${
            proceed ? 'bg-jade' : 'bg-rose-500'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            {proceed ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M7 7l10 10M17 7 7 17" />}
          </svg>
        </span>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${proceed ? 'text-forest' : 'text-rose-900'}`}>
            {proceed ? 'The owner wants to go ahead' : 'The owner decided not to go ahead'}
          </p>
          <p className="text-xs text-sage">
            {answer.answeredByName} · {formatDay(answer.answeredAt)}
          </p>
        </div>
      </div>
      {proceed ? (
        <dl className="mt-3 grid gap-2 border-t border-gray-100 pt-3 sm:grid-cols-3">
          <Row term="Timeline">{answer.timeline ? AGREEMENT_WORDS[answer.timeline] : '—'}</Row>
          {answer.payment && <Row term="Payment plan">{AGREEMENT_WORDS[answer.payment]}</Row>}
          <Row term="Preferred start">
            {answer.preferredStart ? formatDay(answer.preferredStart) : 'No preference'}
          </Row>
          {answer.conditions && (
            <div className="px-1 pt-1 sm:col-span-3">
              <dt className="text-xs text-sage">Conditions and notes</dt>
              <dd className="mt-1 text-sm whitespace-pre-line text-ink">{answer.conditions}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mt-3 border-t border-gray-100 pt-3 text-sm whitespace-pre-line text-ink">
          {answer.declineReason}
        </p>
      )}
    </div>
  )
}

/** Loads and shows the owner's answers for an idea; draws nothing until there are some. */
export function ProposalAnswerCard({
  ideaId,
  title,
  className = 'mt-4',
}: {
  ideaId: string
  title?: string
  /** Spacing above the card; '' where the parent already spaces its children. */
  className?: string
}) {
  const [answer, setAnswer] = useState<{ ideaId: string; answer: ProposalAnswer } | null>(null)

  useEffect(() => {
    let cancelled = false
    proposalAnswerRequest(ideaId)
      .then((value) => {
        if (!cancelled && value !== null) setAnswer({ ideaId, answer: value })
      })
      .catch(() => {
        // No answers to show is the same, to the reader, as none yet.
      })
    return () => {
      cancelled = true
    }
  }, [ideaId])

  if (answer === null || answer.ideaId !== ideaId) return null
  return (
    <section aria-label="The owner's answers" className={className}>
      <ProposalAnswerSummary answer={answer.answer} title={title} />
    </section>
  )
}
