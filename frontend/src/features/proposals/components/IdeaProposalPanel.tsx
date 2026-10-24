import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { CollapseButton } from '../../../components/CollapseButton'
import { useCollapsed } from '../../../components/useCollapsed'
import { useIdeaProposal } from './useIdeaProposal'
import {
  draftProposalSectionRequest,
  PAYMENT_WORDS,
  PLANNED_DATES,
  PROPOSAL_SECTIONS,
  sectionApplies,
  startProposalRequest,
  statusWords,
  submitProposalRequest,
  updateProposalRequest,
  type IdeaProposal,
  type ProposalOutcome,
  type DateKey,
  type ProposalState,
  type ProposalValues,
  type SectionKey,
} from '../api/proposalsApi'
import { plannedFacts } from './proposalFacts'
import { ProposalSections, ProposalText } from './ProposalSections'

const inputClass =
  'block h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-[15px] text-gray-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100'
const primary =
  'inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60'
const secondary =
  'inline-flex h-10 items-center rounded-lg border border-brand-300 bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60'

/** Everything the editor holds: the sections and the planned dates. */
type EditorKey = SectionKey | DateKey
const EDITOR_KEYS: EditorKey[] = [
  ...PROPOSAL_SECTIONS.map((section) => section.key),
  ...PLANNED_DATES.map((field) => field.key),
]

/**
 * An approved idea's proposal, on the idea's page.
 *
 * The review team that approved the idea sees it here and writes it: any member edits, the lead
 * sends it to the admin. The owner sees a pointer to read it once it is released - never the text
 * here, which only the view-only page shows. Everyone else sees nothing.
 */
/**
 * The proposal on an idea's page in one piece: the owner's card, or the writer's
 * editor. `IdeaDetailPage` places the two parts itself - the card beside the idea,
 * the editor under it - from one `useIdeaProposal`.
 */
export function IdeaProposalPanel({ ideaId, status }: { ideaId: string; status: string }) {
  const { state, failed, reload } = useIdeaProposal(ideaId)

  if (failed || state === null) return null
  if (state.viewerRole === 'owner') {
    return <ProposalOwnerCard ideaId={ideaId} status={status} state={state} />
  }
  return <ProposalWriterPanel ideaId={ideaId} state={state} onChanged={reload} />
}

/**
 * What the idea's owner sees of the proposal: that it is being prepared, or that it
 * is ready to read. Nothing for anybody else.
 */
export function ProposalOwnerCard({
  ideaId,
  status,
  state,
}: {
  ideaId: string
  status: string
  state: ProposalState | null
}) {
  if (state === null || state.viewerRole !== 'owner') return null
  if (state.proposal?.status !== 'released') {
    return status === 'APPROVED' ? (
      <Section title="Your proposal" badge="Being prepared" tone="amber">
        <p className="text-sm leading-6 text-sage">
          The platform is preparing a proposal for your idea. You will be told when it is ready to
          read; your go-ahead comes after you have read it.
        </p>
      </Section>
    ) : null
  }
  return (
    <Section title="Your proposal is ready" badge="Ready to read" tone="green">
      <p className="text-sm leading-6 text-sage">
        Read the proposed solution, timeline and expected effort carefully, then give your go-ahead.
      </p>
      <Link
        to={`/app/ideas/${ideaId}/proposal`}
        className="mt-4 flex h-10 w-full items-center justify-between rounded-xl bg-forest px-3.5 text-sm font-semibold text-white hover:bg-pine focus:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
      >
        Read the proposal <span aria-hidden="true">→</span>
      </Link>
    </Section>
  )
}

/** The proposal's editor, for a member of the team writing it. Nothing for anybody else. */
export function ProposalWriterPanel({
  ideaId,
  state,
  onChanged,
}: {
  ideaId: string
  state: ProposalState | null
  onChanged: () => void
}) {
  if (state === null || state.viewerRole !== 'writer') return null
  return <Writer ideaId={ideaId} state={state} onChanged={onChanged} />
}

const BADGE_TONES = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  green: 'bg-mist text-jade ring-jade/20',
}

function Section({
  title,
  badge,
  tone,
  children,
}: {
  title: string
  /** With a badge, the compact card beside the idea; without one, the writer's section. */
  badge?: string
  tone?: keyof typeof BADGE_TONES
  children: React.ReactNode
}) {
  if (!badge) {
    return (
      <section
        aria-label={title}
        className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <div className="mt-2">{children}</div>
      </section>
    )
  }
  return (
    <OwnerCard title={title} badge={badge} tone={tone ?? 'green'}>
      {children}
    </OwnerCard>
  )
}

