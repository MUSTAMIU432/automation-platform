import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type FormEvent,
  type RefObject,
} from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  BuildingIcon,
  BulbIcon,
  CapIcon,
  ChatIcon,
  ChecklistIcon,
  CloseIcon,
  CodeIcon,
  FlowIcon,
  GearIcon,
  GridIcon,
  HelpIcon,
  ListIcon,
  MenuIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  SearchIcon,
  StoreIcon,
  UsersIcon,
} from '../components/AppIcons'
import { Logo } from '../components/Logo'
import { useCollapsed } from '../components/useCollapsed'
import { AdminCapabilitiesProvider } from '../features/administration/context/AdminCapabilitiesProvider'
import { useAdminCapabilities } from '../features/administration/context/useAdminCapabilities'
import { useAuth } from '../features/identity/auth/AuthContext'
import { readReturnTo } from '../lib/returnTo'
import { UserMenu } from '../features/identity/components/UserMenu'
import { OrganizationProvider } from '../features/organizations/context/OrganizationProvider'
import { useOrganization } from '../features/organizations/context/useOrganization'
import { useUnreadMessageThreads } from '../features/messaging/hooks/useMessages'
import { useUnreadNotifications } from '../features/notifications/hooks/useUnreadNotifications'
import { useCanReview } from '../features/reviews/hooks/useCanReview'

/**
 * Shell for the authenticated `/app` area: one header, one navigation bar and
 * one `OrganizationProvider` shared by every `/app` child.
 *
 * The provider lives here rather than around each page so the organization
 * picked in the switcher survives moving between Workspace, Ideas and
 * Reviews - a provider per route would remount on navigation and fall back to
 * the first membership every time. `AdminCapabilitiesProvider` sits here for
 * the same reason: the "Admin" link and the console's own gate share one
 * answer to "is this a platform administrator?", asked once per user.
 */
export function AppLayout() {
  return (
    <OrganizationProvider>
      <AdminCapabilitiesProvider>
        <AppShell />
      </AdminCapabilitiesProvider>
    </OrganizationProvider>
  )
}

/** The administrator's one link, in the header (the console has its own sidebar). */
function adminLinkClass({ isActive }: { isActive: boolean }): string {
  return `rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
    isActive
      ? 'bg-white text-brand-800 shadow-sm'
      : 'text-white/85 hover:bg-white/10 hover:text-white'
  }`
}

interface Crumb {
  label: string
  /**
   * Where the crumb links to; the last crumb is the current page and has none. A
   * function builds the address from the page's own (the idea a proposal belongs to).
   */
  to?: string | ((match: RegExpMatchArray) => string)
}

const ideaOf = (match: RegExpMatchArray) => `/app/ideas/${match[1]}`

