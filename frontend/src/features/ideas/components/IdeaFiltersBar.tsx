import { useEffect, useRef, useState } from 'react'

import {
  ChevronDownIcon,
  CloseIcon,
  GridIcon,
  ListIcon,
  RefreshIcon,
  SearchIcon,
  SlidersIcon,
  TagIcon,
} from '../../../components/AppIcons'

import type {
  IdeaCategory,
  IdeaFilters,
  IdeaSort,
  IdeaStatus,
  IdeaVisibility,
  SubmissionContext,
} from '../api/ideasApi'
import type { IdeaListLayout } from './IdeaCard'

/**
 * The controls that narrow a discovery query - a search box, a category, a
 * status, and behind "Filters" the owner, the audience and "only mine" - with
 * the filters in effect as removable chips, the ordering, and the list/grid
 * choice.
 *
 * Fully controlled, with one piece of local state for the text in the box.
 * That state is the *request* the reader is making, not the request the server
 * has answered: it is what they typed, which is not the same thing as the
 * `search` filter in effect, and conflating them is how a search box ends up
 * showing a term that was never searched for.
 *
 * Nothing here decides what a filter may do. Every control can only narrow,
 * because the vocabulary of narrowings is the backend's `IdeaFiltersInput`:
 * **there is no author control**, since a caller-chosen id would be a way of
 * asking for somebody else's rows - "My ideas" is the reader's own account
 * instead, and that is a boolean rather than an id. The statuses are every
 * value `IdeaStatus` can report rather than the two S2-002 could produce, for
 * the same reason the enum lists them all: the union is the contract.
 *
 * **Owner and audience are two controls, never one.** A list narrowed to "team
 * ideas" and a list narrowed to "ideas my team can read" are different questions
 * and the reader is often asking both at once, so the two dropdowns sit side by
 * side and neither is derived from the other.
 */

/** How long the box waits after the last keystroke before it is applied. */
export const SEARCH_DEBOUNCE_MS = 300

const ALL_STATUSES: ReadonlyArray<{ value: IdeaStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED_TO_ORGANIZATION', label: 'Sent to my organization' },
  {
    value: 'ORGANIZATION_CHANGES_REQUESTED',
    label: 'Organization asked for changes',
  },
  { value: 'ORGANIZATION_CONFIRMED', label: 'Organization confirmed it' },
  { value: 'SUBMITTED', label: 'Submitted to the platform' },
  { value: 'UNDER_REVIEW', label: 'Under review' },
  { value: 'CHANGES_REQUESTED', label: 'Changes requested' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'READY_FOR_IMPLEMENTATION', label: 'Ready for implementation' },
  { value: 'AUTOMATION_PROPOSAL', label: 'Automation proposal' },
]

const CONTEXTS: ReadonlyArray<{ value: SubmissionContext; label: string }> = [
  { value: 'INDIVIDUAL', label: 'Individual ideas' },
  { value: 'TEAM', label: 'Team ideas' },
  { value: 'ORGANIZATION', label: 'Organization ideas' },
]

const VISIBILITIES: ReadonlyArray<{ value: IdeaVisibility; label: string }> = [
  { value: 'TEAM', label: 'Team only' },
  { value: 'ORGANIZATION', label: 'Organization only' },
  { value: 'PRIVATE', label: 'Private' },
]

const SORTS: ReadonlyArray<{ value: IdeaSort; label: string }> = [
  { value: 'NEWEST', label: 'Recent' },
  { value: 'OLDEST', label: 'Oldest' },
  { value: 'MOST_VOTED', label: 'Most voted' },
  { value: 'RECENTLY_UPDATED', label: 'Recently updated' },
]

/*
  The look every control shares - and nothing about its size. Width, height and
  padding are each control's own, because two Tailwind utilities for the same
  property in one class string do not compose: whichever the build emits last
  wins, which is how a narrow select ends up full width.
*/
const fieldLook =
  'rounded-xl border border-gray-200 bg-white text-sm text-ink shadow-[inset_0_1px_2px_rgba(20,45,37,0.05)] focus:border-jade/50 focus:outline-none focus:ring-2 focus:ring-mint/40'
const fieldClasses = `${fieldLook} h-11 w-full px-3`

const labelClasses = 'flex items-center gap-1.5 text-xs font-semibold text-ink'

function labelOf<T extends string>(options: ReadonlyArray<{ value: T; label: string }>, value: T) {
  return options.find((option) => option.value === value)?.label ?? value
}

