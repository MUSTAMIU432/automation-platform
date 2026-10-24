import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'

import {
  DocumentIcon,
  DotsVerticalIcon,
  PaperclipIcon,
  PencilIcon,
} from '../../../components/AppIcons'

import { ideaRequest, type Idea } from '../api/ideasApi'
import { IdeaAttachmentsPanel } from './IdeaAttachments'
import { IdeaDetailCard } from './IdeaDetailCard'
import { IdeaOwnershipBadge, IdeaVisibilityBadge } from './IdeaOwnership'
import { ownerNameFor } from '../utils/ownership'
import { statusClasses, statusDescription, statusLabel } from '../utils/lifecycle'
import { stageLabels } from '../utils/stages'
import {
  ProposalOwnerCard,
  ProposalWriterPanel,
} from '../../proposals/components/IdeaProposalPanel'
import { useIdeaProposal } from '../../proposals/components/useIdeaProposal'
import { IdeaAutomationPanel } from '../../automation/components/IdeaAutomationPanel'
import { useScrollToHash } from '../hooks/useScrollToHash'
import { DecisionLetterCard } from '../../reviews/components/DecisionLetterCard'
import { RespondToChangesPanel } from '../../reviews/components/RespondToChangesPanel'
import { useAuth } from '../../identity/auth/AuthContext'
import { formatDate } from '../../reviews/utils/reviewLabels'

/**
 * One idea, at `/app/ideas/:ideaId`.
 *
 * **This page is why a reader must never be left guessing.** Four facts, said
 * once each at the top, in this order: what it is (its title), **who it belongs
 * to**, who created it, where it is in the lifecycle - and, beside the owner,
 * **who can see it**. Ownership and visibility are separate lines because they
 * are separate facts, and an idea can belong to a team and be readable by the
 * whole platform.
 *
 * It exists in its own right and not as the card's inline sections: three
 * places already linked here (`NotificationsPage`, two links in `IdeaReportPage`,
 * and the app's own breadcrumb rule) and all three were a 404, because ideas
 * existed only as rows in a list.
 *
 * The sections below stay separate from each other and from the review: a
 * comment is public engagement, a review is a formal decision with its own
 * criteria, and this page does not put one inside the other.
 */
export function IdeaDetailPage() {
  const { ideaId = '' } = useParams()
  const { user } = useAuth()
  /*
    `null` means "no answer yet", and the key it is stored under is the query
    that would answer it - the same discipline `useAdminQuery` and
    `useIdeaDiscovery` use. Comparing keys during render is what makes a retry,
    or a move to another idea, show the loading line instead of the previous
    idea's page while the next request is in flight, with no write inside the
    effect to express it.
  */
  const [token, setToken] = useState(0)
  // The server's words after the owner answered a request for changes, shown once the
  // idea has been read again in its new state.
  const [responded, setResponded] = useState<string | null>(null)
  const queryKey = `${ideaId}#${token}`
  const [answer, setAnswer] = useState<{
    key: string
    idea: Idea | null
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    ideaRequest(ideaId)
      .then((idea) => {
        if (cancelled) return
        // `null` is the server's answer for an idea this reader may not read and
        // for one that does not exist, and the page says so without choosing
        // between them - an id must not be a way to find out what exists.
        setAnswer({ key: queryKey, idea })
      })
      .catch(() => {
        if (!cancelled) setAnswer({ key: queryKey, idea: null })
      })
    return () => {
      cancelled = true
    }
  }, [ideaId, queryKey])

  const reload = useCallback(() => setToken((value) => value + 1), [])
  // A notification's link names the section it is about (`#respond`, `#decision-letter`).
  useScrollToHash(answer !== null && answer.key === queryKey && answer.idea !== null)

  if (answer === null || answer.key !== queryKey) {
    return <p className="mt-8 text-sm text-gray-600">Loading this idea…</p>
  }

  if (answer.idea === null) {
    return (
      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600 shadow-sm">
        <p>
          We could not load this idea. It may not exist, or it may not be one you are allowed to
          read.
        </p>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Try again
          </button>
          <Link to="/app/ideas" className="font-semibold text-brand-700 hover:text-brand-800">
            Back to your ideas
          </Link>
        </div>
      </section>
    )
  }

  const idea = answer.idea
  const viewerId = user?.id ?? null
  const ownerName = ownerNameFor(idea.submissionContext, idea.tenantName, idea.authorId, viewerId)

  return (
    <IdeaDetailLayout
      idea={idea}
      ownerName={ownerName}
      viewerId={viewerId}
      responded={responded}
      onResponded={(message) => {
        setResponded(message)
        reload()
      }}
    />
  )
}

