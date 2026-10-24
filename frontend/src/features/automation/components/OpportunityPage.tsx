import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { useReturnHere } from '../../../lib/returnTo'

import { ArrowRightIcon, BulbIcon, ChartIcon } from '../../../components/AppIcons'
import {
  opportunityRequest,
  projectForOpportunityRequest,
  requirementsRequest,
  solutionRequest,
} from '../api/automationApi'
import { CONTEXT_LABEL, label } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { ActivityTab } from './ActivityTab'
import { AssignmentTab } from './AssignmentTab'
import { DeliveryTracker } from './DeliverySteps'
import { OverviewTab } from './OverviewTab'
import { ProjectLinkTab } from './ProjectLinkTab'
import { ProposalTab } from './ProposalTab'
import { RequirementsTab } from './RequirementsTab'
import { SolutionTab } from './SolutionTab'
import { StepNav } from './StepNav'
import { Badge, Fact, Loading, LoadFailed, Tabs, type StepState } from './ui'

const TABS = [
  { id: 'overview', label: 'Overview' },
  // The proposal is written and accepted before the opportunity opens, so it comes first.
  { id: 'proposal', label: 'Proposal' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'solution', label: 'Solution' },
  { id: 'assignment', label: 'Assignment' },
  { id: 'project', label: 'Project' },
  { id: 'activity', label: 'Activity', aside: true },
] as const
type TabId = (typeof TABS)[number]['id']

/*
  How far the opportunity has come, from its own status: 0 open for assignment, 1 a
  developer assigned, 2 the project under way, 3 delivered. -1 is an older opportunity
  still being prepared, and null one that was cancelled.
*/
function progressOf(status: string): number | null {
  if (status === 'cancelled') return null
  return { ready_for_assignment: 0, assigned: 1, project_created: 2, completed: 3 }[status] ?? -1
}

interface StepInfo {
  state: StepState
  note?: string
}

/**
 * Where each step stands. A step opens only when the work before it has really
 * happened - the assignment once the proposal is accepted, the project once someone
 * is assigned - so the pipeline can only be walked in order. Requirements and the
 * solution are refinements the delivery team adds as it goes: never a gate, done once
 * there is something in them.
 */
function stepStates(
  status: string,
  hasRequirements: boolean,
  hasSolution: boolean,
): Record<TabId, StepInfo> {
  const progress = progressOf(status)
  const cancelled = progress === null
  const reached = progress ?? -1
  const lockedFor = (note: string): StepInfo => ({
    state: 'locked',
    note: cancelled ? 'This opportunity was cancelled.' : note,
  })
  return {
    overview: { state: 'done' },
    proposal: reached >= 0 ? { state: 'done' } : { state: 'current' },
    requirements: hasRequirements
      ? { state: 'done' }
      : { state: 'open', note: 'Optional: add what the automation must do.' },
    solution: hasSolution
      ? { state: 'done' }
      : { state: 'open', note: 'Optional: describe how it will be built.' },
    assignment:
      reached >= 1
        ? { state: 'done' }
        : reached === 0
          ? { state: 'current' }
          : lockedFor('Opens once the owner accepts the proposal.'),
    project:
      reached >= 3
        ? { state: 'done' }
        : reached >= 1
          ? { state: 'current' }
          : lockedFor('Opens once a developer is assigned.'),
    activity: { state: 'open' },
  }
}

