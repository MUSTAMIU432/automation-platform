import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  adminOpportunitiesRequest,
  assignDeveloper,
  deliveryDeskRequest,
  type DeliveryDesk,
  type DeskProject,
  type DeveloperOption,
  type ImplementationPlan,
  type Opportunity,
  type Project,
  type Stage,
} from '../../automation/api/automationApi'
import {
  DecisionResult,
  StageDecision,
  type StageDecisionKind,
} from '../../automation/components/StagesPanel'
import { CONTEXT_LABEL, formatDate, label } from '../../automation/utils/labels'
import { useOutcome } from '../../automation/utils/useOutcome'
import { ProposalText } from '../../proposals/components/ProposalSections'
import { AutomationIcon, InboxIcon, ProposalIcon, ReviewIcon } from '../components/AdminIcons'
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  cellClasses,
  controlClasses,
  primaryButtonClasses,
} from '../components/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'

const PLAN_WORDS: Record<ImplementationPlan['status'], string> = {
  draft: 'Being written',
  submitted: 'Waiting for you',
  changes_requested: 'Sent back',
  approved: 'Approved',
}
const PLAN_TONE = {
  draft: 'neutral',
  submitted: 'warn',
  changes_requested: 'warn',
  approved: 'good',
} as const

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (
    (words[0]?.[0] ?? '?') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')
  ).toUpperCase()
}

function Person({ name, detail }: { name: string; detail?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white"
      >
        {initials(name)}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-slate-900">{name}</span>
        {detail && <span className="block truncate text-xs text-slate-500">{detail}</span>}
      </span>
    </span>
  )
}

function Waiting({ count }: { count: number }) {
  return (
    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white tabular-nums">
      {count}
    </span>
  )
}