/** A label and its value in the overview's facts. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <dt className="w-28 shrink-0 text-sm text-sage">{label}</dt>
      <dd className="min-w-0 text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}

/** The header's ⋮ menu: the idea's review report, and its address. */
function HeaderMenu({ idea }: { idea: Idea }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !ref.current?.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app/ideas/${idea.id}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // No clipboard here: nothing is claimed.
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="More about this idea"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-ink/70 hover:bg-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
      >
        <DotsVerticalIcon className="h-5 w-5" />
      </button>
      {copied && (
        <output className="absolute right-0 top-12 z-10 whitespace-nowrap rounded-lg bg-forest px-2.5 py-1 text-xs font-semibold text-white">
          Link copied
        </output>
      )}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 w-48 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-[0_18px_40px_-16px_rgba(8,75,56,0.45)]"
        >
          <Link
            role="menuitem"
            to={`/app/ideas/${idea.id}/report`}
            className="block px-3.5 py-2 text-sm text-ink hover:bg-mist focus:bg-mist focus:outline-none"
          >
            Review report
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={() => void copyLink()}
            className="block w-full px-3.5 py-2 text-left text-sm text-ink hover:bg-mist focus:bg-mist focus:outline-none"
          >
            Copy link
          </button>
        </div>
      )}
    </div>
  )
}

/* What each step of the journey means, for the tracker. Keyed by the step's name. */
const STEP_NOTES: Record<string, string> = {
  Created: 'You described the problem.',
  'Team or org review': 'Your team or organization checks it first.',
  Confirmed: 'Your team or organization confirmed it.',
  'Under review': 'The MUSTANET review team assesses it.',
  Approved: 'A decision letter and a proposal for you to read.',
  Implementation: 'Your go-ahead, then a developer builds it.',
}

/**
 * The idea's journey, across the top of its page: where it is now, what that
 * means, and every step of the way - done, current, and still to come.
 */
