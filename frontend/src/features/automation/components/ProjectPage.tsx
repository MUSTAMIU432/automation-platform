import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { BulbIcon, ChartIcon, CodeIcon } from '../../../components/AppIcons'
import { useReturnHere } from '../../../lib/returnTo'
import { projectRequest, type Project } from '../api/automationApi'
import { CONTEXT_LABEL, formatDate } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { ActivityTab } from './ActivityTab'
import { DeploymentTab } from './DeploymentTab'
import { ImpactTab } from './ImpactTab'
import { Pipeline } from './Pipeline'
import { PlanTab } from './PlanTab'
import { ProjectOverview } from './ProjectOverview'
import { TestingTab } from './TestingTab'
import { UatTab } from './UatTab'
import { StepNav } from './StepNav'
import {
  Badge,
  cardClass,
  Fact,
  Loading,
  LoadFailed,
  secondaryButton,
  Tabs,
  type StepState,
} from './ui'
import { WorkTab } from './WorkTab'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plan', label: 'Implementation plan' },
  { id: 'work', label: 'Stages & tasks' },
  { id: 'testing', label: 'Testing' },
  { id: 'uat', label: 'UAT' },
  { id: 'deployment', label: 'Deployment' },
  { id: 'impact', label: 'Impact' },
  { id: 'activity', label: 'Activity', aside: true },
] as const
type TabId = (typeof TABS)[number]['id']

/*
  Each step's place in the project's own pipeline. The plan and the build are the
  developer's to start; testing is open while they build; user acceptance, deployment
  and the impact open only once the step before them has really happened.
*/
const STAGE_OF: Partial<Record<TabId, string>> = {
  work: 'development',
  testing: 'testing',
  uat: 'uat',
  deployment: 'deployment',
  impact: 'impact',
}
const GATED: Partial<Record<TabId, string>> = {
  uat: 'Opens once every required test has passed.',
  deployment: 'Opens once the owner accepts the work in UAT.',
  impact: 'Opens once the solution is deployed.',
}

function projectStepStates(project: Project): Record<TabId, { state: StepState; note?: string }> {
  const stage = (name: string) => project.progress.stages.find((s) => s.stage === name)?.state
  const out = {} as Record<TabId, { state: StepState; note?: string }>
  for (const { id } of TABS) {
    const name = STAGE_OF[id]
    const state = name ? stage(name) : undefined
    if (id === 'overview' || id === 'activity') out[id] = { state: 'open' }
    else if (id === 'plan') out[id] = { state: project.status === 'planning' ? 'current' : 'done' }
    // While the plan is being written, the build is open but not yet the current step.
    else if (id === 'work' && project.status === 'planning') out[id] = { state: 'open' }
    else if (state === 'done') out[id] = { state: 'done' }
    else if (state === 'current') out[id] = { state: 'current' }
    else if (GATED[id]) out[id] = { state: 'locked', note: GATED[id] }
    else out[id] = { state: 'open' }
  }
  return out
}

/**
 * One project at `/app/automation/projects/:id`, or - `embedded` - inside the developer's
 * workspace at `/app/automation/workspace/:id`, where it sits beside their project list.
 */
