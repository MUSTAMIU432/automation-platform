import { useState } from 'react'

import { ProposalText } from '../../proposals/components/ProposalSections'
import {
  approveStage,
  createTask,
  projectStagesRequest,
  returnStage,
  submitStage,
  tasksRequest,
  updateTask,
  type Project,
  type Stage,
  type StageReport,
  type Task,
} from '../api/automationApi'
import { formatDate, label } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { useOutcome } from '../utils/useOutcome'
import {
  Badge,
  dangerButton,
  Empty,
  inputClass,
  Loading,
  LoadFailed,
  NoticeBanner,
  primaryButton,
  secondaryButton,
} from './ui'

const STAGE_WORDS: Record<string, string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  submitted: 'Waiting for approval',
  returned: 'Sent back',
  completed: 'Approved',
}

const DECISION_WORDS: Record<StageReport['decision'], string> = {
  pending: 'Waiting for a decision',
  approved: 'Approved',
  returned: 'Sent back',
}

function ReportHistory({ reports }: { reports: StageReport[] }) {
  if (reports.length === 0) return null
  return (
    <ol aria-label="Reports" className="mt-4 space-y-3 border-l-2 border-gray-200 pl-4">
      {reports.map((report) => (
        <li key={report.id} className="relative">
          <span
            aria-hidden="true"
            className={`absolute top-1.5 -left-[1.4rem] h-3 w-3 rounded-full ring-2 ring-white ${
              report.decision === 'approved'
                ? 'bg-emerald-500'
                : report.decision === 'returned'
                  ? 'bg-amber-500'
                  : 'bg-sky-500'
            }`}
          />
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">{report.authorName}</span> reported on{' '}
            {formatDate(report.createdAt)} · {DECISION_WORDS[report.decision]}
          </p>
          <div className="mt-1 rounded-lg bg-gray-50 px-4 py-3">
            <ProposalText text={report.summary} />
          </div>
          {report.feedback && (
            <p className="mt-2 rounded-lg bg-amber-50/70 px-4 py-2 text-sm text-amber-900">
              <span className="font-semibold">{report.decidedByName}:</span> {report.feedback}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

/** The developer's report that a stage is done. */
/**
 * The developer's report that a stage is done: written, then previewed as the delivery
 * manager will read it, and only then submitted - "Edit report" goes back to the text.
 */
function ReportForm({
  stage,
  openTasks,
  onDone,
}: {
  stage: Stage
  /** Tasks in this stage not yet done - worth a word before reporting it done. */
  openTasks: number
  onDone: () => void
}) {
  const send = useOutcome()
  const [summary, setSummary] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const id = `stage-${stage.milestone.id}-report`

  if (previewing) {
    return (
      <section
        aria-label={`Preview of the report on ${stage.milestone.title}`}
        className="mt-4 overflow-hidden rounded-lg border border-brand-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-4 py-2.5">
          <p className="text-xs font-bold tracking-wider text-brand-800 uppercase">
            Report preview
          </p>
          <p className="text-xs text-gray-600">What the delivery manager will read</p>
        </div>
        <div className="px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-gray-900">{stage.milestone.title}</p>
          <ProposalText text={summary} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3">
          <button
            type="button"
            disabled={send.busy}
            className={primaryButton}
            onClick={() =>
              void send.run(
                () => submitStage({ milestoneId: stage.milestone.id, summary }),
                () => {
                  setSummary('')
                  setPreviewing(false)
                  onDone()
                },
              )
            }
          >
            {send.busy ? 'Submitting…' : 'Submit for approval'}
          </button>
          <button
            type="button"
            disabled={send.busy}
            onClick={() => setPreviewing(false)}
            className="text-sm font-semibold text-gray-600 hover:text-gray-900"
          >
            Edit report
          </button>
          <div className="basis-full">
            <NoticeBanner notice={send.notice} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <form
      aria-label={`Report ${stage.milestone.title}`}
      className="mt-4 rounded-lg border border-brand-200 bg-brand-50/40 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        send.clear()
        setPreviewing(true)
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        What was done in this stage
      </label>
      <p className="text-xs text-gray-500">
        What you built, how it was checked, and anything the delivery manager should know.
      </p>
      {openTasks > 0 && (
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {openTasks} {openTasks === 1 ? 'task in this stage is' : 'tasks in this stage are'} not
          done yet. You can still report it; say why in the report.
        </p>
      )}
      <textarea
        id={id}
        rows={4}
        value={summary}
        onChange={(event) => setSummary(event.target.value)}
        className={`${inputClass} mt-2`}
      />
      <button type="submit" disabled={summary.trim() === ''} className={`${primaryButton} mt-2`}>
        Preview report
      </button>
    </form>
  )
}

/** The delivery manager's decision on a reported stage. */
export type StageDecisionKind = 'approved' | 'returned'

/**
 * What the delivery manager sees straight after deciding a stage, in the place the
 * decision was taken - so approving is something that visibly happens, not a card that
 * quietly gives way to the next one.
 */
export function DecisionResult({
  decision,
  stageTitle,
  projectTitle,
  onDismiss,
}: {
  decision: StageDecisionKind
  stageTitle: string
  projectTitle?: string
  onDismiss?: () => void
}) {
  const approved = decision === 'approved'
  return (
    <output
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 motion-safe:animate-[fade-in_200ms_ease-out] ${
        approved ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ${
          approved ? 'bg-emerald-600' : 'bg-amber-500'
        }`}
      >
        {approved ? '✓' : '↩'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`font-semibold ${approved ? 'text-emerald-900' : 'text-amber-900'}`}>
          {approved ? 'Stage approved' : 'Stage sent back'}
        </p>
        <p className={`text-sm ${approved ? 'text-emerald-800' : 'text-amber-800'}`}>
          “{stageTitle}”{projectTitle ? ` on ${projectTitle}` : ''}{' '}
          {approved
            ? 'is approved and complete. The developer has been notified.'
            : 'went back to the developer with your feedback.'}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-gray-500 hover:bg-white/60 hover:text-gray-800"
        >
          ✕
        </button>
      )}
    </output>
  )
}

export function StageDecision({
  stage,
  onDone,
}: {
  stage: Stage
  /** Called once the server has taken the decision, with what it was. */
  onDone: (decision: StageDecisionKind) => void
}) {
  const decide = useOutcome()
  const [pending, setPending] = useState<StageDecisionKind | null>(null)
  const [feedback, setFeedback] = useState('')
  const id = `stage-${stage.milestone.id}-feedback`
  return (
    <div className="mt-4 rounded-lg border-2 border-brand-200 bg-white p-4">
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800">
        Feedback for the developer{' '}
        <span className="font-normal text-gray-500">(needed to send it back)</span>
      </label>
      <textarea
        id={id}
        rows={2}
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        className={`${inputClass} mt-2`}
      />
      <div className="mt-2">
        <NoticeBanner notice={decide.notice} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={decide.busy}
          className={primaryButton}
          onClick={() => {
            setPending('approved')
            void decide.run(
              () => approveStage({ milestoneId: stage.milestone.id, feedback }),
              () => onDone('approved'),
            )
          }}
        >
          {decide.busy && pending === 'approved' ? 'Approving…' : 'Approve stage'}
        </button>
        <button
          type="button"
          disabled={decide.busy}
          className={dangerButton}
          onClick={() => {
            setPending('returned')
            void decide.run(
              () => returnStage({ milestoneId: stage.milestone.id, feedback }),
              () => onDone('returned'),
            )
          }}
        >
          {decide.busy && pending === 'returned' ? 'Sending back…' : 'Send back'}
        </button>
      </div>
    </div>
  )
}

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done']

/** The tasks that make up one stage: listed with their status, and added to the stage. */
function StageTasks({
  project,
  milestoneId,
  tasks,
  editable,
  onChanged,
}: {
  project: Project
  milestoneId: string | null
  tasks: Task[]
  editable: boolean
  onChanged: () => void
}) {
  const add = useOutcome()
  const change = useOutcome()
  const [title, setTitle] = useState('')
  const done = tasks.filter((task) => task.status === 'done').length

  return (
    <section aria-label="Tasks" className="mt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900">Tasks</h4>
        {tasks.length > 0 && (
          <span className="text-xs text-gray-500 tabular-nums">
            {done} of {tasks.length} done
          </span>
        )}
      </div>
      {tasks.length > 0 ? (
        <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <span
                className={`min-w-0 text-sm ${
                  task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}
              >
                {task.title}
              </span>
              {editable ? (
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
                  className={`${inputClass} w-36 py-1.5`}
                >
                  {TASK_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge value={task.status} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No tasks in this stage yet.</p>
      )}
      <div className="mt-2">
        <NoticeBanner notice={change.notice ?? add.notice} />
      </div>
      {editable && milestoneId && (
        <form
          aria-label="Add a task to this stage"
          className="mt-2 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void add.run(
              () =>
                createTask({
                  projectId: project.id,
                  title,
                  priority: 'medium',
                  milestoneId,
                }),
              () => {
                setTitle('')
                onChanged()
              },
            )
          }}
        >
          <input
            aria-label="New task"
            placeholder="Add a task to this stage"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={add.busy || title.trim() === ''}
            className={secondaryButton}
          >
            Add
          </button>
        </form>
      )}
    </section>
  )
}

function StageChevron({ open }: { open: boolean }) {
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
 * The plan's stages as delivery goes, each holding the tasks that make it up. A stage is
 * folded to one line - its title, due date, status and how many of its tasks are done -
 * and opens to its tasks, the developer's report and the delivery manager's decision.
 * Tasks are added to a stage, so the work and the stage it belongs to stay together.
 */
export function StagesPanel({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const stages = useLoad(() => projectStagesRequest(project.id), `stages:${project.id}`)
  const tasks = useLoad(() => tasksRequest(project.id), `tasks:${project.id}`)
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  // Decisions taken on this page, shown on their stage until the page is left.
  const [decided, setDecided] = useState<Record<string, StageDecisionKind>>({})
  const editable =
    project.capabilities.canManage &&
    ['planning', 'active', 'testing', 'uat'].includes(project.status)
  const refresh = () => {
    stages.reload()
    tasks.reload()
    onChanged()
  }
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (stages.loading || tasks.loading) return <Loading what="the stages" />
  if (stages.failed || tasks.failed) return <LoadFailed what="the stages" onRetry={refresh} />
  const list = stages.data ?? []
  const allTasks = tasks.data ?? []
  if (list.length === 0) {
    return (
      <Empty title="No stages yet.">
        The developer adds the stages in the implementation plan.
      </Empty>
    )
  }
  const approved = list.filter((s) => s.milestone.status === 'completed').length
  const stageIds = new Set(list.map((s) => s.milestone.id))
  const loose = allTasks.filter((task) => !task.milestoneId || !stageIds.has(task.milestoneId))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-700">
          {approved} of {list.length} stages approved
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(new Set(list.map((s) => s.milestone.id)))}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setOpen(new Set())}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Collapse all
          </button>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${(approved / list.length) * 100}%` }}
        />
      </div>
      <ol className="space-y-2">
        {list.map((stage, index) => {
          const { milestone } = stage
          const isOpen = open.has(milestone.id)
          const stageTasks = allTasks.filter((task) => task.milestoneId === milestone.id)
          const doneTasks = stageTasks.filter((task) => task.status === 'done').length
          const needsMe = stage.canDecide || (stage.canReport && milestone.status === 'returned')
          const bodyId = `stage-${milestone.id}-body`
          return (
            <li
              key={milestone.id}
              aria-label={`Stage ${index + 1}: ${milestone.title}`}
              className={`rounded-xl border bg-white shadow-sm transition ${
                isOpen ? 'border-gray-300' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={bodyId}
                onClick={() => toggle(milestone.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left sm:px-5"
              >
                <StageChevron open={isOpen} />
                <span
                  aria-hidden="true"
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    milestone.status === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-brand-600 text-white'
                  }`}
                >
                  {milestone.status === 'completed' ? '✓' : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-gray-900">
                    {milestone.title}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {milestone.dueDate ? `Due ${formatDate(milestone.dueDate)}` : 'No due date'}
                    {stageTasks.length > 0 && ` · ${doneTasks} of ${stageTasks.length} tasks done`}
                    {milestone.completedAt && ` · Approved ${formatDate(milestone.completedAt)}`}
                  </span>
                </span>
                {needsMe && (
                  <span className="hidden shrink-0 items-center gap-1.5 text-xs font-semibold text-amber-700 sm:inline-flex">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-amber-400" />
                    Needs you
                  </span>
                )}
                <Badge
                  value={milestone.status}
                  text={STAGE_WORDS[milestone.status] ?? milestone.status}
                />
              </button>
              {isOpen && (
                <div id={bodyId} className="border-t border-gray-100 px-4 pt-3 pb-5 sm:px-5">
                  {milestone.description && (
                    <p className="text-sm text-gray-600">{milestone.description}</p>
                  )}
                  <StageTasks
                    project={project}
                    milestoneId={milestone.id}
                    tasks={stageTasks}
                    editable={editable && milestone.status !== 'completed'}
                    onChanged={refresh}
                  />
                  {stage.canReport && (
                    <ReportForm
                      stage={stage}
                      openTasks={stageTasks.length - doneTasks}
                      onDone={refresh}
                    />
                  )}
                  {decided[milestone.id] && (
                    <div className="mt-4">
                      <DecisionResult
                        decision={decided[milestone.id]}
                        stageTitle={milestone.title}
                      />
                    </div>
                  )}
                  {stage.canDecide && (
                    <StageDecision
                      stage={stage}
                      onDone={(decision) => {
                        setDecided((current) => ({ ...current, [milestone.id]: decision }))
                        refresh()
                      }}
                    />
                  )}
                  <ReportHistory reports={stage.reports} />
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {loose.length > 0 && (
        <section
          aria-label="Not in a stage"
          className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 sm:px-5"
        >
          <h4 className="text-sm font-bold text-gray-900">Not in a stage</h4>
          <p className="text-xs text-gray-500">Tasks added before stages were planned.</p>
          <StageTasks
            project={project}
            milestoneId={null}
            tasks={loose}
            editable={editable}
            onChanged={refresh}
          />
        </section>
      )}
    </div>
  )
}
