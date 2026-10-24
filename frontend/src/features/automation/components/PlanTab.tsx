import { useEffect, useRef, useState } from 'react'

import { ProposalText } from '../../proposals/components/ProposalSections'
import {
  addStage,
  approveImplementationPlan,
  implementationPlanRequest,
  PLAN_SECTIONS,
  projectStagesRequest,
  removeStage,
  returnImplementationPlan,
  submitImplementationPlan,
  updateImplementationPlan,
  type ImplementationPlan,
  type PlanField,
  type Project,
  type Stage,
} from '../api/automationApi'
import { formatDate } from '../utils/labels'
import { useLoad } from '../utils/useLoad'
import { useOutcome } from '../utils/useOutcome'
import {
  Badge,
  cardClass,
  dangerButton,
  inputClass,
  Loading,
  LoadFailed,
  NoticeBanner,
  primaryButton,
  secondaryButton,
} from './ui'

const PLAN_STATUS_WORDS: Record<ImplementationPlan['status'], string> = {
  draft: 'Being written',
  submitted: 'Waiting for approval',
  changes_requested: 'Sent back for changes',
  approved: 'Approved',
}

/** A text field that grows with what is written in it. */
function grow(field: HTMLTextAreaElement | null) {
  if (!field) return
  field.style.height = 'auto'
  field.style.height = `${field.scrollHeight}px`
}

