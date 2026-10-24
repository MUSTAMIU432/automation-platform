import { useState } from 'react'

import { useAuth } from '../../identity/auth/AuthContext'
import type { Idea, IdeaFilters, IdeaStatus } from '../api/ideasApi'
import { useCategories } from '../hooks/useCategories'
import { useIdeaDiscovery } from '../hooks/useIdeaDiscovery'
import { useIdeaVotes } from '../hooks/useIdeaVotes'
import { IdeaCard, type IdeaListLayout } from './IdeaCard'
import type { IdeaCardSection } from './IdeaCardActions'
import { IdeaFiltersBar } from './IdeaFiltersBar'
import { IdeaPagination } from './IdeaPagination'

/**
 * The one open section on the page: which idea, and which of its three
 * disclosures. A null is "the list is closed", which is the state a reader
 * arrives in and the state a filter change should return them to.
 */
interface OpenSection {
  ideaId: string
  section: IdeaCardSection
}

/**
 * Every idea the reader may see - their own, their teams' and their
 * organizations' - narrowed by the filters above them, and what can be done
 * with them. No organization has to be chosen first: an individual idea
 * belongs to no organization at all.
 *
 * Three rules shape this component:
 *
 * - **The list comes from the server already filtered.** Every read goes
 *   through `ideas`, which applies the tenant rule, the
 *   visibility rule and the discovery filters server-side; this component
 *   never filters a list to decide what somebody may see, because that is the
 *   one thing a client cannot be trusted with. It does arrange a list for
 *   *presentation* - it is what renders the server's page - and the empty
 *   states distinguish "there is nothing here" from "nothing matches what you
 *   asked for", which are different facts.
 * - **Filters only ever narrow.** The bar can offer a category, a status and
 *   a search, and there is no control that could widen a result, because the
 *   backend has no such argument to send.
 * - **What is offered is decided from the signed-in user's id.**
 *   `idea.authorId === user.id` is what puts Edit and Submit on an idea, and
 *   it is only ever a question of what to *offer*: the server refuses an
 *   edit or a submission it should refuse whether or not the buttons were
 *   rendered, and a failure to render them is not a security control.
 */
const LAYOUT_KEY = 'ideas.layout'

/** The reader's list/grid choice, remembered on this device; a list when there is none. */
function readLayout(): IdeaListLayout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === 'grid' ? 'grid' : 'list'
  } catch {
    return 'list'
  }
}

function saveLayout(layout: IdeaListLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout)
  } catch {
    // Storage unavailable (a private window, blocked site data): the choice lasts this visit.
  }
}

/** "Your ideas", with how many there are once the server has said. */
function ListHeading({ total }: { total: number | null }) {
  return (
    <div className="flex items-center gap-3">
      <h2 id="ideas-heading" className="text-2xl font-bold tracking-tight text-ink">
        Your ideas
      </h2>
      {total !== null && (
        <span className="rounded-full bg-mist px-3 py-1 text-sm font-semibold text-jade ring-1 ring-inset ring-jade/15">
          {total === 1 ? '1 idea' : `${total.toLocaleString()} ideas`}
        </span>
      )}
    </div>
  )
}

