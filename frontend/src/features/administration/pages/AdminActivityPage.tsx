import type { ReactNode } from 'react'

import { Link } from 'react-router-dom'

import { statusLabel } from '../../ideas/utils/lifecycle'
import { adminOverviewRequest } from '../api/administrationApi'
import {
  AdminCard,
  AdminPageHeader,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  Restricted,
} from '../components/AdminUi'
import { useAdminQuery } from '../hooks/useAdminQuery'
import { auditActionLabel, auditTargetPath, formatDateTime, ideaHomeLabel } from '../utils/format'

const ROW = 'block -mx-2 rounded-lg px-2 py-2.5 text-sm'

/** A row that opens `to` when there is somewhere to go, and stays plain text when there is not. */
function ActivityRow({ to, children }: { to: string | null; children: ReactNode }) {
  if (!to) return <div className={ROW}>{children}</div>
  return (
    <Link
      to={to}
      className={`${ROW} hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400`}
    >
      {children}
    </Link>
  )
}

/**
 * What has happened on the platform lately: the ideas that moved through the lifecycle,
 * and what administrators did. Kept off the dashboard so the dashboard stays the figures;
 * every row opens the page of the thing it is about.
 */
export function AdminActivityPage() {
  const { data, loading, error, reload } = useAdminQuery(
    'overview',
    adminOverviewRequest,
    'We could not load the recent activity.',
  )

  return (
    <>
      <AdminPageHeader
        title="Activity"
        description="The latest lifecycle moves and administrative actions. Click a row to open it."
      />
      {error && <ErrorState message={error} onRetry={reload} />}
      {loading && !data && <LoadingState />}
      {!loading && !error && data === null && <EmptyState title="No activity available." />}
      {data && (
        <div className="grid gap-6 xl:grid-cols-2">
          <AdminCard title="Recent lifecycle activity">
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-slate-500">No lifecycle activity yet.</p>
            ) : (
              <ul aria-label="Recent lifecycle activity" className="divide-y divide-slate-100">
                {data.recentActivity.map((activity) => (
                  <li key={activity.id}>
                    <ActivityRow to={`/app/admin/ideas/${activity.ideaId}`}>
                      <span className="font-semibold text-slate-900">
                        {activity.ideaTitle ?? <Restricted>Restricted idea</Restricted>}
                      </span>{' '}
                      <span className="text-slate-600">
                        {statusLabel(activity.fromStatus)} → {statusLabel(activity.toStatus)}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {activity.actor.name} · {ideaHomeLabel(activity)} ·{' '}
                        {formatDateTime(activity.createdAt)}
                      </span>
                    </ActivityRow>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>

          <AdminCard title="Recent administrative actions">
            {data.recentAdminActions.length === 0 ? (
              <p className="text-sm text-slate-500">No administrative actions yet.</p>
            ) : (
              <ul aria-label="Recent administrative actions" className="divide-y divide-slate-100">
                {data.recentAdminActions.map((entry) => (
                  <li key={entry.id}>
                    <ActivityRow to={auditTargetPath(entry)}>
                      <span className="font-semibold text-slate-900">
                        {auditActionLabel(entry.action)}
                      </span>{' '}
                      {entry.result === 'REFUSED' && <Badge tone="bad">Refused</Badge>}
                      {entry.targetLabel && (
                        <span className="text-slate-600"> · {entry.targetLabel}</span>
                      )}
                      <span className="block text-xs text-slate-500">
                        {entry.actor ? entry.actor.name : 'Command line'} ·{' '}
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </ActivityRow>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      )}
    </>
  )
}