/*
  Where each `/app` sub-page sits under "Workspace", for the back arrow: the last
  crumb with a link is where back leads.

  Patterns rather than exact paths, because half these pages carry an id — a
  team, a conversation, an idea's report — and an exact lookup would give them
  no way back at all. Ordered longest-first so `/app/ideas/:id/report` matches
  its own entry rather than the bare `/app/ideas/:id` one.
*/
const SECTION_TRAILS: Array<[RegExp, Crumb[]]> = [
  [/^\/app\/help$/, [{ label: 'Help & Support' }]],
  [/^\/app\/ideas\/new$/, [{ label: 'Ideas', to: '/app/ideas' }, { label: 'New idea' }]],
  [
    /^\/app\/ideas\/([^/]+)\/edit$/,
    [{ label: 'Ideas', to: '/app/ideas' }, { label: 'Idea', to: ideaOf }, { label: 'Edit idea' }],
  ],
  [
    /^\/app\/ideas\/([^/]+)\/report$/,
    [
      { label: 'Ideas', to: '/app/ideas' },
      { label: 'Idea', to: ideaOf },
      { label: 'Review report' },
    ],
  ],
  [
    /^\/app\/ideas\/([^/]+)\/proposal$/,
    [{ label: 'Ideas', to: '/app/ideas' }, { label: 'Idea', to: ideaOf }, { label: 'Proposal' }],
  ],
  [/^\/app\/ideas\/[^/]+$/, [{ label: 'Ideas', to: '/app/ideas' }, { label: 'Idea' }]],
  [/^\/app\/ideas$/, [{ label: 'Ideas' }]],
  [/^\/app\/reviews$/, [{ label: 'Reviews' }]],
  [
    /^\/app\/reviews\/proposals\/[^/]+$/,
    [{ label: 'Reviews', to: '/app/reviews' }, { label: 'Proposal' }],
  ],
  [
    /^\/app\/automation\/opportunities\/[^/]+$/,
    [{ label: 'Automation', to: '/app/automation' }, { label: 'Opportunity' }],
  ],
  [
    /^\/app\/automation\/projects\/[^/]+$/,
    [{ label: 'Automation', to: '/app/automation' }, { label: 'Project' }],
  ],
  [/^\/app\/automation(\/.*)?$/, [{ label: 'Automation' }]],
  [
    /^\/app\/organizations\/[^/]+$/,
    [{ label: 'Organizations', to: '/app/organizations' }, { label: 'Organization' }],
  ],
  [/^\/app\/organizations$/, [{ label: 'Organizations' }]],
  [/^\/app\/teams\/[^/]+$/, [{ label: 'Teams', to: '/app/teams' }, { label: 'Team' }]],
  [/^\/app\/teams$/, [{ label: 'Teams' }]],
  [
    /^\/app\/messages\/[^/]+$/,
    [{ label: 'Messages', to: '/app/messages' }, { label: 'Conversation' }],
  ],
  [/^\/app\/messages$/, [{ label: 'Messages' }]],
  [/^\/app\/notifications$/, [{ label: 'Notifications' }]],
  [
    /^\/app\/marketplace\/[^/]+$/,
    [{ label: 'Marketplace', to: '/app/marketplace' }, { label: 'Idea' }],
  ],
  [/^\/app\/marketplace$/, [{ label: 'Marketplace' }]],
  [
    /^\/app\/learn\/courses\/([^/]+)\/(lessons|exercises|quizzes)\/[^/]+$/,
    [
      { label: 'Learning', to: '/app/learn' },
      { label: 'Course', to: (match) => `/app/learn/courses/${match[1]}` },
      { label: 'Lesson' },
    ],
  ],
  [
    /^\/app\/learn\/courses\/[^/]+$/,
    [
      { label: 'Learning', to: '/app/learn' },
      { label: 'Courses', to: '/app/learn/courses' },
      { label: 'Course' },
    ],
  ],
  [/^\/app\/learn\/courses$/, [{ label: 'Learning', to: '/app/learn' }, { label: 'Courses' }]],
  [/^\/app\/learn$/, [{ label: 'Learning' }]],
]

/**
 * The way back from an `/app` sub-page: a round arrow just above the page's
 * title. No trail of links and no addresses - the title says where the reader
 * is, and the arrow takes them back.
 *
 * Back means one step up - from an idea to Ideas, from a team to Teams - and a
 * section's own top page leads home. A page opened as a detour ("View original
 * idea" from a project, say) leads back to where the reader was instead. So the
 * arrow goes where the reader expects however they arrived: a refresh, a
 * notification, a bookmark. The workspace home has no arrow: it is home.
 */
function BackButton() {
  const { pathname, state } = useLocation()
  const detour = readReturnTo(state)
  const normalized = pathname.replace(/\/+$/, '')
  const entry = SECTION_TRAILS.find(([pattern]) => pattern.test(normalized))
  if (!entry) return null
  const match = normalized.match(entry[0]) as RegExpMatchArray
  const parent = [...entry[1]]
    .reverse()
    .map((crumb) => ({
      label: crumb.label,
      to: typeof crumb.to === 'function' ? crumb.to(match) : crumb.to,
    }))
    .find((crumb) => crumb.to)
  const back =
    detour ??
    (parent?.to
      ? { path: parent.to, label: `Back to ${parent.label.toLowerCase()}`, state: undefined }
      : { path: '/app', label: 'Back to home', state: undefined })

  return (
    <Link
      to={back.path}
      state={back.state}
      aria-label={back.label}
      title={back.label}
      className="group inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-white/80 text-brand-700 shadow-sm backdrop-blur transition-colors hover:border-brand-300 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-5 w-5 transition-transform group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.5 15 7.5 10l5-5" />
      </svg>
    </Link>
  )
}

/**
 * The rendered height of an element, kept current as it changes - the header
 * wraps on narrow screens, and the back arrow comes and goes between pages.
 */
function useElementHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setHeight(element.offsetHeight)
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return height
}

/**
 * The bell, and the number of things waiting behind it.
 *
 * Asked for once per mount rather than on every navigation: the badge is in the
 * app chrome, so it renders on every authenticated page, and a request per page
 * would be a request the reader never asked for. A write that changes the count
 * is a navigation away, so the badge is at worst one page stale — and a badge
 * that is briefly wrong is a much smaller problem than a header that re-queries
 * the server every time somebody clicks a link.
 *
 * The count is the **server's** number rather than a count of a list this
 * component does not hold, so it is right even when the notifications page has
 * never been opened.
 */
