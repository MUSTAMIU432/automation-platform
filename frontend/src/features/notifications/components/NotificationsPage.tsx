import { useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'

import {
  BulbIcon,
  ChatIcon,
  CheckCircleIcon,
  ChecklistIcon,
  ChevronDownIcon,
  ClockIcon,
  DocumentIcon,
  FlowIcon,
  StoreIcon,
  UsersIcon,
} from '../../../components/AppIcons'

import { hasReportLink, type Notification, type NotificationKind } from '../api/notificationsApi'
import { useNotifications } from '../hooks/useNotifications'
import { formatDate } from '../../reviews/utils/reviewLabels'

/**
 * What the platform has told you, at `/app/notifications`.
 *
 * Two kinds of notification, kept apart because they answer to different rules
 * on the server and this page must not blur them:
 *
 * - a **decision** about an idea (approved, changes asked for, rejected, and so
 *   on) may link to the idea and, for the platform-approved case, to the review
 *   report;
 * - a **nudge** — "somebody submitted something" — links to nothing beyond the
 *   idea it concerns, because pointing a queue notification at an approval report
 *   would be nonsense.
 *
 * Which is which is `hasReportLink`'s question, and that function reads the
 * server's own list of decision kinds rather than testing for a prefix — so
 * adding a queue kind later cannot accidentally make it offer a report.
 *
 * **Nothing here renders content.** A notification says what happened and what to
 * do next; the idea, the report and the feedback all stay behind the sign-in.
 */
export function NotificationsPage() {
  const { notifications, loading, error, unreadCount, reload, markRead, markAllRead } =
    useNotifications()
  // New notifications are the list; once read, one clears into "Earlier", folded.
  const [earlierOpen, setEarlierOpen] = useState(false)
  const fresh = notifications.filter((notification) => !notification.isRead)
  const earlier = notifications.filter((notification) => notification.isRead)

  return (
    <section aria-labelledby="notifications-heading" className="mt-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-brand-700 uppercase">
            Notifications
          </p>
          <h1
            id="notifications-heading"
            className="mt-1 text-3xl font-bold tracking-tight text-gray-900"
          >
            What has happened.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
            Decisions about your ideas, and invitations waiting for you. The ideas themselves stay
            behind your sign-in.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-white/80 bg-white/70 px-4 text-sm font-semibold text-brand-800 shadow-[0_10px_24px_-16px_rgba(8,75,56,0.6)] ring-1 ring-slate-900/5 backdrop-blur hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 sm:self-auto"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      <div className="mt-8">
        {loading && notifications.length === 0 ? (
          <p className="text-sm text-gray-600">Loading your notifications…</p>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
            <p className="text-sm font-semibold text-red-800">Notifications unavailable</p>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            >
              Try again
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className={`${glassPanel} flex flex-col items-center px-6 py-12 text-center`}>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <ClockIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm font-semibold text-gray-900">Nothing to report yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Decisions and invitations will show up here as they happen.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-900">New</h2>
              {fresh.length > 0 && (
                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">
                  {fresh.length}
                </span>
              )}
            </div>
            {fresh.length === 0 ? (
              <div className={`${glassPanel} mt-3 flex items-center gap-4 px-5 py-5`}>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                  <CheckCircleIcon className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">You are all caught up.</p>
                  <p className="mt-0.5 text-sm text-gray-500">
                    New decisions and invitations will appear here.
                  </p>
                </div>
              </div>
            ) : (
              <ul
                aria-label="New notifications"
                className={`${glassPanel} mt-3 divide-y divide-slate-100 overflow-hidden`}
              >
                {fresh.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onRead={() => void markRead(notification.id)}
                  />
                ))}
              </ul>
            )}
            {earlier.length > 0 && (
              <div className="mt-8">
                <button
                  type="button"
                  aria-expanded={earlierOpen}
                  aria-controls="earlier-notifications"
                  onClick={() => setEarlierOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-gray-600 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  {earlierOpen ? 'Hide earlier' : `Earlier (${earlier.length})`}
                  <ChevronDownIcon
                    className={`h-4 w-4 motion-safe:transition-transform ${earlierOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {earlierOpen && (
                  <ul
                    id="earlier-notifications"
                    aria-label="Earlier notifications"
                    className={`${glassPanel} mt-3 divide-y divide-slate-100 overflow-hidden`}
                  >
                    {earlier.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onRead={() => void markRead(notification.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

const glassPanel =
  'rounded-3xl border border-white/80 bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_20px_50px_-36px_rgba(8,75,56,0.5)] ring-1 ring-slate-900/[0.04] backdrop-blur-xl'

/**
 * One notification: what it says, and the one thing to do about it.
 *
 * Unread rows are marked by a tinted surface and an accent bar rather than by bolding
 * the text, because the words are the server's and this client should not be
 * restyling them to carry a state the server already reports as `isRead`.
 */
function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: () => void
}) {
  const { Icon, tile } = appearanceOf(notification.kind)

  return (
    <li
      className={`relative px-5 py-4 transition-colors sm:px-6 ${
        notification.isRead ? 'hover:bg-white/60' : 'bg-brand-50/50 hover:bg-brand-50/80'
      }`}
    >
      {!notification.isRead && (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand-500"
        />
      )}
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${tile}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
            <time
              dateTime={notification.createdAt}
              title={formatDate(notification.createdAt)}
              className="shrink-0 text-xs text-gray-500"
            >
              {timeAgo(notification.createdAt)}
            </time>
          </div>
          {notification.body ? (
            <p className="mt-1 text-sm leading-6 text-gray-600">{notification.body}</p>
          ) : null}
          <p className="mt-1.5 text-xs font-medium text-gray-500">
            {notificationLabel(notification.kind)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {/*
              **Where this goes is the server's answer.** `actionPath` comes from
              one mapping on the server that also builds any payload for a future
              push channel, so an in-app link and a notification tapped on a
              phone cannot land on different screens. This client used to compose
              the destination itself out of `ideaId` and the kind, which is how
              three links came to point at a route that did not exist.

              A report link is offered separately and only for a decision about
              an idea, because the report is the thing worth reading in that case
              and the idea page is not.
            */}
            {notification.actionPath && (
              <Link
                to={notification.actionPath}
                // Opening it is reading it: it clears from the new ones.
                onClick={notification.isRead ? undefined : onRead}
                className="inline-flex h-8 items-center rounded-full bg-brand-600 px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                {actionLinkLabel(notification)}
              </Link>
            )}
            {notification.reportId && hasReportLink(notification.kind) && (
              <Link
                to={`/app/ideas/${notification.ideaId}/report`}
                className="inline-flex h-8 items-center rounded-full border border-brand-200 bg-white/80 px-3.5 text-xs font-semibold text-brand-800 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Read the review report
              </Link>
            )}
            {!notification.isRead && (
              <button
                type="button"
                onClick={onRead}
                className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-gray-600 hover:bg-white/80 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
              >
                Mark as read
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

type Tone = 'good' | 'bad' | 'attention' | 'neutral'

const TONE_TILES: Record<Tone, string> = {
  good: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  bad: 'bg-red-50 text-red-600 ring-red-100',
  attention: 'bg-amber-50 text-amber-600 ring-amber-100',
  neutral: 'bg-brand-50 text-brand-600 ring-brand-100',
}

const AREA_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  idea: BulbIcon,
  review: ChecklistIcon,
  proposal: DocumentIcon,
  delivery: FlowIcon,
  automation: FlowIcon,
  marketplace: StoreIcon,
  invitation: UsersIcon,
  message: ChatIcon,
}

/**
 * How a row looks: the icon for the part of the platform it comes from, tinted
 * by how the news went. Read from the kind - a stable identifier - never from the
 * server's wording.
 */
function appearanceOf(kind: NotificationKind) {
  const [area, what = ''] = kind.split('.')
  const tone: Tone = /rejected|failed|declined/.test(what)
    ? 'bad'
    : /changes_requested|returned/.test(what)
      ? 'attention'
      : /approved|confirmed|passed|completed|accepted|released|go_ahead|answered|recorded/.test(
            what,
          )
        ? 'good'
        : 'neutral'
  return { Icon: AREA_ICONS[area] ?? ClockIcon, tile: TONE_TILES[tone] }
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", then the date. */
function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  if (hours < 48) return 'Yesterday'
  return formatDate(iso)
}

/**
 * What the link says, from where it points.
 *
 * The destination is the server's; the wording is this client's, and it names
 * the thing rather than the route - "Open the idea", "Read the report", "Open
 * your conversations" - so a reader is not shown a path.
 */
function actionLinkLabel(notification: Notification): string {
  const path = notification.actionPath ?? ''
  if (path.endsWith('#respond')) return 'Respond to the review'
  if (path.endsWith('#decision-letter')) return 'Read your letter'
  if (path.endsWith('#proposal')) return 'See the proposal'
  if (path.includes('?tab=uat')) return 'Open acceptance testing'
  if (path.includes('?tab=testing')) return 'Open testing'
  if (path.includes('?tab=deployment')) return 'Open the deployment'
  if (path.includes('?tab=impact')) return 'Open the impact'
  if (path.includes('?tab=work')) return 'Open tasks and milestones'
  if (path.startsWith('/app/automation/projects/')) return 'Open the project'
  if (path.startsWith('/app/automation/opportunities/')) return 'Open the opportunity'
  if (path.startsWith('/app/automation/queue')) return 'Open the developer queue'
  if (path.endsWith('/report')) return 'Read the review report'
  if (path.startsWith('/app/messages')) return 'Open your conversations'
  if (path.startsWith('/app/reviews/proposals/')) return 'Open the proposal'
  if (path.startsWith('/app/reviews')) return 'Open the review'
  if (path.startsWith('/app/admin/decisions')) return 'Open Decisions'
  if (path.startsWith('/app/admin/proposals')) return 'Open Proposals'
  if (path.endsWith('/proposal')) return 'Read your proposal'
  if (path.startsWith('/app/ideas')) return 'Open the idea'
  return 'Open'
}

/**
 * A plain description of what kind of thing this is, for the row's meta line.
 *
 * The server sends a title and a body; it does not send a human name for the
 * kind, and inventing one here would be a second vocabulary to keep in step.
 * So this reads the kind itself, which is a stable identifier rather than
 * display text.
 */
function notificationLabel(kind: NotificationKind): string {
  const [, what] = kind.split('.')
  return what.replace(/_/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase())
}
