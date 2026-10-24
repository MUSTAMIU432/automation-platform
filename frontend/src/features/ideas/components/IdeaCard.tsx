import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ArrowRightIcon, DotsVerticalIcon, PencilIcon } from '../../../components/AppIcons'
import { useReturnHere } from '../../../lib/returnTo'
import { opportunityForIdeaRequest, type Opportunity } from '../../automation/api/automationApi'
import { OpportunityEditDialog } from '../../automation/components/OpportunityEditDialog'
import { useLoad } from '../../automation/utils/useLoad'
import { SpinnerIcon } from '../../identity/components/icons'
import { IdeaReviewSection } from '../../reviews/components/IdeaReviewSection'
import type { Idea, IdeaStatus } from '../api/ideasApi'
import type { IdeaVoteControl } from '../hooks/useIdeaVotes'
import { categoryVisual } from '../utils/categoryVisual'
import {
  isResubmission,
  statusClasses,
  statusDescription,
  statusLabel,
  transitionLabel,
} from '../utils/lifecycle'
import { ownerNameFor, ownershipTitle } from '../utils/ownership'
import { reviewHistoryVisible } from '../utils/reviewVisibility'
import { IdeaAttachments } from './IdeaAttachments'
import { CommentIcon, PaperclipIcon, ReviewIcon, type IdeaCardSection } from './IdeaCardActions'
import { IdeaDiscussion } from './IdeaDiscussion'
import { IdeaVisibilityBadge } from './IdeaOwnership'
import { IdeaVoteButton } from './IdeaVoteButton'
import { COUNT_CHIP } from './ideaCardStyles'

export type IdeaListLayout = 'list' | 'grid'

const CONTEXT_CHIP: Record<Idea['submissionContext'], string> = {
  INDIVIDUAL: 'bg-violet-50 text-violet-700 ring-violet-200',
  TEAM: 'bg-sky-50 text-sky-700 ring-sky-200',
  ORGANIZATION: 'bg-mist text-jade ring-jade/20',
}

/** Bring the just-filed idea into view once its card is rendered. */
function scrollIntoView(element: HTMLLIElement | null) {
  element?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
}

/**
 * A count that opens one of the card's sections: the discussion, the evidence
 * or the review history. Named for the section it opens, as `IdeaCardActions`
 * names its cells, and `aria-expanded` says whether it is open.
 */
