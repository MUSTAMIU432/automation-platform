import { useId, useState, type ComponentType } from 'react'
import { Link, matchPath, useLocation } from 'react-router-dom'

import {
  AutomationIcon,
  BellIcon,
  CloseIcon,
  DashboardIcon,
  IdeaIcon,
  InvitationIcon,
  MarketIcon,
  MenuIcon,
  MessageIcon,
  OrganizationIcon,
  PaymentIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  ProposalIcon,
  ReviewerIcon,
  ReviewIcon,
  RoleIcon,
  TagIcon,
  TeamIcon,
  UsersIcon,
  type AdminIconSize,
} from './AdminIcons'
import { REVIEW_TABS, type AdminTab } from './sectionTabs'

interface Section {
  to: string
  label: string
  icon: ComponentType<{ size?: AdminIconSize }>
  end?: boolean
  /** In-page tabs: the entry is current on any of their pages too. */
  tabs?: AdminTab[]
}

/*
  The console's sections, in the order somebody investigating the platform reads
  them: who exists, what tenants and collaborations exist, the work itself, and
  finally the things the platform has done about it. The groups only name runs
  of that order; they never reorder it. Closely related pages share one entry
  and appear as tabs on the page (see `sectionTabs`), so the sidebar stays
  short.

  **Teams sit beside Organizations rather than inside it** because a team is a
  collaboration boundary and not a tenant — it belongs to no organization and
  validates nothing — so grouping it under Organizations would say it is a kind
  of organization, which is the mistake the `teams` domain exists to prevent.
  Invitations, Messages and Notifications follow Teams for the same reason: they
  are the records of who was asked to join, who is talking, and what the platform
  told them.
*/
const GROUPS: Array<{ label: string; sections: Section[] }> = [
  {
    label: 'Overview',
    sections: [{ to: '/app/admin', label: 'Dashboard', icon: DashboardIcon, end: true }],
  },
  {
    label: 'Accounts',
    sections: [
      { to: '/app/admin/users', label: 'Users', icon: UsersIcon },
      { to: '/app/admin/organizations', label: 'Organizations', icon: OrganizationIcon },
      { to: '/app/admin/teams', label: 'Teams', icon: TeamIcon },
    ],
  },
  {
    label: 'Review workflow',
    sections: [
      { to: '/app/admin/ideas', label: 'Customer ideas', icon: IdeaIcon },
      { to: '/app/admin/reviews', label: 'Reviews', icon: ReviewIcon, tabs: REVIEW_TABS },
      { to: '/app/admin/reviewers', label: 'Reviewers', icon: ReviewerIcon },
      { to: '/app/admin/roles', label: 'Platform roles', icon: RoleIcon },
    ],
  },
  {
    label: 'Delivery',
    sections: [
      { to: '/app/admin/proposals', label: 'Proposals', icon: ProposalIcon },
      { to: '/app/admin/automation', label: 'Automation', icon: AutomationIcon },
    ],
  },
  {
    label: 'Marketplace',
    sections: [
      { to: '/app/admin/marketplace/ideas', label: 'Platform ideas', icon: MarketIcon },
      { to: '/app/admin/marketplace/payments', label: 'Payments', icon: PaymentIcon },
      { to: '/app/admin/marketplace/enquiries', label: 'Enquiries', icon: MessageIcon },
      { to: '/app/admin/marketplace/methods', label: 'Payment methods', icon: PaymentIcon },
    ],
  },
  {
    label: 'Communication',
    sections: [
      { to: '/app/admin/invitations', label: 'Invitations', icon: InvitationIcon },
      { to: '/app/admin/messages', label: 'Messages', icon: MessageIcon },
      { to: '/app/admin/notifications', label: 'Notifications', icon: BellIcon },
    ],
  },
  {
    label: 'Settings',
    sections: [{ to: '/app/admin/categories', label: 'Categories', icon: TagIcon }],
  },
]

const COLLAPSED_KEY = 'admin.sidebar.collapsed'

// The collapsed rail is a per-viewer convenience, so storage that is blocked
// or cleared just means the sidebar opens expanded.
function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* not remembered; nothing else depends on it */
  }
}