/** One opportunity waiting for a developer, with the picker that assigns one. */
function AssignRow({
  opportunity,
  developers,
  onAssigned,
}: {
  opportunity: Opportunity
  developers: DeveloperOption[]
  onAssigned: (message: string) => void
}) {
  const assign = useOutcome()
  const [developerId, setDeveloperId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const chosen = developers.find((d) => d.id === developerId)
  const id = `assign-${opportunity.id}`

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/app/automation/opportunities/${opportunity.id}`}
            className="font-semibold text-slate-900 hover:underline"
          >
            {opportunity.title}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {opportunity.tenantName ?? opportunity.ownerName} ·{' '}
            {CONTEXT_LABEL[opportunity.submissionContext]} · owner went ahead{' '}
            {formatDate(opportunity.readyAt ?? opportunity.updatedAt)}
          </p>
        </div>
        <Badge tone={opportunity.priority === 'high' ? 'bad' : 'neutral'}>
          {label(opportunity.priority)} priority
        </Badge>
      </div>
      <form
        aria-label={`Assign ${opportunity.title}`}
        className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault()
          void assign.run(
            () =>
              assignDeveloper({
                opportunityId: opportunity.id,
                developerId,
                startDate: startDate || null,
                targetDate: targetDate || null,
              }),
            () =>
              onAssigned(
                `${chosen?.name ?? 'The developer'} is assigned to “${opportunity.title}” and can start on the implementation plan.`,
              ),
          )
        }}
      >
        <label htmlFor={`${id}-developer`} className="block text-xs font-semibold text-slate-600">
          Developer
          <select
            id={`${id}-developer`}
            value={developerId}
            onChange={(event) => setDeveloperId(event.target.value)}
            className={`${controlClasses} mt-1 block w-full`}
          >
            <option value="">Choose a developer…</option>
            {developers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} - {d.activeProjects} active{' '}
                {d.activeProjects === 1 ? 'project' : 'projects'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={`${controlClasses} mt-1 block w-full`}
          />
        </label>
        <label className="block text-xs font-semibold text-slate-600">
          Target date
          <input
            type="date"
            value={targetDate}
            min={startDate || undefined}
            onChange={(event) => setTargetDate(event.target.value)}
            className={`${controlClasses} mt-1 block w-full`}
          />
        </label>
        <button
          type="submit"
          disabled={assign.busy || developerId === ''}
          className={primaryButtonClasses}
        >
          {assign.busy ? 'Assigning…' : 'Assign'}
        </button>
      </form>
      {assign.notice && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {assign.notice.text}
        </p>
      )}
      {developers.length === 0 && (
        <p className="mt-2 text-xs text-amber-800">
          Nobody can be assigned yet. Give someone the Developer role in{' '}
          <Link to="/app/admin/roles" className="font-semibold underline">
            Platform roles
          </Link>
          .
        </p>
      )}
    </li>
  )
}

function PlanRow({ project, plan }: { project: Project; plan: ImplementationPlan }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">{project.title}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          By {plan.submittedByName ?? project.assignedName} · submitted{' '}
          {formatDate(plan.submittedAt)}
        </p>
      </div>
      <Link to={`/app/automation/projects/${project.id}?tab=plan`} className={primaryButtonClasses}>
        Review plan
      </Link>
    </li>
  )
}

function StageRow({
  project,
  stage,
  onDone,
}: {
  project: Project
  stage: Stage
  onDone: (decision: StageDecisionKind) => void
}) {
  const report = stage.reports[0]
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{stage.milestone.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            <Link
              to={`/app/automation/projects/${project.id}?tab=work`}
              className="font-medium text-slate-700 hover:underline"
            >
              {project.title}
            </Link>{' '}
            · reported by {report?.authorName ?? project.assignedName} on{' '}
            {formatDate(report?.createdAt)}
          </p>
        </div>
        {stage.milestone.dueDate && (
          <span className="text-xs text-slate-500">Due {formatDate(stage.milestone.dueDate)}</span>
        )}
      </div>
      {report && (
        <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3">
          <ProposalText text={report.summary} />
        </div>
      )}
      {stage.canDecide && <StageDecision stage={stage} onDone={onDone} />}
    </li>
  )
}

/** How each stage state is marked on the timeline. */
const STAGE_MARKS: Record<string, { mark: string; dot: string; words: string; tone: string }> = {
  completed: {
    mark: '✓',
    dot: 'bg-emerald-600 text-white',
    words: 'Approved',
    tone: 'text-emerald-700',
  },
  submitted: {
    mark: '!',
    dot: 'bg-amber-400 text-amber-950',
    words: 'Waiting for your approval',
    tone: 'text-amber-700',
  },
  returned: {
    mark: '↩',
    dot: 'bg-orange-100 text-orange-700 ring-1 ring-orange-300',
    words: 'Sent back to the developer',
    tone: 'text-orange-700',
  },
  in_progress: {
    mark: '•',
    dot: 'bg-sky-100 text-sky-700 ring-1 ring-sky-300',
    words: 'In progress',
    tone: 'text-sky-700',
  },
  pending: {
    mark: '',
    dot: 'bg-white text-slate-400 ring-1 ring-slate-300',
    words: 'Not started',
    tone: 'text-slate-500',
  },
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * A project's stages as a marked timeline: where each stands, when it is due (and whether
 * it is late), how far its tasks have got, what the developer reported, and - for a stage
 * waiting on the manager - the decision itself, right there.
 */
function StageTimeline({
  stages = [],
  recent,
  onDecided,
}: {
  /** Missing when the desk was loaded before stages were part of it - drawn as none. */
  stages?: Stage[]
  recent: Record<string, StageDecisionKind>
  onDecided: (stage: Stage, decision: StageDecisionKind) => void
}) {
  if (stages.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No stages yet. The developer adds them in the implementation plan.
      </p>
    )
  }
  const today = todayIso()
  return (
    <ol aria-label="Stages" className="relative space-y-4 border-l-2 border-slate-200 pl-6">
      {stages.map((stage, index) => {
        const { milestone } = stage
        const marks = STAGE_MARKS[milestone.status] ?? STAGE_MARKS.pending
        const reports = stage.reports ?? []
        const report = reports[0]
        const approval = reports.find((r) => r.decision === 'approved')
        const overdue =
          milestone.status !== 'completed' &&
          milestone.dueDate !== null &&
          milestone.dueDate < today
        return (
          <li
            key={milestone.id}
            aria-label={`Stage ${index + 1}: ${milestone.title}`}
            className="relative"
          >
            <span
              aria-hidden="true"
              className={`absolute top-0.5 -left-[2.15rem] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${marks.dot}`}
            >
              {marks.mark || index + 1}
            </span>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-slate-900">
                <span className="mr-1.5 text-xs font-bold text-slate-400 tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {milestone.title}
              </p>
              <p className={`text-xs font-semibold ${marks.tone}`}>{marks.words}</p>
            </div>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
              <span>
                {milestone.dueDate ? `Due ${formatDate(milestone.dueDate)}` : 'No due date'}
              </span>
              {overdue && <span className="font-semibold text-red-600">Overdue</span>}
              {stage.tasksTotal > 0 && (
                <span>
                  {stage.tasksDone} of {stage.tasksTotal} tasks done
                </span>
              )}
              {approval && (
                <span className="text-emerald-700">
                  Approved by {approval.decidedByName} on {formatDate(approval.decidedAt)}
                </span>
              )}
            </p>
            {report && milestone.status !== 'pending' && (
              <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                  {report.authorName}’s report · {formatDate(report.createdAt)}
                </p>
                <div className="mt-1 line-clamp-4">
                  <ProposalText text={report.summary} />
                </div>
                {report.decision === 'returned' && report.feedback && (
                  <p className="mt-1 text-xs text-orange-800">Sent back: {report.feedback}</p>
                )}
              </div>
            )}
            {recent[milestone.id] && (
              <span
                className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold motion-safe:animate-[fade-in_200ms_ease-out] ${
                  recent[milestone.id] === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {recent[milestone.id] === 'approved' ? '✓ Just approved' : '↩ Just sent back'}
              </span>
            )}
            {stage.canDecide && (
              <StageDecision stage={stage} onDone={(decision) => onDecided(stage, decision)} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function ProjectsTable({
  rows,
  recent,
  onDecided,
}: {
  rows: DeskProject[]
  /** Stages decided on this page, by id, to mark on the timeline. */
  recent: Record<string, StageDecisionKind>
  onDecided: (stage: Stage, project: Project, decision: StageDecisionKind) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <AdminTable
      label="Projects in delivery"
      columns={['Project', 'Developer', 'Plan', 'Stages', 'Status', 'Target date']}
    >
      {rows.map(({ project, planStatus, stagesTotal, stagesApproved, stagesWaiting, stages }) => {
        const isOpen = open === project.id
        const timelineId = `desk-stages-${project.id}`
        return (
          <Fragment key={project.id}>
            <tr className={isOpen ? 'bg-slate-50' : 'hover:bg-slate-50'}>
              <td className={cellClasses}>
                <Link
                  to={`/app/automation/projects/${project.id}`}
                  className="font-semibold text-slate-900 hover:underline"
                >
                  {project.title}
                </Link>
                <span className="block text-xs text-slate-500">
                  {project.tenantName ?? project.ownerName}
                </span>
              </td>
              <td className={cellClasses}>
                <Person name={project.assignedName} />
              </td>
              <td className={cellClasses}>
                <Badge tone={PLAN_TONE[planStatus]}>{PLAN_WORDS[planStatus]}</Badge>
              </td>
              <td className={`${cellClasses} min-w-44`}>
                <span className="text-xs font-semibold text-slate-700 tabular-nums">
                  {stagesApproved} of {stagesTotal} approved
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{ width: `${stagesTotal ? (stagesApproved / stagesTotal) * 100 : 0}%` }}
                  />
                </span>
                {stagesWaiting > 0 && (
                  <span className="mt-1 block text-xs font-semibold text-amber-700">
                    {stagesWaiting} waiting for you
                  </span>
                )}
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={timelineId}
                  aria-label={`${isOpen ? 'Hide' : 'Show'} the stages of ${project.title}`}
                  onClick={() => setOpen(isOpen ? null : project.id)}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  {isOpen ? 'Hide stages' : 'Show stages'}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 7.5 5 5 5-5" />
                  </svg>
                </button>
              </td>
              <td className={cellClasses}>{label(project.status)}</td>
              <td className={`${cellClasses} whitespace-nowrap`}>
                {project.targetDate ? formatDate(project.targetDate) : 'Not set'}
              </td>
            </tr>
            {isOpen && (
              <tr id={timelineId} className="bg-slate-50">
                <td colSpan={6} className="px-6 pt-2 pb-6">
                  <div className="ml-3">
                    <StageTimeline
                      stages={stages}
                      recent={recent}
                      onDecided={(stage, decision) => onDecided(stage, project, decision)}
                    />
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </AdminTable>
  )
}

/** A stage decided on this page, kept on screen so the decision is seen to have happened. */
interface Decided {
  id: string
  stageTitle: string
  projectTitle: string
  decision: StageDecisionKind
}

function Desk({ desk, onChanged }: { desk: DeliveryDesk; onChanged: () => void }) {
  const [message, setMessage] = useState<string | null>(null)
  const [decided, setDecided] = useState<Decided[]>([])
  const decidedIds = new Set(decided.map((d) => d.id))
  // Until the reload lands, a stage just decided may still be in the desk's list.
  const waitingStages = desk.stages.filter(({ stage }) => !decidedIds.has(stage.milestone.id))

  function recordDecision(stage: Stage, project: Project, decision: StageDecisionKind) {
    setDecided((current) => [
      {
        id: stage.milestone.id,
        stageTitle: stage.milestone.title,
        projectTitle: project.title,
        decision,
      },
      ...current.filter((d) => d.id !== stage.milestone.id),
    ])
    setMessage(
      decision === 'approved'
        ? `Stage approved: “${stage.milestone.title}” on ${project.title}. The developer has been notified.`
        : `Stage sent back: “${stage.milestone.title}” on ${project.title}, with your feedback.`,
    )
    onChanged()
  }
  const inDelivery = desk.projects.filter((row) =>
    ['planning', 'active', 'testing', 'uat'].includes(row.project.status),
  ).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="To assign"
          value={desk.toAssign.length}
          hint="waiting for a developer"
          icon={<InboxIcon size="lg" />}
          tone="amber"
        />
        <MetricCard
          label="Plans to approve"
          value={desk.plans.length}
          hint="implementation plans"
          icon={<ProposalIcon size="lg" />}
          tone="violet"
        />
        <MetricCard
          label="Stages to approve"
          value={waitingStages.length}
          hint="reported done"
          icon={<ReviewIcon size="lg" />}
          tone="sky"
        />
        <MetricCard
          label="In delivery"
          value={inDelivery}
          hint={`${desk.developers.length} developers`}
          icon={<AutomationIcon size="lg" />}
          tone="brand"
        />
      </div>

      {message && (
        <output className="block rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </output>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <AdminCard title="Assign a developer" actions={<Waiting count={desk.toAssign.length} />}>
            {desk.toAssign.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nothing to assign. An opportunity appears here once its owner gives the go-ahead.
              </p>
            ) : (
              <ul className="space-y-3">
                {desk.toAssign.map((o) => (
                  <AssignRow
                    key={o.id}
                    opportunity={o}
                    developers={desk.developers}
                    onAssigned={(text) => {
                      setMessage(text)
                      onChanged()
                    }}
                  />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard
            title="Implementation plans to approve"
            actions={<Waiting count={desk.plans.length} />}
          >
            {desk.plans.length === 0 ? (
              <p className="text-sm text-slate-500">No plan is waiting for your approval.</p>
            ) : (
              <ul className="space-y-3">
                {desk.plans.map(({ project, plan }) => (
                  <PlanRow key={plan.id} project={project} plan={plan} />
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Stages to approve" actions={<Waiting count={waitingStages.length} />}>
            {decided.length > 0 && (
              <ul aria-label="Decided just now" className="mb-3 space-y-2">
                {decided.map((d) => (
                  <li key={d.id}>
                    <DecisionResult
                      decision={d.decision}
                      stageTitle={d.stageTitle}
                      projectTitle={d.projectTitle}
                      onDismiss={() =>
                        setDecided((current) => current.filter((item) => item.id !== d.id))
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            {waitingStages.length === 0 ? (
              <p className="text-sm text-slate-500">
                {decided.length
                  ? 'Nothing else is waiting for your approval.'
                  : 'No stage is waiting for your approval.'}
              </p>
            ) : (
              <ul className="space-y-3">
                {waitingStages.map(({ project, stage }) => (
                  <StageRow
                    key={stage.milestone.id}
                    project={project}
                    stage={stage}
                    onDone={(decision) => recordDecision(stage, project, decision)}
                  />
                ))}
              </ul>
            )}
          </AdminCard>
        </div>

        <AdminCard title="Developers">
          {desk.developers.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nobody has the Developer role yet.{' '}
              <Link to="/app/admin/roles" className="font-semibold text-brand-700 underline">
                Give it in Platform roles
              </Link>
              .
            </p>
          ) : (
            <ul aria-label="Developers" className="space-y-3">
              {desk.developers.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <Person name={d.name} detail={d.email} />
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                      d.activeProjects ? 'bg-sky-50 text-sky-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {d.activeProjects ? `${d.activeProjects} active` : 'Available'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <AdminCard title="Projects in delivery">
        {desk.projects.length === 0 ? (
          <p className="text-sm text-slate-500">
            No projects yet. A project opens when you assign a developer.
          </p>
        ) : (
          <ProjectsTable
            rows={desk.projects}
            recent={Object.fromEntries(decided.map((d) => [d.id, d.decision]))}
            onDecided={recordDecision}
          />
        )}
      </AdminCard>
    </div>
  )
}

/**
 * The delivery manager's desk: assign a developer to each opportunity the owner went ahead
 * with, approve the implementation plans developers write and the stages they report, and
 * follow every project in delivery. An administrator without the Delivery manager role sees
 * what is happening but cannot act; the server decides either way.
 */
export function AdminAutomationPage() {
  const desk = useAdminQuery(
    'automation:desk',
    () => deliveryDeskRequest(),
    'We could not load the delivery desk.',
  )
  const opportunities = useAdminQuery(
    'automation:opportunities',
    () => adminOpportunitiesRequest(),
    'We could not load the automation opportunities.',
  )

  return (
    <>
      <AdminPageHeader
        title="Automation delivery"
        description="Assign developers, approve their implementation plans and each stage they deliver, and follow every project in delivery."
      />

      {desk.error && <ErrorState message={desk.error} onRetry={desk.reload} />}
      {desk.loading && !desk.data && <LoadingState label="Loading the delivery desk…" />}
      {desk.data && !desk.data.canManage && (
        <p
          role="note"
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          You can follow delivery here, but assigning developers and approving plans and stages
          needs the <span className="font-semibold">Delivery manager</span> role. It is given in{' '}
          <Link to="/app/admin/roles" className="font-semibold underline">
            Platform roles
          </Link>
          .
        </p>
      )}
      {desk.data?.canManage && <Desk desk={desk.data} onChanged={desk.reload} />}

      <div className="mt-8">
        <AdminCard title="All opportunities">
          {opportunities.error && (
            <ErrorState message={opportunities.error} onRetry={opportunities.reload} />
          )}
          {opportunities.loading && !opportunities.data && (
            <LoadingState label="Loading opportunities…" />
          )}
          {opportunities.data && opportunities.data.length === 0 && (
            <EmptyState
              title="No automation opportunities."
              description="They appear once an approved idea is opened for delivery."
            />
          )}
          {opportunities.data && opportunities.data.length > 0 && (
            <AdminTable
              label="Automation opportunities"
              columns={['Opportunity', 'Owner', 'Type', 'Stage', 'Priority']}
            >
              {opportunities.data.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className={cellClasses}>
                    <Link
                      to={`/app/automation/opportunities/${o.id}`}
                      className="font-semibold text-slate-900 hover:underline"
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className={cellClasses}>{o.tenantName ?? o.ownerName}</td>
                  <td className={cellClasses}>{CONTEXT_LABEL[o.submissionContext]}</td>
                  <td className={cellClasses}>{label(o.status)}</td>
                  <td className={cellClasses}>{label(o.priority)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </AdminCard>
      </div>
    </>
  )
}