/** Where the plan stands, as three steps: written, approved, implementing. */
function PlanSteps({ status }: { status: ImplementationPlan['status'] }) {
  const reached = status === 'approved' ? 3 : status === 'submitted' ? 2 : 1
  const steps = ['Developer writes the plan', 'Delivery manager approves', 'Implementation']
  return (
    <ol aria-label="Plan progress" className="grid gap-2 sm:grid-cols-3">
      {steps.map((text, index) => {
        const step = index + 1
        const done = step < reached || (step === 3 && status === 'approved')
        const current = step === reached && !done
        return (
          <li
            key={text}
            aria-current={current ? 'step' : undefined}
            className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
              done
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : current
                  ? 'border-brand-300 bg-brand-50 font-semibold text-brand-800'
                  : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                done
                  ? 'bg-emerald-600 text-white'
                  : current
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-500'
              }`}
            >
              {done ? '✓' : step}
            </span>
            {text}
          </li>
        )
      })}
    </ol>
  )
}

/** The stages of the plan: listed, and - while the plan is being written - added or removed. */
function StagesEditor({
  project,
  stages,
  editable,
  onChanged,
}: {
  project: Project
  stages: Stage[]
  editable: boolean
  onChanged: () => void
}) {
  const add = useOutcome()
  const remove = useOutcome()
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [description, setDescription] = useState('')

  return (
    <section aria-labelledby="plan-stages-heading" className={cardClass}>
      <h4 id="plan-stages-heading" className="text-base font-semibold text-gray-900">
        Stages
        {editable && <span className="ml-0.5 text-red-600">*</span>}
      </h4>
      <p className="mt-0.5 text-sm text-gray-500">
        The steps you will deliver in. You report each one when it is done, and the delivery manager
        approves it.
      </p>
      {stages.length > 0 ? (
        <ol className="mt-4 space-y-2">
          {stages.map(({ milestone }, index) => (
            <li
              key={milestone.id}
              className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900">{milestone.title}</p>
                <p className="text-xs text-gray-500">
                  {milestone.dueDate ? `Due ${formatDate(milestone.dueDate)}` : 'No due date'}
                </p>
                {milestone.description && (
                  <p className="mt-1 text-sm whitespace-pre-line text-gray-600">
                    {milestone.description}
                  </p>
                )}
              </div>
              {editable && (
                <button
                  type="button"
                  aria-label={`Remove stage ${milestone.title}`}
                  disabled={remove.busy}
                  onClick={() =>
                    void remove.run(() => removeStage({ milestoneId: milestone.id }), onChanged)
                  }
                  className="text-sm font-semibold text-gray-500 hover:text-red-700"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
          No stages yet.
        </p>
      )}
      <div className="mt-3">
        <NoticeBanner notice={remove.notice} />
      </div>

      {editable && (
        <form
          aria-label="Add a stage"
          className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[1fr_11rem]"
          onSubmit={(event) => {
            event.preventDefault()
            void add.run(
              () =>
                addStage({
                  projectId: project.id,
                  title,
                  description: description || null,
                  dueDate: dueDate || null,
                }),
              () => {
                setTitle('')
                setDueDate('')
                setDescription('')
                onChanged()
              },
            )
          }}
        >
          <label className="block text-sm font-semibold text-gray-700">
            Stage title
            <input
              className={`${inputClass} mt-1`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700">
            Due date
            <input
              type="date"
              className={`${inputClass} mt-1`}
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <label className="block text-sm font-semibold text-gray-700 sm:col-span-2">
            What this stage delivers <span className="font-normal text-gray-500">(optional)</span>
            <textarea
              rows={2}
              className={`${inputClass} mt-1`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <NoticeBanner notice={add.notice} />
            <button
              type="submit"
              disabled={add.busy || title.trim() === ''}
              className={`${secondaryButton} mt-1`}
            >
              Add stage
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/**
 * The developer's form, as cards that fold - the same way the proposal is written: a long
 * plan is written a section at a time. Written sections start folded and empty ones open,
 * so the developer lands on what is left; "Expand all" and "Collapse all" do what they say.
 * Everything is still one form, saved together.
 */
function PlanForm({
  plan,
  onSaved,
  onValuesChange,
}: {
  plan: ImplementationPlan
  onSaved: () => void
  /** The text as it stands, saved or not - for the preview. */
  onValuesChange: (values: Record<PlanField, string>) => void
}) {
  const save = useOutcome()
  const [values, setValues] = useState<Record<PlanField, string>>(
    () =>
      Object.fromEntries(PLAN_SECTIONS.map((s) => [s.key, plan[s.key]])) as Record<
        PlanField,
        string
      >,
  )
  useEffect(() => onValuesChange(values), [values, onValuesChange])
  const [folded, setFolded] = useState<Set<PlanField>>(
    () => new Set(PLAN_SECTIONS.filter((s) => plan[s.key].trim()).map((s) => s.key)),
  )
  const dirty = PLAN_SECTIONS.some((s) => values[s.key] !== plan[s.key])
  const written = PLAN_SECTIONS.filter((s) => values[s.key].trim()).length
  const toggle = (key: PlanField) =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <form
      aria-label="Implementation plan"
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void save.run(
          () => updateImplementationPlan({ input: { projectId: plan.projectId, ...values } }),
          onSaved,
        )
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-800">
            {written} of {PLAN_SECTIONS.length} sections written.
          </span>{' '}
          Sections marked <span className="font-semibold text-red-600">*</span> are needed before
          the plan can be submitted.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFolded(new Set())}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setFolded(new Set(PLAN_SECTIONS.map((s) => s.key)))}
            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Collapse all
          </button>
        </div>
      </div>

      {PLAN_SECTIONS.map((section, index) => {
        const id = `plan-${section.key}`
        const isOpen = !folded.has(section.key)
        const filled = Boolean(values[section.key].trim())
        return (
          <div
            key={section.key}
            className={`rounded-2xl border bg-white shadow-sm transition ${
              isOpen ? 'border-gray-300' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={`${id}-body`}
              onClick={() => toggle(section.key)}
              className="flex w-full items-center gap-3 px-5 py-4 text-left sm:px-6"
            >
              <span
                aria-hidden="true"
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  filled ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex-1 text-base font-semibold text-gray-900">
                {section.label}
                {section.required && (
                  <span aria-hidden="true" className="ml-0.5 text-red-600">
                    *
                  </span>
                )}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  filled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {filled ? 'Written ✓' : 'Empty'}
              </span>
              <span aria-hidden="true" className="text-gray-400">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && (
              <div id={`${id}-body`} className="border-t border-gray-100 px-5 pt-4 pb-5 sm:px-6">
                <label htmlFor={id} className="sr-only">
                  {section.label}
                  {section.required ? '*' : ''}
                </label>
                <p id={`${id}-hint`} className="mb-3 text-sm text-gray-500">
                  {section.hint}
                </p>
                <textarea
                  id={id}
                  ref={grow}
                  rows={4}
                  aria-describedby={`${id}-hint`}
                  value={values[section.key]}
                  onChange={(event) => {
                    grow(event.target)
                    setValues((v) => ({ ...v, [section.key]: event.target.value }))
                  }}
                  className="block min-h-28 w-full resize-none overflow-hidden rounded-xl border border-gray-300 bg-white px-4 py-3 text-[15px] leading-7 text-gray-900 shadow-sm focus:border-brand-500 focus:ring-4 focus:ring-brand-100 focus:outline-none"
                />
              </div>
            )}
          </div>
        )
      })}
      <NoticeBanner notice={save.notice} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={save.busy || !dirty} className={secondaryButton}>
          {save.busy ? 'Saving…' : 'Save plan'}
        </button>
        {dirty && <span className="text-xs text-amber-700">You have unsaved changes.</span>}
      </div>
    </form>
  )
}