/** One filter in effect, and the way to take it off. */
function Chip({ name, value, onRemove }: { name: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white py-1 pl-3 pr-1.5 text-xs text-ink shadow-sm">
      <span className="font-semibold">{name}:</span>
      <span className="font-semibold text-jade">{value}</span>
      <button
        type="button"
        aria-label={`Remove the ${name.toLowerCase()} filter`}
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full text-sage hover:bg-mist hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

export function IdeaFiltersBar({
  filters,
  categories,
  onSearchChange,
  onCategoryChange,
  onStatusChange,
  onContextChange,
  onVisibilityChange,
  onMineChange,
  onSortChange,
  onClear,
  layout,
  onLayoutChange,
}: {
  filters: IdeaFilters
  categories: IdeaCategory[]
  /**
   * The reader typed. Applied as a filter after the debounce in the parent,
   * which is where the timer lives — this component reports keystrokes and
   * nothing else.
   */
  onSearchChange: (search: string) => void
  onCategoryChange: (categoryId: string | null) => void
  onStatusChange: (status: IdeaStatus | null) => void
  onContextChange: (context: SubmissionContext | null) => void
  onVisibilityChange: (visibility: IdeaVisibility | null) => void
  onMineChange: (mine: boolean) => void
  onSortChange: (sort: IdeaSort) => void
  onClear: () => void
  layout: IdeaListLayout
  onLayoutChange: (layout: IdeaListLayout) => void
}) {
  const appliedSearch = filters.search ?? ''
  // Keyed by the applied value rather than synced from it: the applied value
  // changes a debounce's worth *after* the text does, and an effect that
  // pushed the applied value back into the box would overwrite what somebody
  // is still typing. The key is what makes the one case that must sync — the
  // "Clear" button — land, by remounting the input at the empty value.
  const [text, setText] = useState({ value: appliedSearch, appliedSearch })
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (text.appliedSearch !== appliedSearch) setText({ value: appliedSearch, appliedSearch })
    // `text.appliedSearch` is read, not depended on: this effect exists to
    // notice that the *applied* value moved on, and depending on the old one
    // would make it re-run for its own state write.
    // oxlint-disable-next-line react/exhaustive-deps
  }, [appliedSearch])

  // The "Filters" panel closes on Escape or a click outside it, as a menu would.
  useEffect(() => {
    if (!moreOpen) return
    function close(event: MouseEvent | KeyboardEvent) {
      if (
        event instanceof KeyboardEvent
          ? event.key === 'Escape'
          : !moreRef.current?.contains(event.target as Node)
      ) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [moreOpen])

  const moreCount = [filters.submissionContext, filters.visibility, filters.mine].filter(
    Boolean,
  ).length
  const hasFilters = Boolean(appliedSearch || filters.categoryId || filters.status || moreCount)
  const categoryName = categories.find((category) => category.id === filters.categoryId)?.name

  return (
    <div className="rounded-3xl border border-white bg-white/85 p-4 shadow-[0_16px_40px_-28px_rgba(8,75,56,0.45)] backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-[2_1_12rem]">
          <label htmlFor="idea-search" className="sr-only">
            Search
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-sage" />
            <input
              id="idea-search"
              type="search"
              value={text.value}
              placeholder="Search titles and descriptions…"
              onChange={(event) => {
                setText((previous) => ({ ...previous, value: event.target.value }))
                onSearchChange(event.target.value)
              }}
              className={`${fieldLook} h-11 w-full pl-11 pr-3`}
            />
          </div>
        </div>

        <div className="min-w-0 flex-[1_1_9rem]">
          <label htmlFor="idea-category" className={labelClasses}>
            <TagIcon className="h-4 w-4 text-sage" />
            Category
          </label>
          <select
            id="idea-category"
            value={filters.categoryId ?? ''}
            onChange={(event) => onCategoryChange(event.target.value || null)}
            className={`${fieldClasses} mt-1.5`}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 flex-[1_1_9rem]">
          <label htmlFor="idea-status" className={labelClasses}>
            <RefreshIcon className="h-4 w-4 text-sage" />
            Status
          </label>
          <select
            id="idea-status"
            value={filters.status ?? ''}
            onChange={(event) => onStatusChange((event.target.value || null) as IdeaStatus | null)}
            className={`${fieldClasses} mt-1.5`}
          >
            <option value="">Any status</option>
            {ALL_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        <div ref={moreRef} className="relative flex-none">
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="idea-more-filters"
            onClick={() => setMoreOpen((open) => !open)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-jade hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
          >
            <SlidersIcon className="h-5 w-5" />
            Filters
            {moreCount > 0 && (
              <span className="rounded-full bg-jade px-1.5 text-[11px] font-bold text-white">
                {moreCount}
              </span>
            )}
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {moreOpen && (
            <div
              id="idea-more-filters"
              className="absolute right-0 z-20 mt-2 w-72 space-y-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_24px_50px_-20px_rgba(8,75,56,0.45)]"
            >
              <div>
                <label htmlFor="idea-context" className={labelClasses}>
                  Owner
                </label>
                <select
                  id="idea-context"
                  value={filters.submissionContext ?? ''}
                  onChange={(event) =>
                    onContextChange((event.target.value || null) as SubmissionContext | null)
                  }
                  className={`${fieldClasses} mt-1.5`}
                >
                  <option value="">Any owner</option>
                  {CONTEXTS.map((context) => (
                    <option key={context.value} value={context.value}>
                      {context.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="idea-visibility" className={labelClasses}>
                  Visibility scope
                </label>
                <select
                  id="idea-visibility"
                  value={filters.visibility ?? ''}
                  onChange={(event) =>
                    onVisibilityChange((event.target.value || null) as IdeaVisibility | null)
                  }
                  className={`${fieldClasses} mt-1.5`}
                >
                  <option value="">Any audience</option>
                  {VISIBILITIES.map((visibility) => (
                    <option key={visibility.value} value={visibility.value}>
                      {visibility.label}
                    </option>
                  ))}
                </select>
              </div>
              {/*
                "Mine" and not "by author": a boolean is the reader's own account
                server-side, so this control cannot become a way of asking for
                somebody else's ideas.
              */}
              <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={Boolean(filters.mine)}
                  onChange={(event) => onMineChange(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 accent-jade"
                />
                Only my ideas
              </label>
            </div>
          )}
        </div>
        <div className="flex-none">
          <label htmlFor="idea-sort" className={labelClasses}>
            Sort by
          </label>
          <select
            id="idea-sort"
            value={filters.sort ?? 'NEWEST'}
            onChange={(event) => onSortChange(event.target.value as IdeaSort)}
            className={`${fieldLook} mt-1.5 h-11 w-36 px-3`}
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="inline-flex h-11 flex-none items-center rounded-xl border border-gray-200 bg-white p-1">
          <legend className="sr-only">Layout</legend>
          {(
            [
              ['list', 'List', ListIcon],
              ['grid', 'Grid', GridIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={layout === value}
              onClick={() => onLayoutChange(value)}
              className={`inline-flex h-full items-center gap-1.5 rounded-[0.6rem] px-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40 ${
                layout === value ? 'bg-forest text-white' : 'text-sage hover:text-ink'
              }`}
            >
              <Icon className="h-4 w-4" />
              {/* Icons alone until there is room; the name stays for assistive technology. */}
              <span className="sr-only 2xl:not-sr-only">{label}</span>
            </button>
          ))}
        </fieldset>
      </div>

      {hasFilters && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            {appliedSearch && (
              <Chip name="Search" value={appliedSearch} onRemove={() => onSearchChange('')} />
            )}
            {filters.categoryId && (
              <Chip
                name="Category"
                value={categoryName ?? 'Chosen category'}
                onRemove={() => onCategoryChange(null)}
              />
            )}
            {filters.status && (
              <Chip
                name="Status"
                value={labelOf(ALL_STATUSES, filters.status)}
                onRemove={() => onStatusChange(null)}
              />
            )}
            {filters.submissionContext && (
              <Chip
                name="Owner"
                value={labelOf(CONTEXTS, filters.submissionContext)}
                onRemove={() => onContextChange(null)}
              />
            )}
            {filters.visibility && (
              <Chip
                name="Audience"
                value={labelOf(VISIBILITIES, filters.visibility)}
                onRemove={() => onVisibilityChange(null)}
              />
            )}
            {filters.mine && <Chip name="Owner" value="You" onRemove={() => onMineChange(false)} />}
            {
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-jade hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
              >
                <RefreshIcon className="h-4 w-4" />
                Clear all
              </button>
            }
          </div>
        </div>
      )}
    </div>
  )
}
