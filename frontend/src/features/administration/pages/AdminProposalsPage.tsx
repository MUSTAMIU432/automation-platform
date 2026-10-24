import { useState } from 'react'

import { ProposalAnswerCard } from '../../proposals/components/ProposalAnswerSummary'
import { ProposalFacts } from '../../proposals/components/ProposalFacts'
import { plannedFacts, type Fact } from '../../proposals/components/proposalFacts'
import { ProposalSections } from '../../proposals/components/ProposalSections'
import {
  declineProposalRequest,
  downloadProposalPdfRequest,
  proposalProgressRequest,
  releaseProposalRequest,
  requestProposalChangesRequest,
  sectionLabel,
  statusWords,
  type IdeaProposal,
  type ProposalOutcome,
  type ProposalParticipant,
  type ProposalProgress,
} from '../../proposals/api/proposalsApi'
import {
  AdminCard,
  AdminPageHeader,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  controlClasses,
  dangerButtonClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { formatDateTime, formatDay } from '../utils/format'

function Decision({ proposal, onDone }: { proposal: IdeaProposal; onDone: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  async function run(action: () => Promise<ProposalOutcome>) {
    setBusy(true)
    setNotice(null)
    try {
      const result = await action()
      setNotice({ tone: result.success ? 'success' : 'error', text: result.message })
      if (result.success) onDone()
    } catch {
      setNotice({ tone: 'error', text: 'We could not reach the server. Please try again.' })
    } finally {
      setBusy(false)
    }
  }
  const id = proposal.ideaId

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <label className="block text-sm font-semibold text-slate-700">
        Reason or feedback
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          className={`${controlClasses} mt-1 block w-full`}
          placeholder="Needed to send it back or to decline it"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className={primaryButtonClasses}
          onClick={() => void run(() => releaseProposalRequest({ ideaId: id }))}
        >
          Release to the owner
        </button>
        <button
          type="button"
          disabled={busy}
          className={secondaryButtonClasses}
          onClick={() =>
            void run(() => requestProposalChangesRequest({ ideaId: id, feedback: text }))
          }
        >
          Send back to the team
        </button>
        <button
          type="button"
          disabled={busy}
          className={dangerButtonClasses}
          onClick={() => void run(() => declineProposalRequest({ ideaId: id, reason: text }))}
        >
          Decline
        </button>
      </div>
    </div>
  )
}

/** The proposal as a PDF carrying this admin's name and the time; each download is audited. */
function DownloadPdf({ ideaId, title }: { ideaId: string; title: string }) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  async function download() {
    setBusy(true)
    setFailed(false)
    try {
      await downloadProposalPdfRequest(ideaId)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-label={`Download the proposal “${title}” as a PDF`}
        className={secondaryButtonClasses}
        onClick={() => void download()}
      >
        {busy ? 'Preparing…' : 'Download PDF'}
      </button>
      {failed && (
        <span role="alert" className="basis-full text-right text-xs text-red-600">
          We could not download the PDF. Please try again.
        </span>
      )}
    </>
  )
}

const TONE = {
  not_started: 'neutral',
  draft: 'info',
  changes_requested: 'warn',
  submitted: 'admin',
  released: 'good',
  declined: 'bad',
} as const

const FILTERS = [
  {
    key: 'preparing',
    label: 'Being prepared',
    statuses: ['not_started', 'draft', 'changes_requested'],
  },
  { key: 'waiting', label: 'Waiting for you', statuses: ['submitted'] },
  { key: 'decided', label: 'Decided', statuses: ['released', 'declined'] },
  { key: 'all', label: 'All', statuses: null },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

function inFilter(row: ProposalProgress, key: FilterKey): boolean {
  const statuses = FILTERS.find((filter) => filter.key === key)?.statuses
  return statuses == null || (statuses as readonly string[]).includes(row.status)
}

function list(keys: string[]): string {
  return keys.map(sectionLabel).join(', ')
}

/** A long run of section names, shortened: the first three, then how many more. */
function brief(keys: string[], shown = 3): string {
  if (keys.length <= shown) return list(keys)
  return `${list(keys.slice(0, shown))} and ${keys.length - shown} more`
}

function Progress({ row }: { row: ProposalProgress }) {
  const filled = row.filledSections.length
  const percent = Math.round((filled / Math.max(row.totalSections, 1)) * 100)
  const complete = row.missingRequired.length === 0
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">
          {filled} of {row.totalSections} sections written
        </span>
        <span className="text-slate-500 tabular-nums">{percent}%</span>
      </div>
      <progress
        aria-label={`Progress of the proposal for ${row.ideaTitle}`}
        max={row.totalSections}
        value={filled}
        className="mt-1.5 block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-slate-200 [&::-moz-progress-bar]:bg-brand-500 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-brand-500"
      />
      <p className={`mt-1.5 text-xs ${complete ? 'text-emerald-700' : 'text-amber-800'}`}>
        {complete
          ? 'Every required section is written.'
          : `Still needed before it can be sent: ${list(row.missingRequired)}.`}
      </p>
    </div>
  )
}

const ROLE_WORDS = { lead: 'Lead', member: 'Member', former: 'Former member' } as const

function contributionWords(person: ProposalParticipant): string {
  if (person.contributions === 0) return 'Has not contributed yet'
  const count = `${person.contributions} ${person.contributions === 1 ? 'contribution' : 'contributions'}`
  const sections = person.sections.length ? ` · ${brief(person.sections)}` : ''
  return `${count}${sections} · last ${formatDateTime(person.lastContributedAt)}`
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '?') + (words.length > 1 ? words.at(-1)![0] : '')).toUpperCase()
}

