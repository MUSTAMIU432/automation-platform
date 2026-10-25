import { Link } from 'react-router-dom'

import { useAuth } from '../../identity/auth/AuthContext'
import { Avatar } from '../../identity/components/Avatar'
import {
  adminOverviewRequest,
  adminUsersRequest,
  type AdminStatusCount,
  type AdminUser,
} from '../api/administrationApi'
import {
  AdminPageHeader,
  EmptyState,
  ErrorState,
  IdeaStatusBadge,
  LoadingState,
  MetricCard,
  glassSurface,
} from '../components/AdminUi'
import {
  ApprovedIcon,
  ChangesIcon,
  IdeaIcon,
  InboxIcon,
  OrganizationIcon,
  RejectedIcon,
  ReviewIcon,
  UsersIcon,
} from '../components/AdminIcons'
import { useAdminQuery } from '../hooks/useAdminQuery'

/** "Good morning" before noon, "Good afternoon" until six, "Good evening" after. */
function greeting(hour = new Date().getHours()): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/**
 * Who is signed in to the console, at the top of its first page: the account
 * every action on these pages is taken as, and audited under. Read from the
 * session, so it is the account the server knows - not a name typed anywhere.
 */
function SignedInAccount() {
  const { user } = useAuth()
  if (!user) return null
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email

  return (
    <section
      aria-label="Signed in as"
      className={`relative isolate mb-6 overflow-hidden rounded-3xl p-6 sm:p-7 ${glassSurface}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-16 -left-10 h-48 w-48 rounded-full bg-brand-200/60 blur-3xl" />
        <div className="absolute -right-10 -bottom-20 h-56 w-56 rounded-full bg-teal-200/50 blur-3xl" />
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <Avatar
          user={user}
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-500 to-teal-500 text-xl font-bold text-white shadow-[0_12px_26px_-12px_rgba(20,99,73,0.8)] ring-4 ring-white/80"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-slate-500">{greeting()},</p>
          <p className="truncate text-2xl font-bold tracking-tight text-slate-900">{name}</p>
          <p className="truncate text-sm text-slate-600">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            Platform administrator
          </span>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
              user.isVerified
                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                : 'bg-amber-50 text-amber-700 ring-amber-200'
            }`}
          >
            {user.isVerified ? 'Email verified' : 'Email not verified'}
          </span>
        </div>
      </div>
    </section>
  )
}

/**
 * Every lifecycle status as a glass tile: its badge, how many ideas are in it,
 * and that count's share of all ideas as a thin bar - so where the work is piling
 * up shows without reading a single number. Each tile opens the idea list
 * filtered to its status.
 */