/** The owner's compact proposal card beside the idea, which the reader can fold away. */
function OwnerCard({
  title,
  badge,
  tone,
  children,
}: {
  title: string
  badge: string
  tone: keyof typeof BADGE_TONES
  children: React.ReactNode
}) {
  const [open, toggle] = useCollapsed('idea-detail:proposal', true)
  return (
    <section
      aria-label={title}
      className="rounded-3xl border border-white bg-white/90 p-5 shadow-[0_16px_40px_-30px_rgba(8,75,56,0.5)] sm:px-6"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mist text-jade ring-1 ring-inset ring-jade/10"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
            <path d="M14 3v5h5M9 13h6M9 17h4" />
          </svg>
        </span>
        <p className="min-w-0 flex-1 text-base font-bold text-ink">Proposal</p>
        <CollapseButton
          open={open}
          onToggle={toggle}
          controls="proposal-card-body"
          label="the proposal"
        />
      </div>
      {open && (
        <div id="proposal-card-body">
          <div className="mt-3">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${BADGE_TONES[tone]}`}
            >
              {badge}
            </span>
          </div>
          <div className="mt-2">{children}</div>
        </div>
      )}
    </section>
  )
}

function Writer({
  ideaId,
  state,
  onChanged,
}: {
  ideaId: string
  state: ProposalState
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{
    ok: boolean
    text: string
    field: string | null
  } | null>(null)

  // The editor's text as it stands, saved or not: the preview shows it, and sending saves it.
  const [edits, setEdits] = useState<Record<EditorKey, string> | null>(null)
  const [previewing, setPreviewing] = useState(false)

  async function run(
    action: () => Promise<ProposalOutcome>,
    { closePreview = true } = {},
  ): Promise<boolean> {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      setMessage({ ok: result.success, text: result.message, field: result.field })
      if (result.success) {
        if (closePreview) setPreviewing(false)
        onChanged()
      }
      return result.success
    } catch {
      setMessage({
        ok: false,
        text: 'We could not reach the server. Please try again.',
        field: null,
      })
      return false
    } finally {
      setBusy(false)
    }
  }

  const proposal = state.proposal
  // The editor's "does the owner pay?" select only ever holds '', 'yes' or 'no'.
  const current =
    proposal && edits
      ? ({
          ...proposal,
          ...edits,
          plannedStart: edits.plannedStart || null,
          plannedEnd: edits.plannedEnd || null,
        } as IdeaProposal)
      : proposal
  const unsaved = Boolean(
    proposal && edits && EDITOR_KEYS.some((key) => edits[key] !== (proposal[key] ?? '')),
  )

  /** Save what is unsaved, then send: the admin receives exactly what was previewed. */
  async function send() {
    if (
      unsaved &&
      edits &&
      !(await run(() => updateProposalRequest(ideaId, edits), { closePreview: false }))
    ) {
      return
    }
    await run(() => submitProposalRequest({ ideaId }))
  }
  return (
    <Section title="Proposal">
      {message && (
        <p
          role={message.ok ? 'status' : 'alert'}
          className={`mb-3 rounded-lg px-4 py-3 text-sm ${
            message.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}
      {!proposal ? (
        state.canStart ? (
          <>
            <p className="text-sm text-gray-600">
              This idea is approved. Write the proposal for it: whether it is feasible, what would
              be built and what it needs, the timeline, what it costs and whether the owner pays,
              and how it will be judged done.
            </p>
            <button
              type="button"
              disabled={busy}
              className={`mt-3 ${primary}`}
              onClick={() => void run(() => startProposalRequest({ ideaId }))}
            >
              Start the proposal
            </button>
          </>
        ) : state.waitingForAdmin ? (
          <div role="note" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Approved - waiting for the platform admin</p>
            <p className="mt-1">
              The platform admin confirms the approval and tells the owner first. You can start the
              proposal as soon as they do, and you will be notified.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600">There is no proposal for this idea yet.</p>
        )
      ) : (
        <>
          <p className="mb-3 text-sm font-semibold text-gray-700">{statusWords(proposal.status)}</p>
          {proposal.reviewFeedback && proposal.status === 'changes_requested' && (
            <div role="note" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">The admin sent it back</p>
              <p className="mt-1 whitespace-pre-line">{proposal.reviewFeedback}</p>
            </div>
          )}
          {state.canEdit ? (
            <Editor
              ideaId={ideaId}
              proposal={proposal}
              busy={busy}
              fieldError={message && !message.ok ? message.field : null}
              onValuesChange={setEdits}
              onSave={(values) => run(() => updateProposalRequest(ideaId, values))}
            />
          ) : (
            <ProposalSections proposal={proposal} />
          )}
          {state.canEdit && (
            <button
              type="button"
              disabled={busy}
              className={`mt-4 ${state.canSubmit ? primary : secondary}`}
              onClick={() => {
                setMessage(null)
                setPreviewing(true)
              }}
            >
              {state.canSubmit ? 'Preview and send' : 'Preview the proposal'}
            </button>
          )}
          {state.canEdit && previewing && current && (
            <ProposalPreview
              proposal={current}
              unsaved={unsaved}
              canSend={state.canSubmit}
              busy={busy}
              error={message && !message.ok ? message.text : null}
              onClose={() => setPreviewing(false)}
              onSend={() => void send()}
            />
          )}
          {state.canEdit && !state.canSubmit && (
            <p className="mt-3 text-xs text-gray-500">
              Only the team’s lead sends the proposal to the admin.
            </p>
          )}
        </>
      )}
    </Section>
  )
}

/** The required sections still empty in `proposal`, as the server counts them. */
function missingSections(proposal: IdeaProposal): string[] {
  return PROPOSAL_SECTIONS.filter((section) => {
    const required = ('required' in section && section.required) || section.key === 'paymentPlan'
    return (
      required &&
      sectionApplies(section.key, proposal.paymentRequired) &&
      !proposal[section.key]?.trim()
    )
  }).map((section) => section.label)
}

function today(): string {
  return new Date().toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * The proposal as a finished document, before it is sent: the editor's current text - saved
 * or not - laid out the way the admin will read it. A required section still empty keeps its
 * place, marked. Any writer can open it; only the lead sends from it, and sending saves first,
 * so what the admin receives is exactly what was previewed.
 */
function ProposalPreview({
  proposal,
  unsaved,
  canSend,
  busy,
  error,
  onClose,
  onSend,
}: {
  proposal: IdeaProposal
  unsaved: boolean
  canSend: boolean
  busy: boolean
  error: string | null
  onClose: () => void
  onSend: () => void
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

  const required = PROPOSAL_SECTIONS.filter(
    (section) =>
      (('required' in section && section.required) || section.key === 'paymentPlan') &&
      sectionApplies(section.key, proposal.paymentRequired),
  )
  const missing = missingSections(proposal)
  const done = required.length - missing.length
  const facts = (
    [
      ['Idea', proposal.ideaTitle],
      ['Prepared by', proposal.teamName ?? 'The review team'],
      ['Date', today()],
      ['Status', canSend ? 'Ready for the platform admin' : 'Draft, being written'],
      ...plannedFacts(proposal),
    ] as Array<[string, string | null]>
  ).filter((fact): fact is [string, string] => Boolean(fact[1]))

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/70 backdrop-blur-sm">
      <dialog
        open
        aria-modal="true"
        aria-labelledby="proposal-preview-title"
        className="relative m-0 min-h-full w-full border-0 bg-transparent p-0 text-gray-900"
      >
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-gray-900">Proposal preview</p>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                What the platform admin will receive
              </span>
              {unsaved && (
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                  Includes unsaved changes{canSend ? ' - saved when you send' : ''}
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
          <article className="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-gray-900/5">
            <div className="h-2 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-400" />
            <div className="px-6 pt-10 pb-8 sm:px-14 sm:pt-14">
              <p className="text-xs font-bold tracking-[0.22em] text-brand-700 uppercase">
                Automation proposal
              </p>
              <h2
                id="proposal-preview-title"
                className="mt-3 text-3xl leading-tight font-bold tracking-tight text-gray-900 sm:text-4xl"
              >
                {proposal.title || 'Untitled proposal'}
              </h2>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-gray-200 py-5 sm:grid-cols-4">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                  <span>
                    {done} of {required.length} required sections written
                  </span>
                  <span className="tabular-nums">
                    {Math.round((done / Math.max(required.length, 1)) * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${missing.length ? 'bg-amber-400' : 'bg-brand-600'}`}
                    style={{ width: `${(done / Math.max(required.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="px-6 pb-12 sm:px-14 sm:pb-16">
              <ProposalSections proposal={proposal} showMissing />
            </div>
          </article>
        </div>

        <footer className="sticky bottom-0 border-t border-gray-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="min-w-0 text-sm">
              {error ? (
                <p role="alert" className="font-medium text-red-700">
                  {error}
                </p>
              ) : missing.length > 0 ? (
                <p className="text-amber-800">
                  {missing.length === 1
                    ? '1 required section is'
                    : `${missing.length} required sections are`}{' '}
                  still to write: {missing.join(', ')}.
                </p>
              ) : (
                <p className="text-gray-600">Every required section is written.</p>
              )}
            </div>
            <div className="flex shrink-0 gap-3">
              <button type="button" onClick={onClose} className={secondary}>
                Back to editing
              </button>
              {canSend && (
                <button
                  type="button"
                  disabled={busy || missing.length > 0}
                  onClick={onSend}
                  className={primary}
                >
                  {busy ? 'Sending…' : 'Send to the admin'}
                </button>
              )}
            </div>
          </div>
        </footer>
      </dialog>
    </div>
  )
}

/** Grows a text field to show everything written in it, so it never scrolls inside itself. */
function fitToContent(field: HTMLTextAreaElement | null) {
  if (!field) return
  field.style.height = 'auto'
  field.style.height = `${field.scrollHeight}px`
}

function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M10 1.5l1.6 4.4 4.4 1.6-4.4 1.6L10 13.5l-1.6-4.4L4 7.5l4.4-1.6L10 1.5zM15.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2zM4.5 13l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6z" />
    </svg>
  )
}

function PenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M13.6 2.6a2 2 0 0 1 2.8 0l1 1a2 2 0 0 1 0 2.8l-9.7 9.7-4.2 1.4 1.4-4.2 8.7-8.7zM12.5 5.5l2 2" />
    </svg>
  )
}

type InputMode = 'write' | 'ai'

/** Two independent ways to fill a section: write it yourself, or have the AI draft it. */
function ModeSwitch({
  label,
  mode,
  onChange,
}: {
  label: string
  mode: InputMode
  onChange: (mode: InputMode) => void
}) {
  const option = (value: InputMode, text: string, icon: React.ReactNode, active: string) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition ${
        mode === value ? active : 'text-gray-600 hover:bg-white hover:text-gray-900'
      }`}
    >
      {icon}
      {text}
    </button>
  )
  return (
    <fieldset className="mb-3 inline-flex gap-1 rounded-xl bg-gray-100 p-1">
      <legend className="sr-only">How to write {label}</legend>
      {option('write', 'Write', <PenIcon />, 'bg-white text-gray-900 shadow-sm')}
      {option('ai', 'Generate with AI', <SparkleIcon />, 'bg-violet-600 text-white shadow-sm')}
    </fieldset>
  )
}

/**
 * The AI side of a section: optional instructions, a Generate button, and the draft in a card
 * of its own. The writer's text is untouched until they choose to use the draft - to replace
 * what they wrote, or to add to it.
 */
function AiGenerator({
  ideaId,
  section,
  label,
  values,
  hasText,
  onUse,
}: {
  ideaId: string
  section: SectionKey
  label: string
  values: Record<EditorKey, string>
  hasText: boolean
  onUse: (text: string, how: 'replace' | 'append') => void
}) {
  const [instructions, setInstructions] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const instructionsId = `proposal-${section}-ai-instructions`

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const result = await draftProposalSectionRequest(ideaId, section, values, instructions)
      if (result.success && result.text !== null) setDraft(result.text)
      else setError(result.message)
    } catch {
      setError('We could not reach the server. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const words = draft ? countWords(draft) : 0
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 sm:p-5">
      <label htmlFor={instructionsId} className="block text-sm font-semibold text-gray-800">
        Instructions for the AI <span className="font-normal text-gray-500">(optional)</span>
      </label>
      <p className="mt-0.5 text-xs text-gray-500">
        The AI writes from the idea and the other sections. Say what it should focus on, the tone,
        or how long it should be.
      </p>
      <textarea
        id={instructionsId}
        rows={2}
        value={instructions}
        onChange={(event) => setInstructions(event.target.value)}
        className="mt-2 block w-full resize-y rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm focus:border-violet-500 focus:ring-4 focus:ring-violet-100 focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void generate()}
          disabled={busy}
          aria-label={`${draft ? 'Generate again' : 'Generate'} ${label} with AI`}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-white"
            />
          ) : (
            <SparkleIcon />
          )}
          {busy ? 'Generating…' : draft ? 'Generate again' : 'Generate'}
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>

      {draft !== null && (
        <section
          aria-label={`AI draft of ${label}`}
          className="mt-4 overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between gap-3 border-b border-violet-100 bg-violet-50 px-5 py-2.5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-violet-700 uppercase">
              <SparkleIcon />
              AI draft
            </p>
            <p className="text-xs text-gray-500">
              {words} {words === 1 ? 'word' : 'words'}
            </p>
          </div>
          <div className="px-5 py-4">
            <ProposalText text={draft} />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3">
            <button type="button" onClick={() => onUse(draft, 'replace')} className={primary}>
              {hasText ? 'Replace my text with this' : 'Use this text'}
            </button>
            {hasText && (
              <button type="button" onClick={() => onUse(draft, 'append')} className={secondary}>
                Add to my text
              </button>
            )}
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="ml-auto text-sm font-semibold text-gray-600 hover:text-gray-900"
            >
              Discard
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * One section's input with its two modes. The writer's own field and the AI generator are
 * separate: switching between them keeps both, and only "Use" or "Add" moves AI text across.
 * The text a draft replaced can be put back until the writer types again.
 */
function SectionInput({
  ideaId,
  section,
  values,
  onChange,
  children,
}: {
  ideaId: string
  section: { key: SectionKey; label: string }
  values: Record<EditorKey, string>
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  const [mode, setMode] = useState<InputMode>('write')
  const [replaced, setReplaced] = useState<string | null>(null)
  const text = values[section.key] ?? ''

  return (
    <>
      <ModeSwitch label={section.label} mode={mode} onChange={setMode} />
      {mode === 'write' ? (
        <>
          {children}
          {replaced !== null && (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-violet-700">
                AI text added. Read it and change it before saving.
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(replaced)
                  setReplaced(null)
                }}
                className="font-semibold text-gray-700 underline hover:text-gray-900"
              >
                Undo
              </button>
            </div>
          )}
        </>
      ) : (
        <AiGenerator
          ideaId={ideaId}
          section={section.key}
          label={section.label}
          values={values}
          hasText={text.trim() !== ''}
          onUse={(draft, how) => {
            setReplaced(text)
            onChange(how === 'append' && text.trim() ? `${text.trimEnd()}\n\n${draft}` : draft)
            setMode('write')
          }}
        />
      )}
    </>
  )
}

/**
 * A long section's writing surface: a document-like panel that grows with what is written
 * instead of a small box with a resize grip, and says how much has been written. It is still
 * a plain-text field - the proposal is stored as text, so new lines are kept and nothing else.
 */
function WritingSurface({
  id,
  value,
  describedBy,
  invalid,
  onChange,
}: {
  id: string
  value: string
  describedBy: string
  invalid: boolean
  onChange: (value: string) => void
}) {
  const words = countWords(value)

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100 ${
        invalid ? 'border-red-400' : 'border-gray-300'
      }`}
    >
      <textarea
        ref={fitToContent}
        id={id}
        rows={6}
        value={value}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          fitToContent(event.target)
          onChange(event.target.value)
        }}
        className="block min-h-48 w-full resize-none overflow-hidden border-0 bg-transparent px-5 py-4 text-[15px] leading-7 text-gray-900 focus:ring-0 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-5 py-2 text-xs text-gray-500">
        <span aria-live="polite">
          {words} {words === 1 ? 'word' : 'words'}
        </span>
      </div>
    </div>
  )
}

/**
 * The proposal form, as cards that fold: a long document is written a section at a time.
 * Sections already written start folded and empty ones open, so the writer lands on what
 * is left; "Expand all" and "Collapse all" do what they say. Everything is still one form,
 * saved together.
 */
function Editor({
  ideaId,
  proposal,
  busy,
  fieldError,
  onValuesChange,
  onSave,
}: {
  ideaId: string
  proposal: IdeaProposal
  busy: boolean
  fieldError: string | null
  onValuesChange: (values: Record<EditorKey, string>) => void
  onSave: (values: ProposalValues) => void
}) {
  const [values, setValues] = useState<Record<EditorKey, string>>(
    () =>
      Object.fromEntries(EDITOR_KEYS.map((key) => [key, proposal[key] ?? ''])) as Record<
        EditorKey,
        string
      >,
  )
  const datesOutOfOrder = Boolean(
    values.plannedStart && values.plannedEnd && values.plannedEnd < values.plannedStart,
  )
  const sections = PROPOSAL_SECTIONS.filter((section) =>
    sectionApplies(section.key, values.paymentRequired),
  )
  // The folded sections, rather than the open ones: a section that appears later (the
  // payment plan, once the owner pays) is then open, like every other empty one.
  const [folded, setFolded] = useState<Set<SectionKey>>(
    () => new Set(PROPOSAL_SECTIONS.filter((s) => proposal[s.key]?.trim()).map((s) => s.key)),
  )
  const written = sections.filter((section) => values[section.key]?.trim()).length
  const toggle = (key: SectionKey) =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // The writer's text as it stands, for the preview - which shows it saved or not.
  useEffect(() => onValuesChange(values), [values, onValuesChange])

  return (
    <form
      aria-label="Proposal"
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave(values)
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          <span className="font-semibold text-gray-800">
            {written} of {sections.length} sections written.
          </span>{' '}
          Sections marked <span className="font-semibold text-red-600">*</span> must be written
          before the lead can send it to the admin.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFolded(new Set())}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setFolded(new Set(PROPOSAL_SECTIONS.map((s) => s.key)))}
            className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            Collapse all
          </button>
        </div>
      </div>
      <fieldset className="rounded-2xl border border-gray-300 bg-white px-5 py-4 shadow-sm sm:px-6">
        <legend className="text-base font-semibold text-gray-900">Schedule</legend>
        <p className="mt-0.5 text-sm text-gray-500">
          When the work is planned to begin and end. These dates go on the proposal’s cover.
        </p>
        <div className="mt-3 grid gap-4 sm:max-w-xl sm:grid-cols-2">
          {PLANNED_DATES.map((field) => (
            <label key={field.key} className="block text-sm font-semibold text-gray-700">
              {field.label}
              <input
                type="date"
                value={values[field.key]}
                min={field.key === 'plannedEnd' ? values.plannedStart || undefined : undefined}
                aria-invalid={
                  (field.key === 'plannedEnd' && datesOutOfOrder) ||
                  fieldError === field.key ||
                  undefined
                }
                onChange={(event) => setValues((v) => ({ ...v, [field.key]: event.target.value }))}
                className={`${inputClass} mt-1`}
              />
            </label>
          ))}
        </div>
        {(datesOutOfOrder || fieldError === 'plannedEnd' || fieldError === 'plannedStart') && (
          <p className="mt-2 text-sm font-medium text-red-600">
            {datesOutOfOrder
              ? 'The planned end date cannot be before the start date.'
              : 'Check these dates.'}
          </p>
        )}
      </fieldset>
      {sections.map((section, index) => {
        const id = `proposal-${section.key}`
        const hintId = `${id}-hint`
        const required =
          ('required' in section && section.required) || section.key === 'paymentPlan'
        const set = (value: string) => setValues((v) => ({ ...v, [section.key]: value }))
        const invalid = fieldError === section.key
        const isOpen = !folded.has(section.key) || invalid
        const filled = Boolean(values[section.key]?.trim())
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
                {required && (
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
                  {required ? '*' : ''}
                </label>
                <p id={hintId} className="mb-3 text-sm text-gray-500">
                  {section.hint}
                </p>
                {'choice' in section && section.choice ? (
                  <select
                    id={id}
                    aria-describedby={hintId}
                    className={`${inputClass} sm:max-w-md`}
                    value={values[section.key]}
                    onChange={(event) => set(event.target.value)}
                  >
                    <option value="">Choose…</option>
                    <option value="yes">{PAYMENT_WORDS.yes}</option>
                    <option value="no">{PAYMENT_WORDS.no}</option>
                  </select>
                ) : (
                  <SectionInput ideaId={ideaId} section={section} values={values} onChange={set}>
                    {'short' in section && section.short ? (
                      <input
                        id={id}
                        aria-describedby={hintId}
                        aria-invalid={invalid || undefined}
                        className={inputClass}
                        value={values[section.key]}
                        onChange={(event) => set(event.target.value)}
                      />
                    ) : (
                      <WritingSurface
                        id={id}
                        value={values[section.key]}
                        describedBy={hintId}
                        invalid={invalid}
                        onChange={set}
                      />
                    )}
                  </SectionInput>
                )}
                {invalid && (
                  <p className="mt-2 text-sm font-medium text-red-600">Check this section.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
      <button type="submit" disabled={busy} className={secondary}>
        Save draft
      </button>
    </form>
  )
}
