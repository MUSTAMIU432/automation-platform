import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import {
  grantPlatformRoleRequest,
  platformRolesRequest,
  revokePlatformRoleRequest,
  type Outcome,
  type PlatformRole,
} from '../api/platformRolesApi'
import {
  AutomationIcon,
  DecisionIcon,
  InboxIcon,
  ReviewerIcon,
  RoleIcon,
  TeamIcon,
} from '../components/AdminIcons'
import {
  AdminPageHeader,
  EmptyState,
  ErrorState,
  LoadingState,
  Notice,
  glassSurface,
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

/** Where the work itself is handed out, once somebody holds the role for it. */
const WHERE_WORK_IS_ASSIGNED: Record<string, { text: string; to: string; link: string }> = {
  developer: {
    text: 'A delivery manager gives a developer a specific opportunity from the',
    to: '/app/automation/queue',
    link: 'Developer Queue',
  },
  delivery_manager: {
    text: 'They assign each approved idea to a developer from the',
    to: '/app/automation/queue',
    link: 'Developer Queue',
  },
  intake: {
    text: 'They route each submitted idea to a review team from its page under',
    to: '/app/admin/ideas',
    link: 'Ideas',
  },
  proposal_approver: {
    text: 'They send each approval or rejection to its owner, and decide on proposals, from',
    to: '/app/admin/decisions',
    link: 'Decisions',
  },
}

/** The mark beside each role's name; the shield for a role added later. */
const ROLE_ICONS: Record<string, ReactNode> = {
  developer: <AutomationIcon />,
  delivery_manager: <TeamIcon />,
  intake: <InboxIcon />,
  proposal_approver: <DecisionIcon />,
}

/** Two letters for a holder's avatar: initials of the name, or the email's first. */
function initials(name: string, email: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return (letters || email.slice(0, 1)).toUpperCase()
}

/**
 * One role as a glass card: what it is, who holds it, and - for a manager - one
 * field to add somebody. Quiet on purpose: the page is a short list of jobs, so
 * colour is kept for the one action and the names, not spent on headers.
 */
function RoleCard({
  role,
  canManage,
  onChanged,
}: {
  role: PlatformRole
  canManage: boolean
  onChanged: () => void
}) {
  const grant = useAction()
  const revoke = useAction()
  const [email, setEmail] = useState('')
  const headingId = useId()
  const emailId = useId()
  const where = WHERE_WORK_IS_ASSIGNED[role.key]
  const count = role.holders.length

  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col gap-5 rounded-3xl p-5 sm:p-6 ${glassSurface}`}
    >
      <header className="flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand-50/90 text-brand-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-brand-100">
          {ROLE_ICONS[role.key] ?? <RoleIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 id={headingId} className="text-base font-semibold tracking-tight text-slate-900">
              {role.label}
            </h2>
            <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-900/5">
              {count === 0 ? 'Vacant' : `${count} ${count === 1 ? 'holder' : 'holders'}`}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{role.description}</p>
          {where && (
            <p className="mt-1.5 text-xs text-slate-500">
              {where.text}{' '}
              <Link
                to={where.to}
                className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500"
              >
                {where.link}
              </Link>
              .
            </p>
          )}
        </div>
      </header>

      {count === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300/70 bg-white/40 px-4 py-6 text-center">
          <p className="text-sm font-medium text-slate-700">Nobody holds this role yet.</p>
          {canManage && (
            <p className="mt-0.5 text-xs text-slate-500">Add an existing account by its email.</p>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-slate-900/5 overflow-hidden rounded-2xl bg-white/60 ring-1 ring-slate-900/5">
          {role.holders.map((holder) => (
            <li key={holder.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-linear-to-br from-brand-50 to-brand-100 text-xs font-semibold text-brand-700 ring-1 ring-white"
              >
                {initials(holder.name, holder.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-900">
                  {holder.name}
                </span>
                <span className="block truncate text-xs text-slate-500">{holder.email}</span>
              </span>
              {canManage && (
                <button
                  type="button"
                  disabled={revoke.busy}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:transition-colors"
                  onClick={() =>
                    void revoke.run(() => revokePlatformRoleRequest(role.key, holder.id), onChanged)
                  }
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {revoke.notice && <Notice tone={revoke.notice.tone}>{revoke.notice.text}</Notice>}

      {canManage && (
        <form
          aria-label={`Give the ${role.label} role`}
          className="mt-auto"
          onSubmit={(event: FormEvent) => {
            event.preventDefault()
            void grant.run(
              () => grantPlatformRoleRequest(role.key, email),
              () => {
                setEmail('')
                onChanged()
              },
            )
          }}
        >
          <label htmlFor={emailId} className="mb-1.5 block text-xs font-medium text-slate-500">
            Account email
          </label>
          <div className="flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/85 p-1 pl-4 shadow-[inset_0_1px_2px_rgba(15,74,55,0.06)] focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 motion-safe:transition-[border-color,box-shadow]">
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
              placeholder="person@example.com"
            />
            <button
              type="submit"
              disabled={grant.busy || email.trim() === ''}
              className="shrink-0 rounded-full bg-linear-to-r from-brand-600 to-brand-500 px-4 py-1.5 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_18px_-10px_rgba(20,99,73,0.8)] hover:from-brand-700 hover:to-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:from-slate-100 disabled:to-slate-100 disabled:text-slate-400 disabled:shadow-none motion-safe:transition-colors"
            >
              Add
            </button>
          </div>
          {grant.notice && (
            <div className="mt-3">
              <Notice tone={grant.notice.tone}>{grant.notice.text}</Notice>
            </div>
          )}
        </form>
      )}
    </section>
  )
}

/**
 * Who does which job on the platform: developers, delivery managers, intake and
 * proposal approvers, each made from an existing account and each change audited.
 *
 * A role is eligibility, not work - the work is handed out where it happens (a review
 * team per idea, a developer per opportunity), and the conflicts are refused there.
 * Reviewers live on their own page because they also belong to review teams.
 */
export function AdminPlatformRolesPage() {
  const { capabilities } = useAdminCapabilities()
  const canManage = capabilities.canManagePlatformRoles
  const roles = useAdminQuery(
    'admin-platform-roles',
    platformRolesRequest,
    'We could not load the platform roles.',
  )

  return (
    <>
      <AdminPageHeader
        title="Platform roles"
        description="Give existing accounts the platform's jobs. A role makes someone eligible; the work itself is assigned per idea or per opportunity."
      />
      <p className="mb-6 flex w-fit max-w-full items-center gap-2 rounded-full bg-white/60 px-3.5 py-1.5 text-sm text-slate-600 ring-1 ring-slate-900/5 backdrop-blur">
        <span className="text-brand-600">
          <ReviewerIcon size="sm" />
        </span>
        <span>
          Reviewers are made, and formed into review teams, on the{' '}
          <Link
            to="/app/admin/reviewers"
            className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-2 hover:decoration-brand-500"
          >
            Reviewers
          </Link>{' '}
          page.
        </span>
      </p>
      {roles.error && <ErrorState message={roles.error} onRetry={roles.reload} />}
      {roles.loading && !roles.data && <LoadingState label="Loading platform roles…" />}
      {roles.data && roles.data.length === 0 && (
        <EmptyState
          title="Nothing to show."
          description="Managing platform roles needs the platform-roles permission."
        />
      )}
      {roles.data && roles.data.length > 0 && (
        <div className="grid gap-5 xl:grid-cols-2">
          {roles.data.map((role) => (
            <RoleCard key={role.key} role={role} canManage={canManage} onChanged={roles.reload} />
          ))}
        </div>
      )}
    </>
  )
}