// A section's own pages and their sub-pages (an idea under Ideas), and every
// page of its tabs, all count as being on it.
function isOn(section: Section, pathname: string): boolean {
  const paths = [section.to, ...(section.tabs ?? []).map((tab) => tab.to)]
  return paths.some((path) => matchPath({ path, end: section.end ?? false }, pathname))
}

function currentSection(pathname: string): Section | undefined {
  return GROUPS.flatMap((group) => group.sections).find((section) => isOn(section, pathname))
}

/**
 * The console's navigation, laid out like a settings sidebar: a way back to the
 * workspace, the console's title, then the grouped sections - quiet grey rows
 * with the current one tinted in the brand colour. On a wide screen it is a
 * full-height column beside the page, sized so every section fits a
 * laptop-height window without scrolling (a shorter window can still scroll it,
 * without a scrollbar, so nothing becomes unreachable), and its footer collapses
 * it to a rail of icons - each still named, by its tooltip and for screen
 * readers - a choice that is remembered. On a narrow screen it is a card that
 * folds behind a "Menu" button naming the section you are on.
 */
export function AdminSidebar() {
  const navId = useId()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)
  const current = currentSection(pathname)

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    writeCollapsed(next)
  }

  const whenCollapsed = (classes: string) => (collapsed ? classes : '')

  return (
    <aside
      data-collapsed={collapsed}
      className={`shrink-0 rounded-xl bg-white p-3 ring-1 ring-slate-200 transition-[width] duration-200 lg:sticky lg:top-[calc(var(--app-chrome-height)+1rem)] lg:flex lg:h-[calc(100dvh-var(--app-chrome-height)-2rem)] lg:flex-col lg:self-start lg:rounded-none lg:border-r lg:border-slate-200 lg:bg-transparent lg:py-0 lg:pr-3 lg:pl-0 lg:ring-0 ${
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* The console is an administrator's home: there is no workspace to go back to. */}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={navId}
          onClick={() => setMenuOpen((open) => !open)}
          className="ml-auto inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 lg:hidden"
        >
          <span>{current?.label}</span>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
          <span className="sr-only">{menuOpen ? 'Close menu' : 'Menu'}</span>
        </button>
      </div>
      <h2
        className={`mt-4 px-1 text-xl font-semibold tracking-tight text-slate-900 ${whenCollapsed(
          'lg:sr-only',
        )}`}
      >
        Administration
      </h2>

      <nav
        id={navId}
        aria-label="Administration"
        className={`mt-1 overflow-y-auto [scrollbar-width:none] lg:block lg:min-h-0 lg:flex-1 [&::-webkit-scrollbar]:hidden ${
          menuOpen ? 'block' : 'hidden'
        }`}
      >
        {GROUPS.map((group, index) => (
          <div key={group.label} className="pt-3.5">
            <p
              className={`px-1 pb-1 text-xs font-medium tracking-wide text-slate-500 uppercase ${whenCollapsed(
                'lg:sr-only',
              )}`}
            >
              {group.label}
            </p>
            {collapsed && index > 0 && (
              <hr aria-hidden="true" className="mx-2 mb-2 hidden border-slate-200 lg:block" />
            )}
            <ul className="space-y-0.5">
              {group.sections.map((section) => {
                const { to, label, icon: SectionIcon } = section
                const active = isOn(section, pathname)
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? label : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={`group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm leading-5 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${whenCollapsed(
                        'lg:justify-center lg:px-0',
                      )} ${
                        active
                          ? 'bg-brand-100/70 font-semibold text-brand-800'
                          : 'font-medium text-slate-700 hover:bg-slate-200/60 hover:text-slate-900'
                      }`}
                    >
                      <span
                        className={
                          active
                            ? 'text-brand-700'
                            : 'text-slate-500 transition-colors group-hover:text-slate-700'
                        }
                      >
                        <SectionIcon />
                      </span>
                      <span className={whenCollapsed('lg:sr-only')}>{label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-2 hidden border-t border-slate-200 py-2 lg:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm leading-5 font-medium text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${whenCollapsed(
            'lg:justify-center lg:px-0',
          )}`}
        >
          {collapsed ? <PanelExpandIcon /> : <PanelCollapseIcon />}
          <span className={whenCollapsed('sr-only')}>Collapse</span>
        </button>
      </div>
    </aside>
  )
}