function NotificationBell() {
  const unread = useUnreadNotifications()

  return (
    <Link
      to="/app/notifications"
      aria-label={
        unread === 0 ? 'Notifications, nothing unread' : `Notifications, ${unread} unread`
      }
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* A bell, with a clapper: the outline alone reads as a lamp at this size. */}
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[1.25rem] rounded-full bg-amber-400 px-1 text-center text-[11px] font-bold text-amber-950 tabular-nums"
          aria-hidden="true"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  )
}

interface SidebarItem {
  to: string
  label: string
  Icon: ComponentType<{ className?: string }>
  /** Exact match only (the dashboard), or a custom rule for a shared prefix. */
  end?: boolean
  isActive?: (pathname: string) => boolean
  badge?: number
  ariaLabel?: string
}

interface SidebarSection {
  title: string
  items: SidebarItem[]
}

const FOOTER_LINKS = [
  { to: '/app/settings', label: 'Settings', Icon: GearIcon },
  { to: '/app/help', label: 'Help & Support', Icon: HelpIcon },
]

function sidebarLinkClass(active: boolean, collapsed: boolean): string {
  return `group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50 ${
    collapsed ? 'lg:justify-center lg:px-0 lg:py-3' : ''
  } ${
    active
      ? 'bg-gradient-to-r from-mint/45 to-mint/15 font-semibold text-forest shadow-[inset_0_0_0_1px_rgba(11,143,101,0.15)]'
      : 'text-ink/75 hover:bg-white/80 hover:text-forest'
  }`
}

/**
 * The signed-in app's navigation: what there is to do, grouped by the kind of
 * work. Reviews is offered only to someone who can review (the server still
 * authorizes the queue); everything else needs nothing but a session.
 *
 * On a wide screen it collapses to a rail of icons - the button at its top -
 * and the page takes the room. In the rail each link keeps its name for
 * assistive technology and shows it on hover, a count becomes a dot on its
 * icon, and the section titles become dividers. The choice is remembered on
 * this device. The phone's slide-out menu is always full width.
 */
