import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { MyWork } from '../../reviews/components/MyWork'
import {
  myAutomationRolesRequest,
  myDevelopmentWorkRequest,
  myTasksRequest,
  updateTask,
  type DevelopmentWorkItem,
  type MyTask,
} from '../api/automationApi'
import { formatDate, label } from '../utils/labels'
import { MODE_HOME, modeFor, readChosenMode } from '../utils/useAutomationRoles'
import { useLoad } from '../utils/useLoad'
import { ProjectPage } from './ProjectPage'
import { useOutcome } from '../utils/useOutcome'
import { Badge, inputClass, Loading, LoadFailed, NoticeBanner } from './ui'

const PLAN_WORDS: Record<DevelopmentWorkItem['planStatus'], string> = {
  draft: 'Plan not submitted',
  submitted: 'Plan waiting for approval',
  changes_requested: 'Plan sent back',
  approved: 'Plan approved',
}

/** A project's delivery, as the developer goes through it. */
const JOURNEY = [
  'Plan',
  'Admin approval',
  'Build stages',
  'Admin confirmation',
  'Testing & release',
]

function journeyStep(item: DevelopmentWorkItem): number {
  const { project, planStatus } = item
  if (project.status === 'planning') return planStatus === 'submitted' ? 1 : 0
  if (project.status === 'active') return item.stagesWaiting > 0 ? 3 : 2
  return 4
}

function Journey({ item }: { item: DevelopmentWorkItem }) {
  const step = journeyStep(item)
  return (
    <ol aria-label="Delivery progress" className="grid grid-cols-5 gap-1.5">
      {JOURNEY.map((name, index) => (
        <li key={name} aria-current={index === step ? 'step' : undefined} className="min-w-0">
          <span
            className={`block h-1.5 rounded-full ${
              index < step ? 'bg-brand-600' : index === step ? 'bg-amber-400' : 'bg-gray-200'
            }`}
          />
          <span
            className={`mt-1.5 block truncate text-[11px] ${
              index === step
                ? 'font-semibold text-gray-900'
                : index < step
                  ? 'text-brand-700'
                  : 'text-gray-500'
            }`}
          >
            {name}
          </span>
        </li>
      ))}
    </ol>
  )
}