function JourneyCard({ idea }: { idea: Idea }) {
  const { stageIndex, stageCount } = idea.state
  const labels = stageLabels(idea)

  return (
    <section
      aria-labelledby="idea-journey"
      className="rounded-3xl border border-jade/15 bg-gradient-to-br from-mint/30 via-white to-white p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:p-6"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h2
            id="idea-journey"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-jade"
          >
            Your idea&apos;s journey
          </h2>
          {idea.status !== 'DRAFT' && (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-ink/80">
              {statusDescription(idea.status, idea.submissionContext)}
            </p>
          )}
        </div>
        {stageCount > 1 && (
          <span className="mt-2 shrink-0 self-start rounded-full bg-white px-3 py-1 text-xs font-semibold text-jade ring-1 ring-inset ring-jade/20 sm:mt-0">
            Stage {stageIndex} of {stageCount}
          </span>
        )}
      </div>

      {stageCount > 1 && labels && (
        <ol
          className="mt-6 flex flex-col gap-4 sm:grid sm:gap-0"
          style={{ gridTemplateColumns: `repeat(${stageCount}, minmax(0, 1fr))` }}
        >
          {labels.map((label, index) => {
            const step = index + 1
            const done = step < stageIndex
            const current = step === stageIndex
            return (
              <li
                key={label}
                className="relative flex items-start gap-3 sm:flex-col sm:items-center sm:gap-0 sm:px-1 sm:text-center"
              >
                {step < stageCount && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 top-4 hidden h-0.5 w-full sm:block ${step < stageIndex ? 'bg-jade' : 'bg-jade/15'}`}
                  />
                )}
                <span
                  className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                    done || current
                      ? `bg-jade text-white ${current ? 'ring-4 ring-mint/50' : ''}`
                      : 'border-2 border-jade/20 bg-white text-sage'
                  }`}
                >
                  {done || current ? (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  ) : (
                    step
                  )}
                </span>
                <span className="flex min-w-0 flex-col pt-1.5 sm:pt-0">
                  <span
                    className={`text-sm leading-tight sm:mt-2 ${
                      current
                        ? 'font-bold text-jade'
                        : done
                          ? 'font-semibold text-ink'
                          : 'font-medium text-sage'
                    }`}
                  >
                    {label}
                    <span className="sr-only">
                      {current ? ' (where it is now)' : done ? ' (done)' : ' (to come)'}
                    </span>
                  </span>
                  <span className="block text-xs leading-snug text-sage sm:mt-1 sm:hidden md:block">
                    {STEP_NOTES[label]}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

/**
 * One step of the project details, on a numbered rail: the card when there is
 * something to show, and otherwise a quiet line saying what will appear here
 * and when - so the order of things is clear before they happen. The card
 * components render nothing until they apply, which `peer-empty` notices.
 */
function DetailStep({
  id,
  number,
  waiting,
  last = false,
  children,
}: {
  /** An anchor a notification can point at (`#proposal`). */
  id?: string
  number: number
  waiting: string
  last?: boolean
  children: ReactNode
}) {
  return (
    <li id={id} className="relative flex scroll-mt-24 gap-4">
      {!last && (
        <span aria-hidden="true" className="absolute bottom-0 left-4 top-9 w-px bg-jade/20" />
      )}
      <span
        aria-hidden="true"
        className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-jade/30 bg-white text-sm font-bold text-forest shadow-sm"
      >
        {number}
      </span>
      <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'}`}>
        <div className="peer">{children}</div>
        <p className="hidden rounded-2xl border border-dashed border-jade/25 bg-white/60 px-4 py-3.5 text-sm text-sage peer-empty:block">
          {waiting}
        </p>
      </div>
    </li>
  )
}

/**
 * The page's layout. The idea's journey across the top; under it the project
 * details - the decision letter, the proposal and the delivery, numbered in the
 * order they happen - beside a short summary of the idea.
 *
 * The discussion, the evidence and the review history are not here: they open
 * from the idea's card on the Ideas page, and the review report is in this
 * page's menu. The one exception is the evidence while changes are requested,
 * because the answer to a request is often a document.
 */
function IdeaDetailLayout({
  idea,
  ownerName,
  viewerId,
  responded,
  onResponded,
}: {
  idea: Idea
  ownerName: string
  viewerId: string | null
  responded: string | null
  onResponded: (message: string) => void
}) {
  // One fetch for the proposal, shown in two places: the owner's card in the
  // project details, and the writer's editor under them.
  const proposal = useIdeaProposal(idea.id)
  const changesRequested =
    idea.status === 'CHANGES_REQUESTED' || idea.status === 'ORGANIZATION_CHANGES_REQUESTED'

  return (
    <article className="pb-4">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-ink">{idea.title}</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(idea.status)}`}
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
              {statusLabel(idea.status, idea.submissionContext)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {/*
            Edit is drawn from `viewerCanEdit` - the server's own answer, asked by
            the same code `updateIdea` runs - rather than from "is this mine and is
            it a draft" re-derived here.
          */}
          {idea.viewerCanEdit && (
            <Link
              to={`/app/ideas/${idea.id}/edit`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-ink hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
            >
              <PencilIcon className="h-4 w-4" />
              {idea.status === 'CHANGES_REQUESTED' ? 'Revise idea' : 'Edit draft'}
            </Link>
          )}
          <HeaderMenu idea={idea} />
        </div>
      </header>

      {responded && (
        <output className="mt-6 block rounded-2xl bg-mist px-4 py-3 text-sm text-forest">
          {responded}
        </output>
      )}

      <div className="mt-6">
        <JourneyCard idea={idea} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          {/* While changes are requested: what was asked, and where the owner answers it. */}
          <RespondToChangesPanel idea={idea} viewerId={viewerId} onResponded={onResponded} />
          {changesRequested && (
            // The anchor the response panel's "Go to documents" points at.
            <div id="idea-evidence" className="scroll-mt-24">
              <IdeaDetailCard
                headingId="idea-evidence-heading"
                title="Evidence & attachments"
                Icon={PaperclipIcon}
              >
                <IdeaAttachmentsPanel idea={idea} />
              </IdeaDetailCard>
            </div>
          )}

          <section aria-labelledby="project-details">
            <h2 id="project-details" className="text-lg font-bold text-ink">
              Project details
            </h2>
            <p className="mt-0.5 text-sm text-sage">
              What came of your idea, in the order it happens.
            </p>
            <ol className="mt-4">
              <DetailStep
                number={1}
                waiting="Decision letter — sent to you when the review team decides."
              >
                {/* The platform's letter to the owner about its decision, once it has been sent. */}
                {/* Without its own "what happens next": step 2 below says it. */}
                <DecisionLetterCard ideaId={idea.id} showNextStep={false} />
              </DetailStep>
              <DetailStep
                id="proposal"
                number={2}
                waiting="Proposal — prepared after approval, for you to read before your go-ahead."
              >
                <ProposalOwnerCard
                  ideaId={idea.id}
                  status={idea.status}
                  state={proposal.failed ? null : proposal.state}
                />
              </DetailStep>
              <DetailStep
                number={3}
                last
                waiting="Automation delivery — starts once you give your go-ahead."
              >
                <IdeaAutomationPanel idea={idea} />
              </DetailStep>
            </ol>
          </section>

          <ProposalWriterPanel
            ideaId={idea.id}
            state={proposal.failed ? null : proposal.state}
            onChanged={proposal.reload}
          />
        </div>

        <aside aria-label="About this idea" className="min-w-0">
          <IdeaDetailCard headingId="idea-overview" title="Idea overview" Icon={DocumentIcon}>
            <p className="text-sm leading-6 whitespace-pre-wrap text-ink/80">
              {idea.description || 'No description yet.'}
            </p>
            {/*
              Who owns it and who may read it are two facts, so two rows - an idea
              can belong to a team and be readable by the whole platform.
            */}
            <dl className="mt-4 border-t border-gray-100 pt-3">
              <Fact label="Type">
                <IdeaOwnershipBadge context={idea.submissionContext} ownerName="" />
              </Fact>
              <Fact label="Visibility">
                <IdeaVisibilityBadge visibility={idea.visibility} />
              </Fact>
              <Fact label="Category">{idea.category?.name ?? 'None'}</Fact>
              <Fact label="Created by">
                {idea.authorId === viewerId ? 'You' : 'Another member of this platform'}
              </Fact>
              <Fact label="Owned by">{ownerName}</Fact>
              <Fact label="Submitted on">
                {idea.submittedAt ? formatDate(idea.submittedAt) : 'Not yet'}
              </Fact>
            </dl>
          </IdeaDetailCard>
        </aside>
      </div>
    </article>
  )
}
