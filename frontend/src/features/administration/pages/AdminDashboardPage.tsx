import { Link } from 'react-router-dom'

import { adminOverviewRequest, type AdminStatusCount } from '../api/administrationApi'
import {
  AdminCard,
  AdminPageHeader,
  EmptyState,
  ErrorState,
  IdeaStatusBadge,
  LoadingState,
  MetricCard,
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
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {!loading && !error && data === null && <EmptyState title="No overview available." />}
      {data && (
        <div className="space-y-6">
          <section aria-label="Key figures" className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Users"
                to="/app/admin/users"
                value={data.userCount}
                hint={`${data.activeUserCount} active`}
                icon={<UsersIcon size="lg" />}
                tone="brand"
              />
              <MetricCard
                label="Organizations"
                to="/app/admin/organizations"
                value={data.organizationCount}
                icon={<OrganizationIcon size="lg" />}
                tone="cyan"
              />
              <MetricCard
                label="Ideas"
                to="/app/admin/ideas"
                value={data.ideaCount}
                icon={<IdeaIcon size="lg" />}
                tone="violet"
              />
              <MetricCard
                label="Reviews in progress"
                to="/app/admin/reviews"
                value={data.openReviewCount}
                hint={`${data.completedReviewCount} completed`}
                icon={<ReviewIcon size="lg" />}
                tone="amber"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Awaiting review"
                to="/app/admin/ideas?status=SUBMITTED"
                value={countOf(data.ideasByStatus, 'SUBMITTED')}
                hint="Submitted, not yet picked up"
                icon={<InboxIcon size="lg" />}
                tone="sky"
              />
              <MetricCard
                label="Approved"
                to="/app/admin/ideas?status=APPROVED"
                value={countOf(data.ideasByStatus, 'APPROVED')}
                icon={<ApprovedIcon size="lg" />}
                tone="brand"
              />
              <MetricCard
                label="Changes requested"
                to="/app/admin/ideas?status=CHANGES_REQUESTED"
                value={countOf(data.ideasByStatus, 'CHANGES_REQUESTED')}
                icon={<ChangesIcon size="lg" />}
                tone="amber"
              />
              <MetricCard
                label="Rejected"
                to="/app/admin/ideas?status=REJECTED"
                value={countOf(data.ideasByStatus, 'REJECTED')}
                icon={<RejectedIcon size="lg" />}
                tone="red"
              />
            </div>
          </section>

          <AdminCard title="Ideas by status">
            <ul aria-label="Ideas by status" className="flex flex-wrap gap-2">
              {data.ideasByStatus.map((item) => (
                <li key={item.status}>
                  <Link
                    to={`/app/admin/ideas?status=${item.status}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <IdeaStatusBadge status={item.status} />
                    <span className="font-semibold text-slate-900 tabular-nums">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      )}
    </>
  )
}
