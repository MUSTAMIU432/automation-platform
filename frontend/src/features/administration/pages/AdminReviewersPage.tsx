import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

import { Avatar } from '../../identity/components/Avatar'

import {
  createReviewTeamRequest,
  grantReviewerRequest,
  reviewersRequest,
  reviewTeamsRequest,
  revokeReviewerRequest,
  updateReviewTeamRequest,
  type Outcome,
  type ReviewTeam,
  type Reviewer,
} from '../api/reviewersApi'
import {
  AdminCard,
  AdminPageHeader,
  AdminTable,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  cellClasses,
  controlClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
} from '../components/AdminUi'
import { useAdminCapabilities } from '../context/useAdminCapabilities'
import { useAdminQuery } from '../hooks/useAdminQuery'

/** Runs one action and keeps the server's own words for the result. */
function useAction() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  async function run(action: () => Promise<Outcome>, onDone: () => void) {
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
  return { busy, notice, run }
}

/**
 * Strong colours a team mark can take, each carrying white text. A team keeps its
 * colour wherever it is drawn because the pick is a hash of its id, not its position.
 */
const TEAM_COLOURS = [
  'bg-brand-600',
  'bg-sky-700',
  'bg-violet-700',
  'bg-amber-700',
  'bg-rose-700',
  'bg-teal-700',
  'bg-indigo-700',
  'bg-fuchsia-700',
]

function teamColour(team: ReviewTeam): string {
  let hash = 0
  for (const char of team.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return team.isActive ? TEAM_COLOURS[hash % TEAM_COLOURS.length] : 'bg-slate-400'
}

/** Up to two initials from the team's name: "Platform Review A" is "PR", "Team1" is "T1". */
function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  const word = words[0] ?? '?'
  const digits = word.match(/\d+$/)?.[0]
  return (digits ? `${word[0]}${digits[0]}` : word.slice(0, 2)).toUpperCase()
}

/** The team's mark: its initials on its own colour. Teams have no uploaded logo. */
function TeamMark({ team, size }: { team: ReviewTeam; size: 'sm' | 'lg' }) {
  const box = size === 'lg' ? 'h-14 w-14 rounded-xl text-lg' : 'h-5 w-5 rounded text-[10px]'
  return (
    <span
      aria-hidden="true"
      className={`${box} ${teamColour(team)} inline-flex shrink-0 items-center justify-center font-bold text-white shadow-sm`}
    >
      {teamInitials(team.name)}
    </span>
  )
}

const avatarClasses =
  'flex shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white shadow-sm ring-2 ring-white'

/** The teams a reviewer sits on, lead first, as small chips; retired teams are marked. */
function ReviewerTeams({ reviewerId, teams }: { reviewerId: string; teams: ReviewTeam[] | null }) {
  if (teams === null) return <span className="text-slate-400">…</span>
  const seats = teams
    .flatMap((team) =>
      team.members
        .filter((member) => member.id === reviewerId)
        .map((member) => ({ team, isLead: member.isLead })),
    )
    .sort((a, b) => Number(b.isLead) - Number(a.isLead))
  if (seats.length === 0) return <span className="text-slate-400">Not on a team</span>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {seats.map(({ team, isLead }) => (
        <li
          key={team.id}
          className={`inline-flex items-center gap-1.5 rounded-md border py-0.5 pr-2 pl-0.5 text-xs ${
            team.isActive
              ? 'border-slate-200 bg-slate-50 text-slate-700'
              : 'border-slate-200 bg-white text-slate-400 line-through'
          }`}
        >
          <TeamMark team={team} size="sm" />
          {team.name}
          {isLead && <Badge tone="good">Lead</Badge>}
        </li>
      ))}
    </ul>
  )
}