/** One opportunity at `/app/automation/opportunities/:id`, in the order the work happens. */
export function OpportunityPage() {
  const { opportunityId = '' } = useParams()
  const returnHere = useReturnHere()
  // A notification can open the page on the tab its news is about (`?tab=uat`).
  const [params] = useSearchParams()
  const requested = TABS.find((item) => item.id === params.get('tab'))?.id
  const [tab, setTab] = useState<TabId>(requested ?? 'overview')
  const loaded = useLoad(() => opportunityRequest(opportunityId), `opp:${opportunityId}`)
  // What the optional steps hold, for their marks in the pipeline.
  const requirements = useLoad(
    () => requirementsRequest(opportunityId),
    `opp-reqs:${opportunityId}`,
  )
  const solution = useLoad(() => solutionRequest(opportunityId), `opp-sol:${opportunityId}`)
  // The project that delivers it, for the header's way on; null until there is one.
  const project = useLoad(
    () => projectForOpportunityRequest(opportunityId),
    `oppproj-head:${opportunityId}:${loaded.data?.status ?? ''}`,
  )

  if (loaded.loading) return <Loading what="this opportunity" />
  if (loaded.failed) return <LoadFailed what="this opportunity" onRetry={loaded.reload} />
  const opportunity = loaded.data
  if (!opportunity) {
    return (
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">This opportunity is not available.</p>
        <p className="mt-1">It may not exist, or it may not be one you are allowed to see.</p>
        <Link
          to="/app/automation/opportunities"
          className="mt-3 inline-block font-semibold text-brand-700"
        >
          Back to opportunities
        </Link>
      </section>
    )
  }

  const states = stepStates(
    opportunity.status,
    (requirements.data?.length ?? 0) > 0,
    Boolean(solution.data),
  )
  const tabs = TABS.map((item) => ({ ...item, ...states[item.id] }))
  // A step opened from the address that is not open yet falls back to the overview.
  const shown: TabId = states[tab].state === 'locked' ? 'overview' : tab

  return (
    <article className="mt-6">
      <header className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-mint/40 to-mint/10 text-jade"
            >
              <ChartIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-jade">
                Automation opportunity
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
                {opportunity.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  value={opportunity.priority}
                  text={`${label(opportunity.priority)} priority`}
                />
                <Badge value={opportunity.status} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to={`/app/ideas/${opportunity.ideaId}`}
              state={returnHere('Back to the opportunity')}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-ink hover:border-jade/40 hover:bg-mist focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40"
            >
              <BulbIcon className="h-4 w-4 text-jade" />
              View original idea
            </Link>
            {project.data && (
              <Link
                to={`/app/automation/projects/${project.data.id}`}
                state={returnHere('Back to the opportunity')}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-forest px-4 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              >
                Open project
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-4 border-t border-gray-100 pt-4 md:grid-cols-[1fr_auto] md:items-end">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Fact term="Idea type">{CONTEXT_LABEL[opportunity.submissionContext]}</Fact>
            <Fact term="Owned by">
              {opportunity.tenantName ?? opportunity.ownerName}
              {opportunity.tenantName && (
                <span className="block text-xs text-sage">{opportunity.ownerName}</span>
              )}
            </Fact>
            <Fact term="Source idea">{opportunity.ideaTitle}</Fact>
          </dl>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-sage">
              Delivery
            </p>
            <DeliveryTracker status={opportunity.status} />
          </div>
        </div>
      </header>

      <div id="opportunity-steps" className="scroll-mt-28">
        <Tabs tabs={tabs} active={shown} onChange={setTab} numbered />
      </div>
      <div className="mt-5" role="tabpanel">
        {shown === 'overview' && (
          <OverviewTab opportunity={opportunity} onChanged={loaded.reload} />
        )}
        {shown === 'requirements' && (
          <RequirementsTab opportunity={opportunity} onChanged={loaded.reload} />
        )}
        {shown === 'solution' && <SolutionTab opportunity={opportunity} />}
        {shown === 'proposal' && <ProposalTab opportunity={opportunity} />}
        {shown === 'assignment' && (
          <AssignmentTab opportunity={opportunity} onChanged={loaded.reload} />
        )}
        {shown === 'project' && <ProjectLinkTab opportunity={opportunity} />}
        {shown === 'activity' && <ActivityTab opportunityId={opportunity.id} />}
      </div>
      <StepNav
        steps={tabs}
        current={shown}
        onChange={setTab}
        anchor="opportunity-steps"
        label="Opportunity steps"
      />
    </article>
  )
}