function ProjectCard({ item }: { item: DevelopmentWorkItem }) {
  const { project } = item
  const percent = item.stagesTotal ? Math.round((item.stagesApproved / item.stagesTotal) * 100) : 0
  return (
    <li
      className={`rounded-xl border bg-white p-5 shadow-sm ${
        item.needsMe ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to={`/app/automation/workspace/${project.id}`}
            className="text-lg font-semibold text-gray-900 hover:underline"
          >
            {project.title}
          </Link>
          <p className="mt-0.5 text-sm text-gray-500">
            For {project.tenantName ?? project.ownerName}
            {project.targetDate && ` · target ${formatDate(project.targetDate)}`}
            {item.stagesTotal > 0 &&
              ` · ${item.stagesApproved} of ${item.stagesTotal} stages approved (${percent}%)`}
          </p>
        </div>
        <Badge value={item.planStatus} text={PLAN_WORDS[item.planStatus]} />
      </div>

      <div className="mt-4">
        <Journey item={item} />
      </div>

      <div
        className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3 ${
          item.needsMe ? 'bg-amber-50' : 'bg-gray-50'
        }`}
      >
        <p className="text-sm">
          <span
            className={`mr-2 text-[11px] font-bold tracking-wider uppercase ${
              item.needsMe ? 'text-amber-800' : 'text-gray-500'
            }`}
          >
            {item.needsMe ? 'Your next step' : 'Next'}
          </span>
          <span className="font-medium text-gray-900">{item.nextAction}</span>
        </p>
        <Link
          to={`/app/automation/workspace/${project.id}?tab=${item.nextTab}`}
          className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold shadow-sm ${
            item.needsMe
              ? 'bg-brand-600 text-white hover:bg-brand-700'
              : 'border border-brand-300 bg-white text-brand-700 hover:bg-brand-50'
          }`}
        >
          {item.needsMe ? 'Open and do it' : 'Open project'}
        </Link>
      </div>
    </li>
  )
}

function ProjectList({ items }: { items: DevelopmentWorkItem[] }) {
  return (
    <ul aria-label="My development work" className="space-y-3">
      {items.map((item) => (
        <ProjectCard key={item.project.id} item={item} />
      ))}
    </ul>
  )
}

function heading(items: DevelopmentWorkItem[]): string {
  const waiting = items.filter((item) => item.needsMe).length
  if (waiting === 0) return 'Nothing is waiting on you'
  return `${waiting} ${waiting === 1 ? 'project needs' : 'projects need'} you`
}

/** The four ways delivery moves, so a new developer knows the path. */
function HowItWorks() {
  const steps = [
    ['Get assigned', 'The delivery manager assigns you a project.'],
    ['Write the plan', 'From the agreed proposal: approach, architecture, stages.'],
    ['Admin approves', 'Approval starts implementation.'],
    ['Build and report', 'Report each stage done for the admin to confirm.'],
  ]
  return (
    <section aria-label="How delivery works" className="rounded-xl bg-brand-50/60 px-5 py-4">
      <h3 className="text-sm font-bold text-brand-900">How delivery works</h3>
      <ol className="mt-3 grid gap-3 sm:grid-cols-4">
        {steps.map(([title, text], index) => (
          <li key={title} className="flex gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
              {index + 1}
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-900">{title}</span>
              <span className="block text-xs text-gray-600">{text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 5 5 5-5 5" />
    </svg>
  )
}

/**
 * One assigned project as a row that opens. Closed, it is only its title (and a dot when
 * it is waiting on the developer); open, it shows the next step and the whole project,
 * with its own tabs, beneath.
 */
function ProjectRow({
  item,
  open,
  tab,
  onToggle,
}: {
  item: DevelopmentWorkItem
  open: boolean
  tab: string
  onToggle: () => void
}) {
  const { project } = item
  const bodyId = `workspace-project-${project.id}`
  return (
    <li
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
        open ? 'border-brand-300 ring-1 ring-brand-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-300"
      >
        <Chevron open={open} />
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-gray-900">
          {project.title}
        </span>
        {item.needsMe && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-amber-700">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Needs you
          </span>
        )}
        {open && <Badge value={project.status} />}
      </button>
      {open && (
        <div id={bodyId} className="border-t border-gray-100 px-5 pt-4 pb-5">
          {/* Remounted per requested tab, so "Open and do it" always lands on the right one. */}
          <ProjectPage
            key={`${project.id}:${tab}`}
            embedded
            lead={
              <p
                className={`inline-flex max-w-full flex-wrap items-baseline gap-x-2 rounded-lg px-3 py-2 text-sm ${
                  item.needsMe ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'
                }`}
              >
                <span className="text-[11px] font-bold tracking-wider uppercase">
                  {item.needsMe ? 'Your next step' : 'Next'}
                </span>
                <span className="font-medium">{item.nextAction}</span>
              </p>
            }
          />
        </div>
      )}
    </li>
  )
}

/**
 * The developer's workspace at `/app/automation/workspace[/:projectId]`: every project
 * assigned to them as a row, closed to its title until opened. One is open at a time -
 * the one in the address - so each is worked on by itself, and closing it leaves only the
 * titles.
 */
export function WorkspacePage() {
  const { projectId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const work = useLoad(myDevelopmentWorkRequest, 'my-development-work')

  if (work.loading) return <Loading what="your workspace" />
  if (work.failed) return <LoadFailed what="your workspace" onRetry={work.reload} />
  const projects = work.data ?? []

  if (projects.length === 0) {
    return (
      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">No project is assigned to you yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            When the delivery manager assigns you one, it appears here with your next step.
          </p>
        </div>
        <HowItWorks />
      </div>
    )
  }

  const waiting = projects.filter((item) => item.needsMe).length
  const tab = params.get('tab') ?? ''
  return (
    <section aria-labelledby="workspace-projects" className="mt-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="workspace-projects" className="text-lg font-bold text-gray-900">
          My projects{' '}
          <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-sm text-gray-700 tabular-nums">
            {projects.length}
          </span>
        </h2>
        {waiting > 0 && (
          <span className="text-sm font-semibold text-amber-700">
            {waiting} {waiting === 1 ? 'needs' : 'need'} you
          </span>
        )}
      </div>
      <ul aria-label="My development work" className="space-y-3">
        {projects.map((item) => {
          const open = item.project.id === projectId
          return (
            <ProjectRow
              key={item.project.id}
              item={item}
              open={open}
              tab={tab}
              onToggle={() =>
                navigate(
                  open
                    ? '/app/automation/workspace'
                    : `/app/automation/workspace/${item.project.id}?tab=${item.nextTab}`,
                )
              }
            />
          )
        })}
      </ul>
    </section>
  )
}

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done']

function TaskRow({ item, onChanged }: { item: MyTask; onChanged: () => void }) {
  const change = useOutcome()
  const { task } = item
  return (
    <li className="grid gap-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-500">
          {item.stageTitle && <span>Stage: {item.stageTitle}</span>}
          {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
          <span>{label(task.priority)} priority</span>
        </p>
        <NoticeBanner notice={change.notice} />
      </div>
      <select
        aria-label={`Status of ${task.title}`}
        value={task.status}
        disabled={change.busy}
        onChange={(event) =>
          void change.run(
            () => updateTask({ input: { id: task.id, status: event.target.value } }),
            onChanged,
          )
        }
        className={`${inputClass} w-40`}
      >
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {label(value)}
          </option>
        ))}
      </select>
    </li>
  )
}

/** Every open task on the developer's projects, grouped by project, with status at hand. */
export function MyTasksPage() {
  const tasks = useLoad(myTasksRequest, 'my-tasks')

  if (tasks.loading) return <Loading what="your tasks" />
  if (tasks.failed) return <LoadFailed what="your tasks" onRetry={tasks.reload} />
  const list = tasks.data ?? []
  const byProject = new Map<string, { title: string; items: MyTask[] }>()
  for (const item of list) {
    const group = byProject.get(item.projectId) ?? { title: item.projectTitle, items: [] }
    group.items.push(item)
    byProject.set(item.projectId, group)
  }

  return (
    <section aria-labelledby="tasks-heading" className="mt-6">
      <h2 id="tasks-heading" className="text-xl font-bold text-gray-900">
        {list.length ? `${list.length} open ${list.length === 1 ? 'task' : 'tasks'}` : 'My tasks'}
      </h2>
      <p className="mt-1 mb-4 text-sm text-gray-600">
        Tasks on your projects that are yours or not yet assigned. Blocked ones come first.
      </p>
      {byProject.size === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="font-semibold text-gray-900">No open tasks.</p>
          <p className="mt-1 text-sm text-gray-600">
            Break a stage into tasks on the project’s Stages &amp; tasks tab.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...byProject.entries()].map(([projectId, group]) => (
            <section
              key={projectId}
              aria-label={group.title}
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900">{group.title}</h3>
                <Link
                  to={`/app/automation/projects/${projectId}?tab=work`}
                  className="text-sm font-semibold text-brand-700 hover:underline"
                >
                  Open project
                </Link>
              </div>
              <ul className="divide-y divide-gray-100">
                {group.items.map((item) => (
                  <TaskRow key={item.task.id} item={item} onChanged={tasks.reload} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

/** The reviewer's work, inside Automation for someone who reviews and develops. */
export function ReviewQueuePage() {
  return <MyWork />
}

/**
 * The same project list on a reviewer's "My work", for someone who is both reviewer and
 * developer. Draws nothing for anyone with no development work.
 */
export function DevelopmentWorkSection() {
  const work = useLoad(myDevelopmentWorkRequest, 'my-development-work')
  if (!work.data?.length) return null
  return (
    <section aria-labelledby="dev-work-section-heading" className="mt-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
        Development
      </p>
      <h2 id="dev-work-section-heading" className="mt-1 mb-4 text-2xl font-semibold text-gray-900">
        {heading(work.data)}
      </h2>
      <ProjectList items={work.data} />
    </section>
  )
}

/**
 * `/app/automation`: open on the page of the job the person does - their workspace as a
 * developer, their review queue as a reviewer (whichever they last chose when both), the
 * opportunities otherwise.
 */
export function AutomationHome() {
  const roles = useLoad(myAutomationRolesRequest, 'automation-roles')
  if (roles.loading) return <Loading what="automation" />
  if (!roles.data) return <Navigate to="opportunities" replace />
  return <Navigate to={MODE_HOME[modeFor(roles.data, readChosenMode())]} replace />
}