/** The plan as a document, for reading and deciding on. */
function PlanDocument({
  plan,
  stages,
  showMissing = false,
}: {
  plan: ImplementationPlan
  stages: Stage[]
  /** For the preview: a required section still empty keeps its place, marked. */
  showMissing?: boolean
}) {
  const written = PLAN_SECTIONS.filter(
    (section) => plan[section.key].trim() || (showMissing && section.required),
  )
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div
        aria-hidden="true"
        className="h-1 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-400"
      />
      <div className="divide-y divide-gray-100 px-6 sm:px-8">
        {written.length === 0 && (
          <p className="py-6 text-sm text-gray-500">Nothing has been written yet.</p>
        )}
        {written.map((section, index) => (
          <section key={section.key} className="grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[12rem_1fr]">
            <h4 className="flex items-baseline gap-2.5 text-base font-semibold text-gray-900">
              <span className="text-sm font-bold text-brand-600 tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              {section.label}
            </h4>
            {plan[section.key].trim() ? (
              <ProposalText text={plan[section.key]} />
            ) : (
              <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Not written yet - needed before the plan can be submitted.
              </p>
            )}
          </section>
        ))}
        <section className="grid gap-x-6 gap-y-2 py-6 sm:grid-cols-[12rem_1fr]">
          <h4 className="text-base font-semibold text-gray-900">Stages</h4>
          {stages.length ? (
            <ol className="space-y-2">
              {stages.map(({ milestone }, index) => (
                <li key={milestone.id} className="flex gap-3 text-[15px] leading-7 text-gray-700">
                  <span className="font-semibold text-brand-700 tabular-nums">{index + 1}.</span>
                  <span>
                    <span className="font-semibold text-gray-900">{milestone.title}</span>
                    {milestone.dueDate && (
                      <span className="text-gray-500"> - due {formatDate(milestone.dueDate)}</span>
                    )}
                    {milestone.description && (
                      <span className="block text-sm text-gray-600">{milestone.description}</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          ) : showMissing ? (
            <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No stages yet - add at least one before submitting.
            </p>
          ) : (
            <p className="text-sm text-gray-500">No stages yet.</p>
          )}
        </section>
      </div>
    </article>
  )
}

/** The delivery manager's decision: approve (which starts implementation) or send back. */
function PlanDecision({ plan, onDone }: { plan: ImplementationPlan; onDone: () => void }) {
  const decide = useOutcome()
  const [feedback, setFeedback] = useState('')
  return (
    <section
      aria-label="Your decision"
      className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-5"
    >
      <h4 className="text-base font-semibold text-gray-900">Your decision</h4>
      <p className="mt-0.5 text-sm text-gray-600">
        Approving the plan allows implementation to start. To send it back, say what needs to
        change.
      </p>
      <label className="mt-3 block text-sm font-semibold text-gray-700">
        Feedback for the developer
        <textarea
          rows={3}
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          className={`${inputClass} mt-1`}
        />
      </label>
      <div className="mt-3">
        <NoticeBanner notice={decide.notice} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={decide.busy}
          className={primaryButton}
          onClick={() =>
            void decide.run(
              () => approveImplementationPlan({ projectId: plan.projectId, feedback }),
              onDone,
            )
          }
        >
          Approve and start implementation
        </button>
        <button
          type="button"
          disabled={decide.busy}
          className={dangerButton}
          onClick={() =>
            void decide.run(
              () => returnImplementationPlan({ projectId: plan.projectId, feedback }),
              onDone,
            )
          }
        >
          Send back for changes
        </button>
      </div>
    </section>
  )
}

/** What a plan with these values still needs before it can be submitted, in words. */
function missingFrom(plan: ImplementationPlan, stages: Stage[]): string[] {
  const missing: string[] = PLAN_SECTIONS.filter(
    (section) => section.required && !plan[section.key].trim(),
  ).map((section) => section.label.toLowerCase())
  if (stages.length === 0) missing.push('at least one stage')
  return missing
}

/**
 * The plan as the delivery manager will receive it, before it is submitted: the developer's
 * text as it stands - saved or not - laid out as a document. Submitting happens only from
 * here, and saves anything unsaved first, so what is approved is exactly what was previewed.
 */
function PlanPreview({
  project,
  plan,
  stages,
  unsaved,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  project: Project
  plan: ImplementationPlan
  stages: Stage[]
  unsaved: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  const missing = missingFrom(plan, stages)
  const facts: Array<[string, string]> = [
    ['Project', project.title],
    ['For', project.tenantName ?? project.ownerName],
    ['Developer', project.assignedName],
    ['Target date', project.targetDate ? formatDate(project.targetDate) : 'Not set'],
    ['Stages', String(stages.length)],
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/70 backdrop-blur-sm">
      <dialog
        open
        aria-modal="true"
        aria-labelledby="plan-preview-title"
        className="relative m-0 min-h-full w-full border-0 bg-transparent p-0 text-gray-900"
      >
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-gray-900">Plan preview</p>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                What the delivery manager will receive
              </span>
              {unsaved && (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                  Includes unsaved changes - saved when you submit
                </span>
              )}
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Back to editing
            </button>
          </div>
        </header>

        <div className="px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-4xl space-y-4">
            <section className="rounded-xl bg-white px-6 py-8 shadow-2xl ring-1 ring-gray-900/5 sm:px-10">
              <p className="text-xs font-bold tracking-[0.22em] text-brand-700 uppercase">
                Implementation plan
              </p>
              <h2
                id="plan-preview-title"
                className="mt-2 text-3xl font-bold tracking-tight text-gray-900"
              >
                {project.title}
              </h2>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-200 pt-5 sm:grid-cols-5">
                {facts.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium break-words text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <PlanDocument plan={plan} stages={stages} showMissing />
          </div>
        </div>

        <footer className="sticky bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 text-sm">
              {error ? (
                <p role="alert" className="font-medium text-red-700">
                  {error}
                </p>
              ) : missing.length ? (
                <p className="text-amber-800">Before submitting, add the {missing.join(', ')}.</p>
              ) : (
                <p className="text-gray-600">The plan is complete.</p>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" onClick={onClose} className={secondaryButton}>
                Back to editing
              </button>
              <button
                type="button"
                disabled={busy || missing.length > 0}
                onClick={onSubmit}
                className={primaryButton}
              >
                {busy ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          </div>
        </footer>
      </dialog>
    </div>
  )
}

/**
 * The implementation plan: the developer writes it from the agreed proposal and submits it;
 * the delivery manager approves it - which starts implementation - or sends it back.
 */
export function PlanTab({ project, onChanged }: { project: Project; onChanged: () => void }) {
  const plan = useLoad(() => implementationPlanRequest(project.id), `plan:${project.id}`)
  const stages = useLoad(() => projectStagesRequest(project.id), `stages:${project.id}`)
  const submit = useOutcome()
  // The form's text as it stands, saved or not: the preview shows it, and submitting saves it.
  const [draft, setDraft] = useState<Record<PlanField, string> | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const refresh = () => {
    plan.reload()
    stages.reload()
    onChanged()
  }

  if (plan.loading || stages.loading) return <Loading what="the implementation plan" />
  if (plan.failed || stages.failed || !plan.data) {
    return <LoadFailed what="the implementation plan" onRetry={refresh} />
  }
  const current = plan.data
  const stageList = stages.data ?? []
  const previewed: ImplementationPlan = draft ? { ...current, ...draft } : current
  const unsaved = Boolean(draft && PLAN_SECTIONS.some((s) => draft[s.key] !== current[s.key]))

  /** Save what is unsaved, then submit: the manager receives exactly what was previewed. */
  async function submitPlan() {
    if (unsaved && draft) {
      const saved = await submit.run(() =>
        updateImplementationPlan({ input: { projectId: project.id, ...draft } }),
      )
      if (!saved) return
    }
    await submit.run(
      () => submitImplementationPlan({ projectId: project.id }),
      () => {
        setPreviewing(false)
        refresh()
      },
    )
  }

  return (
    <div className="space-y-5">
      <header className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Implementation plan</h3>
            <p className="mt-0.5 text-sm text-gray-600">
              {current.submittedAt
                ? `Submitted by ${current.submittedByName} on ${formatDate(current.submittedAt)}`
                : 'How the developer will build what the proposal agreed.'}
              {current.decidedAt &&
                ` · ${current.status === 'approved' ? 'Approved' : 'Reviewed'} by ${current.decidedByName} on ${formatDate(current.decidedAt)}`}
            </p>
          </div>
          <Badge value={current.status} text={PLAN_STATUS_WORDS[current.status]} />
        </div>
        <PlanSteps status={current.status} />
        {current.reviewFeedback && (
          <div
            role="note"
            className={`rounded-lg px-4 py-3 text-sm ${
              current.status === 'changes_requested'
                ? 'bg-amber-50 text-amber-900'
                : 'bg-emerald-50 text-emerald-900'
            }`}
          >
            <p className="font-semibold">
              {current.status === 'changes_requested'
                ? 'The delivery manager asked for changes'
                : 'Note from the delivery manager'}
            </p>
            <p className="mt-1 whitespace-pre-line">{current.reviewFeedback}</p>
          </div>
        )}
      </header>

      {current.canEdit ? (
        <>
          <PlanForm
            key={current.updatedAt}
            plan={current}
            onSaved={refresh}
            onValuesChange={setDraft}
          />
          <StagesEditor project={project} stages={stageList} editable onChanged={refresh} />
          <section className={`${cardClass} flex flex-wrap items-center justify-between gap-3`}>
            <p className="text-sm text-gray-600">
              {missingFrom(previewed, stageList).length
                ? `Before submitting, add the ${missingFrom(previewed, stageList).join(', ')}.`
                : 'The plan is complete. Preview it as the delivery manager will see it, then submit.'}
            </p>
            <button type="button" className={primaryButton} onClick={() => setPreviewing(true)}>
              Preview and submit
            </button>
          </section>
          {previewing && (
            <PlanPreview
              project={project}
              plan={previewed}
              stages={stageList}
              unsaved={unsaved}
              busy={submit.busy}
              error={submit.notice?.kind === 'error' ? submit.notice.text : null}
              onClose={() => setPreviewing(false)}
              onSubmit={() => void submitPlan()}
            />
          )}
        </>
      ) : (
        <>
          <PlanDocument plan={current} stages={stageList} />
          {current.canDecide && <PlanDecision plan={current} onDone={refresh} />}
          {current.status === 'submitted' && !current.canDecide && (
            <p className="text-sm text-gray-600">
              The plan is with the delivery manager. You will be told when they decide.
            </p>
          )}
        </>
      )}
    </div>
  )
}
