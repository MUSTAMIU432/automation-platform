import type {
  IdeaFilters,
  IdeaSort,
  IdeaStatus,
  IdeaVisibility,
  SubmissionContext,
} from '../api/ideasApi'

/*
  The Ideas page's filters, written into its address so they survive leaving
  the page: a reader who opens an idea and comes back - with the browser's Back
  or the page's own - finds the list exactly as they left it, and a filtered
  list can be bookmarked or shared. Every value is checked on the way in, so a
  hand-edited address yields the unfiltered list rather than a bad request;
  the server checks every filter again either way.
*/

const STATUSES: ReadonlySet<string> = new Set<IdeaStatus>([
  'DRAFT',
  'SUBMITTED_TO_ORGANIZATION',
  'ORGANIZATION_CHANGES_REQUESTED',
  'ORGANIZATION_CONFIRMED',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'REJECTED',
  'APPROVED',
  'READY_FOR_IMPLEMENTATION',
  'AUTOMATION_PROPOSAL',
])
const CONTEXTS: ReadonlySet<string> = new Set<SubmissionContext>([
  'INDIVIDUAL',
  'TEAM',
  'ORGANIZATION',
])
const VISIBILITIES: ReadonlySet<string> = new Set<IdeaVisibility>([
  'PUBLIC',
  'ORGANIZATION',
  'TEAM',
  'PRIVATE',
])
const SORTS: ReadonlySet<string> = new Set<IdeaSort>([
  'NEWEST',
  'OLDEST',
  'MOST_VOTED',
  'RECENTLY_UPDATED',
])

function pick<T extends string>(value: string | null, allowed: ReadonlySet<string>): T | null {
  return value !== null && allowed.has(value) ? (value as T) : null
}

export function filtersFromParams(params: URLSearchParams): IdeaFilters {
  const filters: IdeaFilters = {}
  const search = params.get('search')?.trim()
  if (search) filters.search = search
  const category = params.get('category')
  if (category && /^\d+$/.test(category)) filters.categoryId = category
  const status = pick<IdeaStatus>(params.get('status'), STATUSES)
  if (status) filters.status = status
  const owner = pick<SubmissionContext>(params.get('owner'), CONTEXTS)
  if (owner) filters.submissionContext = owner
  const audience = pick<IdeaVisibility>(params.get('audience'), VISIBILITIES)
  if (audience) filters.visibility = audience
  if (params.get('mine') === '1') filters.mine = true
  const sort = pick<IdeaSort>(params.get('sort'), SORTS)
  if (sort && sort !== 'NEWEST') filters.sort = sort
  const offset = Number(params.get('from'))
  if (Number.isInteger(offset) && offset > 0) filters.offset = offset
  return filters
}

export function paramsFromFilters(filters: IdeaFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.categoryId) params.set('category', filters.categoryId)
  if (filters.status) params.set('status', filters.status)
  if (filters.submissionContext) params.set('owner', filters.submissionContext)
  if (filters.visibility) params.set('audience', filters.visibility)
  if (filters.mine) params.set('mine', '1')
  if (filters.sort && filters.sort !== 'NEWEST') params.set('sort', filters.sort)
  if (filters.offset) params.set('from', String(filters.offset))
  return params
}