function CountToggle({
  name,
  count,
  icon,
  open,
  attention = false,
  onClick,
}: {
  name: string
  count?: number
  icon: ReactNode
  open: boolean
  attention?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={name}
      aria-expanded={open}
      onClick={onClick}
      className={`${COUNT_CHIP} ${
        open
          ? 'border-jade/40 bg-mist text-forest'
          : attention
            ? 'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-50'
            : 'border-gray-200 bg-white text-ink/80 hover:border-jade/30 hover:bg-mist/60 hover:text-ink'
      }`}
    >
      {icon}
      {count !== undefined && (
        <span aria-hidden="true" className="tabular-nums">
          {count}
        </span>
      )}
      {attention && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
    </button>
  )
}

const menuItemClass =
  'flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm text-ink hover:bg-mist focus:bg-mist focus:outline-none'

/**
 * "Edit opportunity", for an idea already in delivery. Mounted only while the menu
 * is open, so the opportunity is asked for when the reader looks, not for every
 * card on the page - and it draws nothing unless the server says this viewer may
 * manage that opportunity and it is still open.
 */
function EditOpportunityItem({
  ideaId,
  onPick,
}: {
  ideaId: string
  onPick: (opportunity: Opportunity) => void
}) {
  const found = useLoad(() => opportunityForIdeaRequest(ideaId), `card-opp:${ideaId}`)
  const opportunity = found.data
  if (
    !opportunity ||
    !opportunity.capabilities.canManageRequirements ||
    opportunity.status === 'cancelled' ||
    opportunity.status === 'completed'
  ) {
    return null
  }
  return (
    <button
      role="menuitem"
      type="button"
      onClick={() => onPick(opportunity)}
      className={menuItemClass}
    >
      <PencilIcon className="h-4 w-4 text-jade" />
      Edit opportunity
    </button>
  )
}

/** The card's ⋮ menu: the ways to reach the idea itself, and to edit it or its opportunity. */
function CardMenu({ idea, onEdit }: { idea: Idea; onEdit?: (idea: Idea) => void }) {
  const returnHere = useReturnHere()
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [editingOpportunity, setEditingOpportunity] = useState<Opportunity | null>(null)
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
      showFlash('Link copied')
    } catch {
      // No clipboard (an insecure origin, a denied permission): the menu stays honest
      // by not claiming a copy.
    }
    setOpen(false)
  }

  function showFlash(text: string) {
    setFlash(text)
    window.setTimeout(() => setFlash(null), 1500)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`More for ${idea.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sage hover:bg-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
      >
        <DotsVerticalIcon className="h-5 w-5" />
      </button>
      {flash && (
        <output className="absolute right-0 top-9 z-10 whitespace-nowrap rounded-lg bg-forest px-2.5 py-1 text-xs font-semibold text-white">
          {flash}
        </output>
      )}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-[0_18px_40px_-16px_rgba(8,75,56,0.45)]"
        >
          <Link
            role="menuitem"
            to={`/app/ideas/${idea.id}`}
            state={returnHere('Back to ideas')}
            className="block px-3.5 py-2 text-sm text-ink hover:bg-mist focus:bg-mist focus:outline-none"
          >
            View details
          </Link>
          {onEdit && (
            <button
              role="menuitem"
              type="button"
              onClick={() => {
                setOpen(false)
                onEdit(idea)
              }}
              className={menuItemClass}
            >
              <PencilIcon className="h-4 w-4 text-jade" />
              Edit idea
            </button>
          )}
          {idea.status === 'READY_FOR_IMPLEMENTATION' && (
            <EditOpportunityItem
              ideaId={idea.id}
              onPick={(opportunity) => {
                setOpen(false)
                setEditingOpportunity(opportunity)
              }}
            />
          )}
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
      {editingOpportunity && (
        <OpportunityEditDialog
          opportunity={editingOpportunity}
          onClose={() => setEditingOpportunity(null)}
          onSaved={() => {
            setEditingOpportunity(null)
            showFlash('Opportunity saved')
          }}
        />
      )}
    </div>
  )
}

/**
 * One idea on the Ideas page, as a row (`list`) or a tile (`grid`).
 *
 * What it offers is the backend's answer for this viewer, as before: Edit is
 * offered from authorship and the idea's state, and every lifecycle move from
 * `availableTransitions`, which the server computed and checks again. The
 * counts open the card's own discussion, evidence and review sections, which
 * `IdeaList` keeps to one open at a time.
 */
export function IdeaCard({
  idea,
  layout,
  viewerId,
  highlighted,
  vote,
  onToggleVote,
  onDismissVoteError,
  openSection,
  onToggleSection,
  onEdit,
  onTransition,
  submittingIdeaId,
  submittingTarget,
}: {
  idea: Idea
  layout: IdeaListLayout
  viewerId: string | null
  highlighted: boolean
  vote: IdeaVoteControl
  onToggleVote: (ideaId: string) => void
  onDismissVoteError: (ideaId: string) => void
  /** Which of this card's sections is open, if any. */
  openSection: IdeaCardSection | null
  onToggleSection: (section: IdeaCardSection) => void
  onEdit: (idea: Idea) => void
  onTransition: (idea: Idea, target: IdeaStatus) => void
  submittingIdeaId: string | null
  submittingTarget: IdeaStatus | null
}) {
  const returnHere = useReturnHere()
  const isMine = viewerId === idea.authorId
  const isDraft = idea.status === 'DRAFT'
  // Sent back for changes, on either track: the author revises and submits again.
  // Authorship only decides what to *offer*; `updateIdea` checks it again.
  const isRevisable = isResubmission(idea.status)
  const canEdit = isMine && (isDraft || isRevisable)
  const owner = ownerNameFor(idea.submissionContext, idea.tenantName, idea.authorId, viewerId)
  const { Icon, tile } = categoryVisual(idea.category)
  const reviewVisible = reviewHistoryVisible(idea, viewerId)
  const reviewWantsAttention = idea.viewerCanStartReview || idea.viewerActiveReviewId !== null
  const grid = layout === 'grid'

  const actions =
    canEdit || idea.availableTransitions.length > 0 ? (
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => onEdit(idea)}
            className="rounded-lg border border-jade/25 bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
          >
            {isDraft ? 'Edit draft' : 'Revise idea'}
          </button>
        )}
        {idea.availableTransitions.map((target) => {
          // A re-submission reads the same whichever track asked for the changes.
          const label =
            isRevisable && (target === 'SUBMITTED' || target === 'SUBMITTED_TO_ORGANIZATION')
              ? 'Submit again'
              : transitionLabel(target)
          if (label === null) return null
          return (
            <button
              key={target}
              type="button"
              disabled={submittingIdeaId === idea.id}
              onClick={() => onTransition(idea, target)}
              className="inline-flex items-center gap-2 rounded-lg bg-jade px-3 py-1.5 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingIdeaId === idea.id && submittingTarget === target && (
                <SpinnerIcon className="h-3.5 w-3.5 motion-safe:animate-spin" />
              )}
              {label}
            </button>
          )
        })}
      </div>
    ) : null

  const tileIcon = (
    <span
      aria-hidden="true"
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_20px_-12px_rgba(8,75,56,0.5)] ${tile}`}
    >
      <Icon className="h-7 w-7" />
    </span>
  )

  const status = (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(idea.status)}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(idea.status, idea.submissionContext)}
    </span>
  )

  return (
    <li
      ref={highlighted ? scrollIntoView : undefined}
      aria-current={highlighted ? 'true' : undefined}
      // Clear of the pinned header and breadcrumb when scrolled to.
      className={`flex scroll-mt-[calc(var(--app-chrome-height)+1rem)] flex-col rounded-3xl border bg-white/90 p-5 shadow-[0_16px_40px_-28px_rgba(8,75,56,0.45)] backdrop-blur transition-shadow hover:shadow-[0_22px_50px_-28px_rgba(8,75,56,0.55)] ${
        highlighted ? 'border-jade/50 ring-2 ring-mint/50' : 'border-white'
      }`}
    >
      <div
        className={
          grid ? 'flex flex-1 flex-col gap-4' : 'flex flex-col gap-4 lg:flex-row lg:items-start'
        }
      >
        {grid ? (
          /*
            A tile is one column: the icon, the title and the menu on the first line,
            and everything else beneath on the same left edge as the icon - so the
            counts at the foot line up with the text above them.
          */
          <div className="min-w-0">
            <div className="flex items-center gap-4">
              {tileIcon}
              <h3 className="min-w-0 flex-1 text-base font-bold text-ink">{idea.title}</h3>
              <CardMenu idea={idea} onEdit={idea.viewerCanEdit ? onEdit : undefined} />
            </div>
            <div className="mt-3">
              {highlighted && <p className="mt-0.5 text-xs font-semibold text-jade">Just filed</p>}
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-sage">
                {idea.description || 'No description yet.'}
                {/* What the state means, not only which it is - the next step may be the reader's. */}
                {idea.status !== 'DRAFT' && (
                  <span className="text-ink/70">
                    {' '}
                    {statusDescription(idea.status, idea.submissionContext)}
                  </span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-sage">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold ring-1 ring-inset ${CONTEXT_CHIP[idea.submissionContext]}`}
                >
                  {ownershipTitle(idea.submissionContext)}
                </span>
                <IdeaVisibilityBadge visibility={idea.visibility} />
                <span>
                  Category{' '}
                  <span className="font-semibold text-ink">{idea.category?.name ?? 'None'}</span>
                </span>
                {idea.submittedAt && (
                  <span>
                    Submitted on{' '}
                    <span className="font-semibold text-ink">
                      {new Date(idea.submittedAt).toLocaleDateString()}
                    </span>
                  </span>
                )}
                {owner && (
                  <span>
                    Owned by <span className="font-semibold text-ink">{owner}</span>
                  </span>
                )}
              </div>

              {grid && <div className="mt-3">{status}</div>}
              {actions && <div className="mt-4">{actions}</div>}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 gap-4">
            {tileIcon}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-ink">{idea.title}</h3>
              {highlighted && <p className="mt-0.5 text-xs font-semibold text-jade">Just filed</p>}
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-sage">
                {idea.description || 'No description yet.'}
                {/* What the state means, not only which it is - the next step may be the reader's. */}
                {idea.status !== 'DRAFT' && (
                  <span className="text-ink/70">
                    {' '}
                    {statusDescription(idea.status, idea.submissionContext)}
                  </span>
                )}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-sage">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-bold ring-1 ring-inset ${CONTEXT_CHIP[idea.submissionContext]}`}
                >
                  {ownershipTitle(idea.submissionContext)}
                </span>
                <IdeaVisibilityBadge visibility={idea.visibility} />
                <span>
                  Category{' '}
                  <span className="font-semibold text-ink">{idea.category?.name ?? 'None'}</span>
                </span>
                {idea.submittedAt && (
                  <span>
                    Submitted on{' '}
                    <span className="font-semibold text-ink">
                      {new Date(idea.submittedAt).toLocaleDateString()}
                    </span>
                  </span>
                )}
                {owner && (
                  <span>
                    Owned by <span className="font-semibold text-ink">{owner}</span>
                  </span>
                )}
              </div>

              {grid && <div className="mt-3">{status}</div>}
              {actions && <div className="mt-4">{actions}</div>}
            </div>
          </div>
        )}

        <div
          className={
            grid
              ? 'mt-auto border-t border-gray-100 pt-3'
              : 'flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 lg:w-auto lg:shrink-0 lg:flex-col lg:items-end lg:gap-4 lg:border-t-0 lg:pt-0'
          }
        >
          {!grid && (
            <div className="flex items-center gap-2">
              {status}
              <CardMenu idea={idea} onEdit={idea.viewerCanEdit ? onEdit : undefined} />
            </div>
          )}
          <div
            className={
              // A tile stacks: the counts on one line, "View details" beneath them.
              grid ? 'flex flex-col gap-3' : 'flex flex-wrap items-center gap-2 lg:flex-nowrap'
            }
          >
            <fieldset
              className={
                grid
                  ? // A tile's counts share its whole width, in equal parts.
                    'grid w-full auto-cols-fr grid-flow-col gap-2 border-0 p-0'
                  : 'flex items-center gap-2 border-0 p-0'
              }
            >
              <legend className="sr-only">Actions on {idea.title}</legend>
              <IdeaVoteButton
                ideaId={idea.id}
                control={vote}
                onToggle={onToggleVote}
                onDismissError={onDismissVoteError}
                layout="chip"
              />
              <CountToggle
                name="Discussion"
                count={idea.commentCount}
                icon={<CommentIcon />}
                open={openSection === 'discussion'}
                onClick={() => onToggleSection('discussion')}
              />
              <CountToggle
                name="Supporting evidence"
                count={idea.attachmentCount}
                icon={<PaperclipIcon />}
                open={openSection === 'evidence'}
                onClick={() => onToggleSection('evidence')}
              />
              {reviewVisible && (
                <CountToggle
                  name="Review history"
                  icon={<ReviewIcon />}
                  open={openSection === 'review'}
                  attention={reviewWantsAttention}
                  onClick={() => onToggleSection('review')}
                />
              )}
            </fieldset>
            <Link
              to={`/app/ideas/${idea.id}`}
              state={returnHere('Back to ideas')}
              className={`group inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-mist py-2 text-sm font-semibold text-jade ${grid ? 'w-full justify-center px-3 py-2.5' : 'px-4'} hover:bg-jade hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40`}
            >
              View details
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>

      <IdeaDiscussion idea={idea} open={openSection === 'discussion'} />
      <IdeaAttachments idea={idea} open={openSection === 'evidence'} />
      <IdeaReviewSection idea={idea} viewerId={viewerId} open={openSection === 'review'} />
    </li>
  )
}
