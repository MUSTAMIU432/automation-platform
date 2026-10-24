import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { myAutomationRolesRequest } from '../api/automationApi'
import {
  MODE_HOME,
  modeFor,
  NO_ROLES,
  readChosenMode,
  rememberMode,
  type AutomationMode,
} from '../utils/useAutomationRoles'
import { DeliveryGuide } from './DeliverySteps'
import { useLoad } from '../utils/useLoad'

interface Tab {
  to: string
  label: string
}

/** One job at a time: each mode shows only the tabs that job uses. */
function tabsFor(mode: AutomationMode): Tab[] {
  if (mode === 'developer') {
    return [
      { to: 'workspace', label: 'Workspace' },
      { to: 'tasks', label: 'My tasks' },
      { to: 'queue', label: 'Developer queue' },
      { to: 'projects', label: 'Projects' },
    ]
  }
  if (mode === 'reviewer') {
    return [
      { to: 'review-queue', label: 'Review queue' },
      { to: 'opportunities', label: 'Opportunities' },
      { to: 'projects', label: 'Projects' },
    ]
  }
  // Everyone else - a delivery manager included - uses Automation as an ordinary user:
  // their own ideas in delivery. Managing delivery is the admin console's.
  return [
    { to: 'opportunities', label: 'Opportunities' },
    { to: 'projects', label: 'Projects' },
  ]
}

const HEADINGS: Record<AutomationMode, { title: string; text: string }> = {
  developer: {
    title: 'Your delivery workspace',
    text: 'Pick up your projects, write the implementation plan, build stage by stage and send each step to the admin for confirmation.',
  },
  reviewer: {
    title: 'Your review queue',
    text: 'Review the ideas routed to you and your team, and follow them through to delivery.',
  },
  browse: {
    title: 'Your ideas in delivery',
    text: 'Follow your approved ideas through delivery, from the proposal to the measured result.',
  },
}

function PenIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M6.3 5.3a1 1 0 0 1 0 1.4L3.4 9.6l2.9 2.9a1 1 0 1 1-1.4 1.4L1.3 10.3a1 1 0 0 1 0-1.4l3.6-3.6a1 1 0 0 1 1.4 0zm7.4 0a1 1 0 0 1 1.4 0l3.6 3.6a1 1 0 0 1 0 1.4l-3.6 3.6a1 1 0 1 1-1.4-1.4l2.9-2.9-2.9-2.9a1 1 0 0 1 0-1.4zM11.7 2a1 1 0 0 1 .7 1.2l-3 13a1 1 0 1 1-2-.4l3-13A1 1 0 0 1 11.7 2z" />
    </svg>
  )
}

function ReviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M7 2a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H7zM4 5a2 2 0 0 1 2-2v1a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zm9.7 4.7a1 1 0 0 0-1.4-1.4L9 11.6 7.7 10.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4z" />
    </svg>
  )
}

/** Developer or reviewer, for someone who is both. */
function ModeSwitch({
  mode,
  onChange,
}: {
  mode: AutomationMode
  onChange: (mode: AutomationMode) => void
}) {
  const option = (value: AutomationMode, text: string, icon: React.ReactNode) => (
    <button
      type="button"
      aria-pressed={mode === value}
      onClick={() => onChange(value)}
      className={`inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${
        mode === value
          ? 'bg-white text-brand-800 shadow-sm ring-1 ring-gray-200'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {text}
    </button>
  )
  return (
    <fieldset className="inline-flex shrink-0 gap-1 rounded-xl bg-gray-100 p-1">
      <legend className="sr-only">Work as</legend>
      {option('developer', 'Developer', <PenIcon />)}
      {option('reviewer', 'Reviewer', <ReviewIcon />)}
    </fieldset>
  )
}

function RoleChip({ mode }: { mode: AutomationMode }) {
  const text = mode === 'developer' ? 'Developer' : mode === 'reviewer' ? 'Reviewer' : null
  if (!text) return null
  return (
    <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
      {text}
    </span>
  )
}

/**
 * The Automation area. Someone who is both developer and reviewer switches between the
 * two jobs, and sees only the tabs of the one they are doing; anyone else sees the tabs
 * their role gives them.
 */
export function AutomationLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const loaded = useLoad(myAutomationRolesRequest, 'automation-roles')
  const roles = loaded.data ?? NO_ROLES
  const [chosen, setChosen] = useState<AutomationMode | null>(readChosenMode)
  const mode = modeFor(roles, chosen)
  const both = roles.isDeveloper && roles.isReviewer
  const heading = HEADINGS[mode]

  function switchTo(next: AutomationMode) {
    if (next === mode) return
    setChosen(next)
    rememberMode(next)
    navigate(`/app/automation/${MODE_HOME[next]}`)
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-jade">
            Automation
            {!both && <RoleChip mode={mode} />}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{heading.title}</h1>
          <p className="mt-1.5 text-sm text-sage">{heading.text}</p>
          {roles.isDeliveryManager && (
            <p className="mt-2 text-sm text-sage">
              Assigning developers and approving delivery happens in the admin console.{' '}
              <Link to="/app/admin/automation" className="font-semibold text-jade hover:underline">
                Open the delivery desk
              </Link>
            </p>
          )}
        </div>
        {both && <ModeSwitch mode={mode} onChange={switchTo} />}
      </header>

      {/* The guide belongs to the lists; a single opportunity or project has its own tracker. */}
      {mode === 'browse' &&
        /^\/app\/automation(\/(opportunities|projects))?\/?$/.test(pathname) && (
          <div className="mt-5">
            <DeliveryGuide />
          </div>
        )}

      <nav
        aria-label="Automation"
        className="mt-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1 shadow-sm"
      >
        {tabsFor(mode).map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `inline-flex h-10 shrink-0 items-center rounded-xl px-4 text-sm font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/40 ${
                isActive
                  ? 'bg-forest text-white shadow-sm'
                  : 'text-sage hover:bg-mist hover:text-ink'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={{ roles, mode }} />
    </>
  )
}
