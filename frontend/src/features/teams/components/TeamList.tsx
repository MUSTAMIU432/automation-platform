import { Link } from 'react-router-dom'

import { ArrowRightIcon, BulbIcon, ChatIcon, UsersIcon } from '../../../components/AppIcons'
import { collectionCardClasses } from '../../../components/glassStyles'
import { EmptyCollection } from '../../../components/WorkspaceCollection'
import type { Team } from '../api/teamsApi'
import { useTeams } from '../context/useTeams'

/**
 * The caller's teams, as a list of links into each one.
 *
 * Deliberately a list of links and not a switcher like the organization's: a
 * team is a *collaboration boundary*, not the tenant an idea belongs to, so
 * picking one does not change what the rest of the app is pointed at. It is a
 * place you go, not a mode you switch into — which is why it offers no "active"
 * state and no second picker in the header.
 *
 * The teams come from the page's `TeamsProvider`, so this list and the form
 * beside it share one request rather than making one each. `onCreate` is the
 * empty state's way to the create form beside it.
 */
export function TeamList({ onCreate }: { onCreate: () => void }) {
  const { teams, loading, error, reload } = useTeams()

  if (loading && teams.length === 0) {
    return (
      <output className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <span className="sr-only">Loading teams…</span>
        <span className="block h-4 w-32 animate-pulse rounded bg-gray-200" />
        <span className="mt-3 block h-3 w-48 animate-pulse rounded bg-gray-100" />
      </output>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5" role="alert">
        <p className="text-sm font-semibold text-red-800">Teams unavailable</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
        <button
          type="button"
          className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          onClick={reload}
        >
          Try again
        </button>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <EmptyCollection
        Icon={UsersIcon}
        title="You are not in a team yet"
        actionLabel="Create your first team"
        onAction={onCreate}
        benefits={[
          [UsersIcon, 'Write ideas together'],
          [ChatIcon, 'Talk in one place'],
          [BulbIcon, 'Put ideas forward as one'],
        ]}
      >
        A team is a group of people who put an idea forward together. Create one, and you will be
        its first member.
      </EmptyCollection>
    )
  }

  return (
    <div className={collectionCardClasses}>
      <p className="text-lg font-bold text-gray-900">Teams you are in</p>
      <ul className="mt-4 space-y-3" aria-label="Your teams">
        {teams.map((team) => (
          <TeamRow key={team.id} team={team} />
        ))}
      </ul>
    </div>
  )
}

function TeamRow({ team }: { team: Team }) {
  return (
    <li>
      <Link
        to={`/app/teams/${team.id}`}
        className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          <UsersIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-gray-900">{team.name}</span>
              <span className="mt-0.5 block text-sm text-gray-500">/{team.slug}</span>
            </span>
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800">
              {team.memberCount === 1 ? '1 member' : `${team.memberCount} members`}
            </span>
          </span>
          {team.description ? (
            <span className="mt-2 block text-sm leading-6 text-gray-600">{team.description}</span>
          ) : null}
        </span>
        <ArrowRightIcon className="h-4 w-4 shrink-0 text-brand-600" />
      </Link>
    </li>
  )
}