function ReviewerList({
  reviewers,
  teams,
  canManage,
  onChanged,
}: {
  reviewers: Reviewer[]
  teams: ReviewTeam[] | null
  canManage: boolean
  onChanged: () => void
}) {
  const grant = useAction()
  const revoke = useAction()
  const [email, setEmail] = useState('')

  return (
    <AdminCard
      title="Reviewers"
      actions={
        <span className="text-sm font-semibold text-white">
          {reviewers.length} {reviewers.length === 1 ? 'reviewer' : 'reviewers'}
        </span>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        People who can review submissions for the platform. They are made from existing accounts.
      </p>
      {canManage && (
        <form
          aria-label="Make a reviewer"
          className="mb-4 flex flex-wrap items-end gap-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void grant.run(
              () => grantReviewerRequest(email),
              () => {
                setEmail('')
                onChanged()
              },
            )
          }}
        >
          <label className="text-sm font-semibold text-slate-700">
            Account email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${controlClasses} mt-1 block w-72`}
              placeholder="person@example.com"
            />
          </label>
          <button
            type="submit"
            disabled={grant.busy || email.trim() === ''}
            className={primaryButtonClasses}
          >
            Make reviewer
          </button>
        </form>
      )}
      {grant.notice && <Notice tone={grant.notice.tone}>{grant.notice.text}</Notice>}
      {revoke.notice && <Notice tone={revoke.notice.tone}>{revoke.notice.text}</Notice>}
      {reviewers.length === 0 ? (
        <EmptyState title="No reviewers yet." description="Make an account a reviewer to begin." />
      ) : (
        <AdminTable
          label="Reviewers"
          columns={['Reviewer', 'Email', 'Review teams', ...(canManage ? [''] : [])]}
        >
          {reviewers.map((reviewer) => (
            <tr key={reviewer.id} className="hover:bg-slate-50">
              <td className={`${cellClasses} whitespace-nowrap`}>
                <Link
                  to={`/app/admin/users/${reviewer.id}`}
                  className="flex items-center gap-3 font-semibold text-slate-900 hover:underline"
                >
                  <span aria-hidden="true">
                    <Avatar user={reviewer} className={`${avatarClasses} h-12 w-12 text-sm`} />
                  </span>
                  {reviewer.name}
                </Link>
              </td>
              <td className={cellClasses}>
                <a
                  href={`mailto:${reviewer.email}`}
                  className="break-all text-slate-600 hover:text-slate-900 hover:underline"
                >
                  {reviewer.email}
                </a>
              </td>
              <td className={cellClasses}>
                <ReviewerTeams reviewerId={reviewer.id} teams={teams} />
              </td>
              {canManage && (
                <td className={`${cellClasses} text-right whitespace-nowrap`}>
                  <button
                    type="button"
                    disabled={revoke.busy}
                    aria-label={`Remove ${reviewer.name} as reviewer`}
                    className={secondaryButtonClasses}
                    onClick={() =>
                      void revoke.run(() => revokeReviewerRequest(reviewer.id), onChanged)
                    }
                  >
                    Remove as reviewer
                  </button>
                </td>
              )}
            </tr>
          ))}
        </AdminTable>
      )}
    </AdminCard>
  )
}

function NewTeamForm({ reviewers, onCreated }: { reviewers: Reviewer[]; onCreated: () => void }) {
  const create = useAction()
  const [name, setName] = useState('')
  const [leadId, setLeadId] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const toggle = (id: string) =>
    setMemberIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  return (
    <form
      aria-label="Form a review team"
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        void create.run(
          () => createReviewTeamRequest(name, leadId, memberIds),
          () => {
            setName('')
            setLeadId('')
            setMemberIds([])
            onCreated()
          },
        )
      }}
    >
      {create.notice && <Notice tone={create.notice.tone}>{create.notice.text}</Notice>}
      <label className="block text-sm font-semibold text-slate-700">
        Team name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={`${controlClasses} mt-1 block w-72`}
        />
      </label>
      <label className="block text-sm font-semibold text-slate-700">
        Lead
        <select
          value={leadId}
          onChange={(event) => setLeadId(event.target.value)}
          className={`${controlClasses} mt-1 block w-72`}
        >
          <option value="">Choose the lead…</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.id}>
              {reviewer.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="text-sm font-semibold text-slate-700">Members</legend>
        <div className="mt-1 space-y-1">
          {reviewers.map((reviewer) => (
            <label key={reviewer.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={memberIds.includes(reviewer.id)}
                onChange={() => toggle(reviewer.id)}
              />
              {reviewer.name}
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="submit"
        disabled={create.busy || name.trim() === '' || leadId === ''}
        className={primaryButtonClasses}
      >
        Create team
      </button>
    </form>
  )
}

function TeamRow({
  team,
  canManage,
  onChanged,
}: {
  team: ReviewTeam
  canManage: boolean
  onChanged: () => void
}) {
  const change = useAction()
  const lead = team.members.find((m) => m.isLead)
  const members = [...team.members].sort((a, b) => Number(b.isLead) - Number(a.isLead))
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamMark team={team} size="lg" />
          <div>
            <p className="text-base font-semibold text-slate-900">{team.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {lead ? `Led by ${lead.name}` : 'No lead'} · {team.members.length}{' '}
              {team.members.length === 1 ? 'member' : 'members'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={team.isActive ? 'good' : 'neutral'}>
            {team.isActive ? 'Active' : 'Retired'}
          </Badge>
          {canManage && (
            <button
              type="button"
              disabled={change.busy}
              className={secondaryButtonClasses}
              onClick={() =>
                void change.run(
                  () => updateReviewTeamRequest(team.id, { isActive: !team.isActive }),
                  onChanged,
                )
              }
            >
              {team.isActive ? 'Retire' : 'Restore'}
            </button>
          )}
        </div>
      </div>
      <ul aria-label={`${team.name} members`} className="mt-4 flex flex-wrap gap-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 py-1 pr-3 pl-1"
          >
            <span aria-hidden="true">
              <Avatar user={member} className={`${avatarClasses} h-10 w-10 text-xs`} />
            </span>
            <span className="text-sm font-medium text-slate-800">{member.name}</span>
            {member.isLead && <Badge tone="good">Lead</Badge>}
          </li>
        ))}
      </ul>
      {change.notice && <Notice tone={change.notice.tone}>{change.notice.text}</Notice>}
    </li>
  )
}

/**
 * Who reviews for the platform, and the teams they work in.
 *
 * A team has one lead and any number of members. Every member can send an idea back to
 * its owner; only the lead approves or rejects. The forms are offered to someone who can
 * manage reviewers; the server decides regardless.
 */
export function AdminReviewersPage() {
  const { capabilities } = useAdminCapabilities()
  const canManage = capabilities.canManageReviewers
  const reviewers = useAdminQuery(
    'admin-reviewers',
    reviewersRequest,
    'We could not load the reviewers.',
  )
  const teams = useAdminQuery(
    'admin-review-teams',
    reviewTeamsRequest,
    'We could not load the teams.',
  )
  const reload = () => {
    reviewers.reload()
    teams.reload()
  }

  return (
    <>
      <AdminPageHeader
        title="Reviewers"
        description="Create platform reviewers and form them into review teams. A team has one lead; every member can send an idea back for changes, and only the lead approves."
      />
      {reviewers.error && <ErrorState message={reviewers.error} onRetry={reviewers.reload} />}
      {reviewers.loading && !reviewers.data && <LoadingState label="Loading reviewers…" />}
      {reviewers.data && (
        <div className="space-y-6">
          <ReviewerList
            reviewers={reviewers.data}
            teams={teams.data ?? null}
            canManage={canManage}
            onChanged={reload}
          />

          <AdminCard title="Review teams">
            {teams.error && <ErrorState message={teams.error} onRetry={teams.reload} />}
            {teams.data && teams.data.length === 0 && (
              <EmptyState title="No review teams yet." description="Form one below." />
            )}
            {teams.data && teams.data.length > 0 && (
              <ul aria-label="Review teams" className="mb-5 space-y-3">
                {teams.data.map((team) => (
                  <TeamRow key={team.id} team={team} canManage={canManage} onChanged={reload} />
                ))}
              </ul>
            )}
            {canManage && <NewTeamForm reviewers={reviewers.data} onCreated={reload} />}
          </AdminCard>
        </div>
      )}
    </>
  )
}