export function IdeaList({
  filters,
  onFiltersChange,
  onSearchChange,
  onEdit,
  onTransition,
  reloadToken,
  submittingIdeaId = null,
  submittingTarget = null,
  highlightedIdeaId = null,
}: {
  /** The filters in effect. Sent to the server; never applied here. */
  filters: IdeaFilters
  /**
   * Replace the filters. The parent owns this because it owns the rule that a
   * narrowing filter returns to the first page — the rule is one line, and
   * having it in two places is how "page 4 of 3" gets rendered.
   */
  onFiltersChange: (next: IdeaFilters) => void
  /** The raw text in the search box, which is not yet a filter. */
  onSearchChange: (search: string) => void
  onEdit: (idea: Idea) => void
  /**
   * Perform a lifecycle move. The list decides nothing about whether the move
   * is allowed - it was handed `availableTransitions` by the backend - and it
   * has no opinion about the outcome either; the workspace reports that.
   */
  onTransition: (idea: Idea, target: IdeaStatus) => void
  /**
   * Bumped after a write. A remount would do the same job, and was what this
   * used instead; a token is here because the component now holds filter
   * state above the list, and remounting would throw that away and send the
   * reader back to page 1 after every save.
   */
  reloadToken: number
  /** The idea just filed from `/app/ideas/new`: marked, and scrolled into view. */
  highlightedIdeaId?: string | null
  /**
   * Which idea's submission is in flight, so exactly one row shows a spinner.
   * Owned by the workspace rather than by this component: the mutation lives
   * there, and a list that owned its own "submitting" flag would have no way
   * to learn that the request had come back.
   */
  submittingIdeaId?: string | null
  /** Which move is in flight, so only its own button shows a spinner. */
  submittingTarget?: IdeaStatus | null
}) {
  const { user } = useAuth()
  /*
    Which section is open, if any - **at most one on the whole page**, and it is
    one value rather than one flag per section per idea.

    That shape is the whole rule, and it is what makes opening a card's evidence
    close another card's comments instead of stacking them: there is nowhere to
    record a second one. The reasons it is worth doing that way:

    - **A list is scanned, not read.** Somebody comparing two ideas opens one
      card, then the next. Two open sections means the reader is deciding which
      one is real, and the page gets taller than the amount of content on it
      warrants - every closed section is content that has to be scrolled past.
    - **Each section is a request.** A discussion, an evidence list and a review
      history are three fetches, keyed on being open
      (`useComments(open ? idea.id : null, ...)`, `useAttachments`,
      `IdeaReviewSection`). Leaving twenty cards open would leave sixty requests
      in flight for content nobody asked for.
    - **`IdeaList` already re-renders wholesale on a filter change**, so an open
      section cannot outlive the results it belongs to. Holding the position
      here rather than inside each panel is what gives it that.
  */
  const [openSection, setOpenSection] = useState<OpenSection | null>(null)
  const [layout, setLayout] = useState<IdeaListLayout>(readLayout)
  const { categories } = useCategories()
  const { ideas, pageInfo, loading, error } = useIdeaDiscovery(filters, reloadToken)
  // Seeded from the ideas the list was just given, so the vote controls render
  // the server's numbers on the first paint - no per-idea request, and nothing
  // to reload when a vote changes.
  const { votes, toggle: toggleVote, dismissError: dismissVoteError } = useIdeaVotes(ideas)

  if (error) {
    return (
      <div>
        <ListHeading total={null} />
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
          <p className="text-sm font-semibold text-red-800">Ideas unavailable</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const filtersActive = Boolean(
    filters.search ||
    filters.categoryId ||
    filters.status ||
    filters.submissionContext ||
    filters.visibility ||
    filters.mine,
  )
  // `pageInfo === null` is "no answer yet"; `loading` afterwards is a refresh
  // under a filter that is already different from the rows on screen.
  const firstLoad = pageInfo === null

  if (firstLoad) {
    return (
      <div>
        <ListHeading total={null} />
        <div className="mt-4">
          <LoadingPanel />
        </div>
      </div>
    )
  }

  return (
    <div>
      <ListHeading total={pageInfo.totalCount} />
      <div className="mt-4" />
      <IdeaFiltersBar
        filters={filters}
        categories={categories}
        onSearchChange={onSearchChange}
        onCategoryChange={(categoryId) => onFiltersChange({ ...filters, categoryId })}
        onStatusChange={(status) => onFiltersChange({ ...filters, status })}
        onContextChange={(submissionContext) => onFiltersChange({ ...filters, submissionContext })}
        onVisibilityChange={(visibility) => onFiltersChange({ ...filters, visibility })}
        onMineChange={(mine) => onFiltersChange({ ...filters, mine })}
        // An ordering is kept by "Clear all" - it arranges, it does not narrow - and,
        // like a filter, it starts again from the first page.
        onSortChange={(sort) => onFiltersChange({ ...filters, sort })}
        onClear={() => {
          onSearchChange('')
          onFiltersChange(filters.sort ? { sort: filters.sort } : {})
        }}
        layout={layout}
        onLayoutChange={(next) => {
          setLayout(next)
          saveLayout(next)
        }}
      />

      {/*
        The rows stay mounted while a new filter is in flight, dimmed rather
        than replaced. Replacing them would flash an empty panel on every
        keystroke; showing them at full strength would claim these are the
        results for the term now in the box. `aria-busy` says which it is to
        anything reading the page rather than looking at it.
      */}
      <div aria-busy={loading} className={loading ? 'mt-4 opacity-60 transition-opacity' : 'mt-4'}>
        {ideas.length === 0 ? (
          <EmptyState
            filtered={filtersActive}
            pastEnd={!filtersActive && (filters.offset ?? 0) > 0}
            onClear={() => {
              onSearchChange('')
              onFiltersChange({})
            }}
            onFirstPage={() => onFiltersChange({ ...filters, offset: 0 })}
          />
        ) : (
          <>
            {/*
              `aria-label` on the list, not just a class: it is what lets a test
              ask "what is in the rows?" of the rows rather than of the whole
              page, which now includes a filter bar that offers the same words
              the badges use.
            */}
            <ul
              className={
                layout === 'grid' ? 'grid gap-4 md:grid-cols-2 2xl:grid-cols-3' : 'space-y-4'
              }
              aria-label="Ideas"
            >
              {ideas.map((idea) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  layout={layout}
                  viewerId={user?.id ?? null}
                  highlighted={idea.id === highlightedIdeaId}
                  vote={votes[idea.id]}
                  onToggleVote={toggleVote}
                  onDismissVoteError={dismissVoteError}
                  openSection={openSection?.ideaId === idea.id ? openSection.section : null}
                  onToggleSection={(section) => {
                    // The one rule, written once: opening a section closes whatever
                    // was open, whether that was another section of this card or
                    // another card's - and opening the open one closes it.
                    setOpenSection((current) =>
                      current !== null && current.ideaId === idea.id && current.section === section
                        ? null
                        : { ideaId: idea.id, section },
                    )
                  }}
                  onEdit={onEdit}
                  onTransition={onTransition}
                  submittingIdeaId={submittingIdeaId}
                  submittingTarget={submittingTarget}
                />
              ))}
            </ul>

            {pageInfo && (
              <IdeaPagination
                pageInfo={pageInfo}
                onOffsetChange={(offset) => onFiltersChange({ ...filters, offset })}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Three different "no rows", because one message would be a lie twice over.
 *
 * - Nothing here at all: file the first one.
 * - Nothing matches: the filters are doing their job, and the reader can see
 *   which ones.
 * - Nothing on *this page*: the reader is past the end, which happens when
 *   rows were removed or a filter narrowed between paging. The way back is
 *   offered rather than left to be deduced.
 */
function EmptyState({
  filtered,
  pastEnd,
  onClear,
  onFirstPage,
}: {
  filtered: boolean
  pastEnd: boolean
  onClear: () => void
  onFirstPage: () => void
}) {
  if (pastEnd) {
    return (
      <div className="rounded-3xl border border-dashed border-jade/25 bg-white/80 p-6">
        <p className="text-sm font-semibold text-gray-900">Nothing on this page</p>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          There are ideas on an earlier page. Ideas change while you read.
        </p>
        <button
          type="button"
          onClick={onFirstPage}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          Back to the first page
        </button>
      </div>
    )
  }

  if (filtered) {
    return (
      <div className="rounded-3xl border border-dashed border-jade/25 bg-white/80 p-6">
        <p className="text-sm font-semibold text-gray-900">Nothing matches those filters</p>
        <p className="mt-1 text-sm leading-6 text-gray-600">
          Ideas you can read exist, but not with this category, status and search together.
        </p>
        <button
          type="button"
          onClick={onClear}
          className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          Clear filters
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-3xl border border-dashed border-jade/25 bg-white/80 p-6">
      <p className="text-sm font-semibold text-gray-900">No ideas here yet</p>
      <p className="mt-1 text-sm leading-6 text-gray-600">
        File the first one. It stays private to you until you widen its visibility.
      </p>
    </div>
  )
}

function LoadingPanel() {
  return (
    <output className="block rounded-3xl border border-white bg-white/85 p-6 shadow-sm">
      <span className="sr-only">Loading ideas…</span>
      <span className="block h-4 w-40 animate-pulse rounded bg-gray-200" />
      <span className="mt-3 block h-3 w-56 animate-pulse rounded bg-gray-100" />
    </output>
  )
}