function Participants({ people }: { people: ProposalParticipant[] }) {
  if (people.length === 0) {
    return <p className="mt-4 text-xs text-slate-500">No review team is assigned to write it.</p>
  }
  return (
    <div className="mt-4">
      <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
        Participants
      </p>
      <ul aria-label="Participants" className="mt-1.5 space-y-1.5">
        {people.map((person) => (
          <li key={person.email} className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white"
            >
              {initials(person.name)}
            </span>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-slate-900">{person.name}</span>
              <Badge tone={person.role === 'lead' ? 'admin' : 'neutral'}>
                {ROLE_WORDS[person.role]}
              </Badge>
              <span
                className="truncate text-xs text-slate-500"
                title={person.sections.length > 3 ? list(person.sections) : undefined}
              >
                {contributionWords(person)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** "Oct 16, 2026 · Lena Lead": when something happened, and by whom when that is known. */
function when(date: string, by: string | undefined): string {
  return by ? `${date} · ${by}` : date
}

/** The cover block of one proposal: who is writing it, and when. */
function coverFacts(row: ProposalProgress): Fact[] {
  const proposal = row.proposal
  const lead = row.participants.find((person) => person.role === 'lead')
  const activity = row.activity
  const people = row.participants.filter((person) => person.role !== 'former')
  return [
    ['Review team', row.teamName ?? 'Not assigned'],
    ['Lead', lead?.name ?? null],
    [
      'Participants',
      people.length ? (
        <span key="participants" className="flex items-center gap-2">
          <span className="flex -space-x-1.5" aria-hidden="true">
            {people.slice(0, 4).map((person) => (
              <span
                key={person.email}
                title={person.name}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white ring-2 ring-white"
              >
                {initials(person.name)}
              </span>
            ))}
          </span>
          {people.length} {people.length === 1 ? 'person' : 'people'}
        </span>
      ) : null,
    ],
    // Activity is newest first: who started it, who last sent it, and who touched it last.
    [
      'Started',
      proposal
        ? when(formatDay(proposal.startedAt), activity.find((a) => a.action === 'started')?.name)
        : null, // the status badge already says it has not started
    ],
    [
      'Sent to the admin',
      proposal?.submittedAt
        ? when(
            formatDay(proposal.submittedAt),
            activity.find((a) => a.action === 'submitted')?.name,
          )
        : null,
    ],
    ['Last updated', proposal ? when(formatDateTime(proposal.updatedAt), activity[0]?.name) : null],
    ...(proposal ? plannedFacts(proposal) : []),
  ]
}

function Row({
  row,
  canDecide,
  canDownload,
  onChanged,
}: {
  row: ProposalProgress
  canDecide: boolean
  canDownload: boolean
  onChanged: () => void
}) {
  const [open, setOpen] = useState(false)
  const proposal = row.proposal
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        aria-hidden="true"
        className="h-1 bg-gradient-to-r from-brand-800 via-brand-600 to-brand-400"
      />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.2em] text-brand-700 uppercase">
              Proposal · Nº {row.ideaId.padStart(4, '0')}
            </p>
            <p className="mt-1 text-lg leading-snug font-semibold text-slate-900">
              {proposal?.title ?? row.ideaTitle}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">For “{row.ideaTitle}”</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge tone={TONE[row.status as keyof typeof TONE] ?? 'neutral'}>
              {statusWords(row.status)}
            </Badge>
            {proposal && (
              <button
                type="button"
                className={secondaryButtonClasses}
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? 'Hide' : 'Read'}
              </button>
            )}
            {proposal && canDownload && <DownloadPdf ideaId={row.ideaId} title={proposal.title} />}
          </div>
        </div>
        <div className="mt-4">
          <ProposalFacts
            label={`About the proposal for ${row.ideaTitle}`}
            facts={coverFacts(row)}
          />
        </div>
        <Progress row={row} />
        <Participants people={row.participants} />
        {row.status === 'released' && (
          // Once released, what the owner answered: go ahead (on which terms) or not.
          <ProposalAnswerCard ideaId={row.ideaId} title="The owner's answers" />
        )}
        {open && proposal && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {proposal.reviewFeedback && (
              <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm whitespace-pre-line text-amber-900">
                {proposal.reviewFeedback}
              </p>
            )}
            <ProposalSections proposal={proposal} />
            {canDecide && proposal.status === 'submitted' && (
              <Decision proposal={proposal} onDone={onChanged} />
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * Every approved idea's proposal, as far as it has got: not started, being written by its review
 * team, waiting for a decision, or decided - with who is on the team and what each of them has
 * written. Read any of them at any point; release, send back or decline once the lead sends one.
 * The people who wrote a proposal never decide it; the server refuses them even if they hold the
 * permission.
 */
export function AdminProposalsPage() {
  const { capabilities } = useAdminCapabilities()
  const [filter, setFilter] = useState<FilterKey>('all')
  const { data, loading, error, reload } = useAdminQuery(
    'admin-proposal-progress',
    proposalProgressRequest,
    'We could not load the proposals.',
  )
  const shown = data?.filter((row) => inFilter(row, filter)) ?? []
  return (
    <>
      <AdminPageHeader
        title="Proposals"
        description="Follow each approved idea’s proposal as its review team writes it, and see who is taking part. Release one and its owner can read it and give the go-ahead."
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState label="Loading proposals…" />}
      {data && data.length === 0 && (
        <EmptyState
          title="No approved ideas yet."
          description="An idea appears here once a review team approves it, and its proposal’s progress shows as the team writes it."
        />
      )}
      {data && data.length > 0 && (
        <AdminCard title="Proposals">
          <fieldset className="mb-4 flex flex-wrap gap-2">
            <legend className="sr-only">Show</legend>
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={filter === option.key}
                onClick={() => setFilter(option.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  filter === option.key
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {option.label} ({data.filter((row) => inFilter(row, option.key)).length})
              </button>
            ))}
          </fieldset>
          {shown.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing here right now.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((row) => (
                <Row
                  key={row.ideaId}
                  row={row}
                  canDecide={capabilities.canReleaseProposals}
                  canDownload={capabilities.canReleaseProposals}
                  onChanged={reload}
                />
              ))}
            </ul>
          )}
        </AdminCard>
      )}
    </>
  )
}