function IdeasByStatus({ counts, total }: { counts: AdminStatusCount[]; total: number }) {
  return (
    <section
      aria-labelledby="ideas-by-status-heading"
      className={`rounded-3xl p-5 sm:p-6 ${glassSurface}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="ideas-by-status-heading" className="text-lg font-bold text-slate-900">
          Ideas by status
        </h2>
        <p className="text-sm text-slate-500">
          {total === 1 ? '1 idea in total' : `${total} ideas in total`}
        </p>
      </div>
      <ul
        aria-label="Ideas by status"
        className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {counts.map((item) => {
          const share = total > 0 ? Math.round((item.count / total) * 100) : 0
          return (
            <li key={item.status}>
              <Link
                to={`/app/admin/ideas?status=${item.status}`}
                className={`flex h-full flex-col rounded-2xl border border-white/80 p-4 ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_16px_32px_-24px_rgba(8,75,56,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0 ${
                  item.count > 0 ? 'bg-white/75' : 'bg-white/45'
                }`}
              >
                <span className="flex items-start justify-between gap-3">
                  <IdeaStatusBadge status={item.status} />
                  <span
                    className={`text-2xl leading-none font-bold tabular-nums ${
                      item.count > 0 ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="mt-4 block h-1.5 overflow-hidden rounded-full bg-slate-900/[0.06]"
                >
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-brand-500 to-teal-400"
                    style={{ width: `${share}%` }}
                  />
                </span>
                <span className="mt-2 text-xs text-slate-500">{share}% of ideas</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** How many of the newest accounts the overview shows; the Users page has the rest. */
const RECENT_USER_LIMIT = 6

/** "Today", "Yesterday", "3 days ago", then the date. */
function joinedWhen(iso: string, now = new Date()): string {
  const day = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** The way in, as a chip: Google, or email and password. */
function SignInChips({ methods }: { methods: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {methods.includes('google') && (
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
          Google
        </span>
      )}
      {methods.includes('password') && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          Email
        </span>
      )}
    </span>
  )
}

/**
 * The newest accounts on the platform, so an administrator sees who has just
 * joined - and how they sign in - without leaving the overview. The server's own
 * list (newest first), cut to a handful; each row opens the account.
 */
function RecentUsers({ total }: { total: number }) {
  const { data, loading, error, reload } = useAdminQuery(
    'recent-users',
    () => adminUsersRequest({}, { limit: RECENT_USER_LIMIT }),
    'We could not load the newest accounts.',
  )
  const users: AdminUser[] = data?.items ?? []

  return (
    <section
      aria-labelledby="recent-users-heading"
      className={`rounded-3xl p-5 sm:p-6 ${glassSurface}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="recent-users-heading" className="text-lg font-bold text-slate-900">
            Recent users
          </h2>
          <p className="text-sm text-slate-500">
            {total === 1 ? '1 account on the platform' : `${total} accounts on the platform`}
          </p>
        </div>
        <Link
          to="/app/admin/users"
          className="text-sm font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
        >
          View all users →
        </Link>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={reload} />
        </div>
      ) : loading && !data ? (
        <p className="mt-4 text-sm text-slate-500">Loading the newest accounts…</p>
      ) : users.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No accounts yet.</p>
      ) : (
        <ul aria-label="Recent users" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((user) => {
            const name = `${user.firstName} ${user.lastName}`.trim() || user.email
            return (
              <li key={user.id}>
                <Link
                  to={`/app/admin/users/${user.id}`}
                  className="flex h-full items-center gap-3 rounded-2xl border border-white/80 bg-white/75 p-3 ring-1 ring-slate-900/5 transition hover:-translate-y-0.5 hover:bg-white/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 motion-reduce:hover:translate-y-0"
                >
                  <Avatar
                    user={user}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-brand-500 to-teal-500 text-sm font-bold text-white ring-2 ring-white"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{name}</span>
                      {user.isPlatformAdmin && (
                        <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          Admin
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-600">{user.email}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2">
                      <SignInChips methods={user.signInMethods} />
                      <span className="text-[11px] text-slate-500">
                        Joined {joinedWhen(user.createdAt)}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function countOf(counts: AdminStatusCount[], status: AdminStatusCount['status']): number {
  return counts.find((item) => item.status === status)?.count ?? 0
}

/**
 * What is happening on the platform right now, from live data: how many
 * accounts, organizations and ideas there are, and where ideas stand in the
 * review lifecycle. Every number is the server's, and each card opens the list
 * it counts. The recent lifecycle moves and administrative actions are on the
 * Activity page.
 */
export function AdminDashboardPage() {
  const { data, loading, error, reload } = useAdminQuery(
    'overview',
    adminOverviewRequest,
    'We could not load the platform overview.',
  )

  return (
    <>
      <AdminPageHeader
        title="Overview"
        description="The platform at a glance. Counts are computed from live data on every visit."
      />
      <SignedInAccount />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {!loading && !error && data === null && <EmptyState title="No overview available." />}
      {data && (
        <div className="space-y-6">
          <section aria-label="Key figures" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Users"
                to="/app/admin/users"
                value={data.userCount}
                hint={`${data.activeUserCount} active`}
                icon={<UsersIcon size="md" />}
                tone="brand"
              />
              <MetricCard
                label="Organizations"
                to="/app/admin/organizations"
                value={data.organizationCount}
                icon={<OrganizationIcon size="md" />}
                tone="cyan"
              />
              <MetricCard
                label="Ideas"
                to="/app/admin/ideas"
                value={data.ideaCount}
                icon={<IdeaIcon size="md" />}
                tone="violet"
              />
              <MetricCard
                label="Reviews in progress"
                to="/app/admin/reviews"
                value={data.openReviewCount}
                hint={`${data.completedReviewCount} completed`}
                icon={<ReviewIcon size="md" />}
                tone="amber"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Awaiting review"
                to="/app/admin/ideas?status=SUBMITTED"
                value={countOf(data.ideasByStatus, 'SUBMITTED')}
                hint="Submitted, not yet picked up"
                icon={<InboxIcon size="md" />}
                tone="sky"
              />
              <MetricCard
                label="Approved"
                to="/app/admin/ideas?status=APPROVED"
                value={countOf(data.ideasByStatus, 'APPROVED')}
                icon={<ApprovedIcon size="md" />}
                tone="brand"
              />
              <MetricCard
                label="Changes requested"
                to="/app/admin/ideas?status=CHANGES_REQUESTED"
                value={countOf(data.ideasByStatus, 'CHANGES_REQUESTED')}
                icon={<ChangesIcon size="md" />}
                tone="amber"
              />
              <MetricCard
                label="Rejected"
                to="/app/admin/ideas?status=REJECTED"
                value={countOf(data.ideasByStatus, 'REJECTED')}
                icon={<RejectedIcon size="md" />}
                tone="red"
              />
            </div>
          </section>

          <RecentUsers total={data.userCount} />
          <IdeasByStatus counts={data.ideasByStatus} total={data.ideaCount} />
        </div>
      )}
    </>
  )
}