function Sidebar({
  sections,
  pathname,
  open,
  onNavigate,
}: {
  sections: SidebarSection[]
  pathname: string
  open: boolean
  onNavigate: () => void
}) {
  const [expanded, toggleExpanded] = useCollapsed('app.sidebar', true)
  const collapsed = !expanded
  // Only the wide layout collapses; the phone's drawer ignores it.
  const whenCollapsed = (classes: string) => (collapsed ? classes : '')

  return (
    <aside
      id="app-sidebar"
      data-collapsed={collapsed}
      className={`${
        open
          ? 'fixed inset-y-0 left-0 z-50 flex w-72 overflow-y-auto bg-white p-4 shadow-2xl'
          : 'hidden'
      } flex-col lg:sticky lg:top-[calc(var(--app-chrome-height)+1rem)] lg:z-auto lg:flex lg:h-[calc(100dvh-var(--app-chrome-height)-2rem)] lg:shrink-0 lg:overflow-x-hidden lg:overflow-y-auto lg:rounded-3xl lg:border lg:border-white lg:bg-white/70 lg:p-3 lg:shadow-[0_20px_50px_-30px_rgba(8,75,56,0.45)] lg:backdrop-blur-xl motion-safe:lg:transition-[width] motion-safe:lg:duration-300 ${
        collapsed ? 'lg:w-[4.75rem]' : 'lg:w-64'
      }`}
    >
      <div
        className={`mb-2 hidden items-center justify-between gap-2 border-b border-jade/10 pb-2 lg:flex ${whenCollapsed(
          'lg:justify-center',
        )}`}
      >
        <span
          className={`px-3 text-xs font-semibold whitespace-nowrap text-ink/70 ${whenCollapsed('lg:hidden')}`}
        >
          Menu
        </span>
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="app-sidebar"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-jade/15 bg-white/80 text-forest shadow-sm transition-colors hover:border-jade/30 hover:bg-mint/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-jade/50"
        >
          {collapsed ? (
            <PanelExpandIcon className="h-6 w-6" />
          ) : (
            <PanelCollapseIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav aria-label="Main" className="flex-1">
        {sections.map((section, index) => (
          <div key={section.title} className={index > 0 ? 'mt-2 border-t border-jade/10 pt-2' : ''}>
            <p
              className={`px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap text-sage ${whenCollapsed(
                'lg:sr-only',
              )}`}
            >
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map(({ to, label, Icon, end, isActive, badge, ariaLabel }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    aria-label={ariaLabel}
                    title={collapsed ? label : undefined}
                    className={({ isActive: routeActive }) =>
                      sidebarLinkClass(isActive ? isActive(pathname) : routeActive, collapsed)
                    }
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${whenCollapsed('lg:h-6 lg:w-6')}`} />
                    <span className={`flex-1 whitespace-nowrap ${whenCollapsed('lg:sr-only')}`}>
                      {label}
                    </span>
                    {badge !== undefined && badge > 0 && (
                      <span
                        aria-hidden="true"
                        className={`min-w-[1.25rem] rounded-full bg-amber-400 px-1.5 text-center text-[11px] font-bold text-amber-950 tabular-nums ${whenCollapsed(
                          'lg:absolute lg:top-1.5 lg:right-3 lg:h-2.5 lg:w-2.5 lg:min-w-0 lg:p-0 lg:text-[0px] lg:ring-2 lg:ring-white',
                        )}`}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Your account and help: always at the foot, apart from the journey above. */}
      <nav aria-label="Settings and help" className="mt-2 border-t border-jade/10 pt-2">
        <ul className="space-y-1">
          {FOOTER_LINKS.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                title={collapsed ? label : undefined}
                className={({ isActive }) => sidebarLinkClass(isActive, collapsed)}
              >
                <Icon className={`h-5 w-5 shrink-0 ${whenCollapsed('lg:h-6 lg:w-6')}`} />
                <span className={`flex-1 whitespace-nowrap ${whenCollapsed('lg:sr-only')}`}>
                  {label}
                </span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

/**
 * The header's search box: looks for ideas, on the ideas page (`?search=`,
 * which `IdeasWorkspace` reads). Ctrl+K (⌘K on a Mac) puts the cursor in it
 * from anywhere in the app.
 */
function HeaderSearch() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = query.trim()
    navigate(term ? `/app/ideas?search=${encodeURIComponent(term)}` : '/app/ideas')
  }

  return (
    <search className="relative hidden min-w-0 flex-1 md:block md:max-w-md lg:max-w-lg">
      <form onSubmit={handleSubmit}>
        <label htmlFor="app-search" className="sr-only">
          Search ideas
        </label>
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
        <input
          ref={inputRef}
          id="app-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search ideas…"
          className="h-11 w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-20 text-sm text-white placeholder:text-white/55 focus:border-white/40 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-mint/40"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 gap-1 text-[11px] font-semibold text-white/60"
        >
          <kbd className="rounded-md border border-white/25 px-1.5 py-0.5 font-sans">Ctrl</kbd>
          <kbd className="rounded-md border border-white/25 px-1.5 py-0.5 font-sans">K</kbd>
        </span>
      </form>
    </search>
  )
}

function AppShell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const { activeOrganization } = useOrganization()
  // Offered, not granted: the queue is authorized by the server.
  const canReview = useCanReview(activeOrganization?.id ?? null)
  // Offered, not granted, like the Reviews link: every console request is
  // authorized by the server.
  const { capabilities: adminCapabilities } = useAdminCapabilities()
  const isAdmin = adminCapabilities.canAccessConsole
  // The same "the server's number, asked once" bargain as the notifications
  // bell, for the same reason: this menu renders on every authenticated page.
  const unreadThreads = useUnreadMessageThreads()
  const chromeRef = useRef<HTMLDivElement>(null)
  const chromeHeight = useElementHeight(chromeRef)
  const [menuOpen, setMenuOpen] = useState(false)

  /*
    A platform administrator works in the console, which has its own sidebar: the
    everyday menu is for the people who use the platform, so an administrator sees
    the console alone, at the full width of the window.
  */
  const showSidebar = !isAdmin
  /*
    Every page takes the whole width of the window - the menu on the left, the page
    beside it - and the header stretches with it, so their edges stay in
    line with the content on any screen.
  */
  const widthClass = 'max-w-none'

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  /*
    The menu reads as the journey, top to bottom: start at the dashboard, set up
    the people you work with (a team or organization is chosen when filing), then
    follow an idea through - shared, reviewed, turned into an automation, built -
    and end at the market, where finished ideas are sold. Numbered so where to
    begin and where it ends are plain.
  */
  const sections: SidebarSection[] = [
    {
      title: '1 · Start',
      items: [{ to: '/app', label: 'Dashboard', Icon: GridIcon, end: true }],
    },
    {
      title: '2 · Your people',
      items: [
        { to: '/app/organizations', label: 'Organizations', Icon: BuildingIcon },
        { to: '/app/teams', label: 'Teams', Icon: UsersIcon },
        {
          to: '/app/messages',
          label: 'Messages',
          Icon: ChatIcon,
          badge: unreadThreads,
          ariaLabel: unreadThreads === 0 ? 'Messages' : `Messages, ${unreadThreads} unread`,
        },
      ],
    },
    {
      title: '3 · Idea to solution',
      items: [
        { to: '/app/ideas', label: 'Ideas', Icon: BulbIcon },
        ...(canReview || adminCapabilities.canReviewPlatformSubmissions
          ? [{ to: '/app/reviews', label: 'Reviews', Icon: ChecklistIcon }]
          : []),
        {
          to: '/app/automation',
          label: 'Automation',
          Icon: FlowIcon,
          // Projects have their own entry, Implementation, right after it.
          isActive: (path) =>
            /^\/app\/automation(\/|$)/.test(path) && !/^\/app\/automation\/projects/.test(path),
        },
        { to: '/app/automation/projects', label: 'Implementation', Icon: CodeIcon },
      ],
    },
    {
      // The end of the journey, and a section of its own: buying ideas the platform
      // publishes is not part of the reader's own workspace.
      title: '4 · Market',
      items: [{ to: '/app/marketplace', label: 'Marketplace', Icon: StoreIcon }],
    },
    {
      // Beside the journey rather than a step in it: building the skills to take part.
      title: '5 · Learn',
      items: [
        { to: '/app/learn', label: 'My learning', Icon: CapIcon, end: true },
        { to: '/app/learn/courses', label: 'Course catalog', Icon: ListIcon },
      ],
    },
  ]

  function handleLogout() {
    void logout()
    navigate('/auth', { replace: true })
  }

  return (
    <div
      className="relative min-h-screen bg-slate-50"
      // Read by pages that pin their own intro under the chrome, e.g.
      // `sticky top-[var(--app-chrome-height)]` on `/app/ideas/new`.
      style={{ '--app-chrome-height': `${chromeHeight}px` } as CSSProperties}
    >
      {/* A wash of mint light behind the whole app. */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(85,230,176,0.18),transparent_45%),radial-gradient(ellipse_at_0%_100%,rgba(11,143,101,0.08),transparent_40%)]"
      />

      {/*
       * The header and the content share one centered width, so the bar's edges
       * line up with the page at any screen size.
       */}
      <div
        ref={chromeRef}
        className="sticky top-0 z-30 bg-slate-50/80 px-3 py-3 backdrop-blur-xl sm:px-4 lg:px-6"
      >
        <header
          className={`mx-auto flex ${widthClass} items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-forest via-pine to-jade px-3 py-2.5 shadow-[0_18px_40px_-20px_rgba(6,47,37,0.8)] ring-1 ring-white/10 sm:gap-4 sm:px-5`}
        >
          <div className="flex shrink-0 items-center gap-2">
            {showSidebar && (
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="app-sidebar"
                aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <CloseIcon /> : <MenuIcon />}
              </button>
            )}
            <Link
              to="/app"
              aria-label="MUSTANET home"
              className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <Logo tagline="Ideas into real solutions" />
            </Link>
          </div>

          {showSidebar && <HeaderSearch />}

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {isAdmin && (
              <nav aria-label="Main" className="flex items-center">
                <NavLink to="/app/admin" className={adminLinkClass}>
                  Admin
                </NavLink>
              </nav>
            )}
            <NotificationBell />
            <UserMenu
              user={user}
              onSignOut={handleLogout}
              showActivity={adminCapabilities.canAccessConsole}
            />
          </div>
        </header>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-forest/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div
        className={`relative mx-auto flex ${widthClass} gap-6 px-3 pb-10 pt-4 sm:px-4 lg:box-content lg:px-6`}
      >
        {showSidebar && (
          <Sidebar
            sections={sections}
            pathname={pathname}
            open={menuOpen}
            onNavigate={() => setMenuOpen(false)}
          />
        )}
        <main className="min-w-0 flex-1 pt-2">
          {/* The way back sits with the page it leaves, just above its title. */}
          <BackButton />
          {/* An administrator's home is the console. */}
          {isAdmin && pathname.replace(/\/+$/, '') === '/app' ? (
            <Navigate to="/app/admin" replace />
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