export function ProjectPage({
  embedded = false,
  lead,
}: {
  embedded?: boolean
  /** Embedded only: what leads the project's bar - the developer's next step. */
  lead?: ReactNode
}) {
  const { projectId = '' } = useParams()
  // A notification can open the page on the tab its news is about (`?tab=uat`).
  const [params] = useSearchParams()
  const returnHere = useReturnHere()
  const requested = TABS.find((item) => item.id === params.get('tab'))?.id
  const [tab, setTab] = useState<TabId>(requested ?? 'overview')
  const loaded = useLoad(() => projectRequest(projectId), `project:${projectId}`)
  // In the workspace the facts and the pipeline are on demand, so the work below - the
  // plan being written, the stages being reported - is what the developer sees.
  const [detailsOpen, setDetailsOpen] = useState(!embedded)

  if (loaded.loading) return <Loading what="this project" />
  if (loaded.failed) return <LoadFailed what="this project" onRetry={loaded.reload} />
  const project: Project | null = loaded.data
  if (!project) {
    return (
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
        <p className="font-semibold text-gray-900">This project is not available.</p>
        <p className="mt-1">It may not exist, or it may not be one you are allowed to see.</p>
        <Link
          to={embedded ? '/app/automation/workspace' : '/app/automation/projects'}
          className="mt-3 inline-block font-semibold text-brand-700"
        >
          {embedded ? 'Back to your workspace' : 'Back to projects'}
        </Link>
      </section>
    )
  }

  const states = projectStepStates(project)
  const tabs = TABS.map((item) => ({ ...item, ...states[item.id] }))
  // A step opened from the address that is not open yet falls back to the overview.
  const shown: TabId = states[tab].state === 'locked' ? 'overview' : tab
  const percent = project.progress.taskCompletionPercent

  const facts = (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact term="Owner">{project.tenantName ?? project.ownerName}</Fact>
        <Fact term="Idea type">{CONTEXT_LABEL[project.submissionContext]}</Fact>
        <Fact term="Delivered by">{project.assignedName}</Fact>
        <Fact term="Target date">{project.targetDate ?? 'Not set'}</Fact>
      </dl>
      <div className="mt-5">
        <Pipeline stages={project.progress.stages} />
      </div>
    </>
  )
  const panel = (
    <div role="tabpanel" className="mt-5">
      {shown === 'overview' && (
        <ProjectOverview
          project={project}
          onChanged={loaded.reload}
          onOpenPlan={() => setTab('plan')}
        />
      )}
      {shown === 'plan' && <PlanTab project={project} onChanged={loaded.reload} />}
      {shown === 'work' && <WorkTab project={project} onChanged={loaded.reload} />}
      {shown === 'testing' && <TestingTab project={project} onChanged={loaded.reload} />}
      {shown === 'uat' && <UatTab project={project} onChanged={loaded.reload} />}
      {shown === 'deployment' && <DeploymentTab project={project} onChanged={loaded.reload} />}
      {shown === 'impact' && <ImpactTab project={project} onChanged={loaded.reload} />}
      {shown === 'activity' && <ActivityTab opportunityId={project.opportunityId} />}
      <StepNav
        steps={tabs}
        current={shown}
        onChange={setTab}
        anchor={`project-${project.id}-steps`}
        label="Project steps"
      />
    </div>
  )

  if (embedded) {
    const detailsId = `project-${project.id}-details`
    return (
      <article>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{lead}</div>
          <button
            type="button"
            aria-expanded={detailsOpen}
            aria-controls={detailsId}
            onClick={() => setDetailsOpen((open) => !open)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
          >
            Project details
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`h-4 w-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m5 7.5 5 5 5-5" />
            </svg>
          </button>
        </div>
        {detailsOpen && (
          <section
            id={detailsId}
            aria-label="Project details"
            className="mt-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4"
          >
            {facts}
          </section>
        )}
        {/* The work itself, on a surface of its own below the project's summary. */}
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/40 px-4 pb-5 sm:px-6">
          <div id={`project-${project.id}-steps`} className="scroll-mt-28">
            <Tabs tabs={tabs} active={shown} onChange={setTab} className="mt-2" numbered />
          </div>
          {panel}
        </div>
      </article>
    )
  }

  return (
    <article className="mt-6">
      <header className={`${cardClass}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-200/80 to-violet-50 text-violet-600"
            >
              <CodeIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-jade">Project</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">{project.title}</h2>
              <div className="mt-2">
                <Badge value={project.status} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              to={`/app/ideas/${project.ideaId}`}
              state={returnHere('Back to the project')}
              className={secondaryButton}
            >
              <BulbIcon className="h-4 w-4 text-jade" />
              Original idea
            </Link>
            <Link
              to={`/app/automation/opportunities/${project.opportunityId}`}
              state={returnHere('Back to the project')}
              className={secondaryButton}
            >
              <ChartIcon className="h-4 w-4 text-jade" />
              Opportunity
            </Link>
          </div>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Fact term="Owner">{project.tenantName ?? project.ownerName}</Fact>
            <Fact term="Idea type">{CONTEXT_LABEL[project.submissionContext]}</Fact>
            <Fact term="Delivered by">{project.assignedName}</Fact>
            <Fact term="Target date">
              {project.targetDate ? formatDate(project.targetDate) : 'Not set'}
            </Fact>
          </dl>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-sage">
              <span>
                {percent === null
                  ? 'No tasks yet'
                  : `${project.progress.tasksDone} of ${project.progress.tasksTotal} tasks done`}
              </span>
              {percent !== null && <span className="font-semibold text-ink">{percent}%</span>}
            </div>
            <div
              aria-hidden="true"
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-jade/10"
            >
              <div className="h-full rounded-full bg-jade" style={{ width: `${percent ?? 0}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-gray-100 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sage">
            Delivery pipeline
          </p>
          <Pipeline stages={project.progress.stages} />
        </div>
      </header>
      <div id={`project-${project.id}-steps`} className="scroll-mt-28">
        <Tabs tabs={tabs} active={shown} onChange={setTab} numbered />
      </div>
      {panel}
    </article>
  )
}
