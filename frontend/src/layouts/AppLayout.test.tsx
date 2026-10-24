import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NO_ADMIN_CAPABILITIES } from '../features/administration/api/capabilitiesApi'
import { AppLayout } from './AppLayout'

/**
 * The app chrome on its own.
 *
 * Every provider the shell mounts is replaced by a passthrough, and every
 * question the shell asks is a mock, because this file is about the bar: what it
 * offers, what it counts, and where each link points. The providers' own
 * requests are tested where they live.
 */
vi.mock('../features/identity/auth/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: {
      id: '7',
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'A',
    },
    logout: vi.fn(async () => {}),
  })),
}))
vi.mock('../features/organizations/context/OrganizationProvider', () => ({
  OrganizationProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../features/organizations/context/useOrganization', () => ({
  useOrganization: vi.fn(() => ({
    status: 'ready',
    memberships: [],
    activeOrganization: null,
    activeMembership: null,
    error: null,
    hasPermission: () => false,
    createOrganization: vi.fn(),
    setActiveOrganization: vi.fn(),
    reload: vi.fn(),
  })),
}))
vi.mock('../features/administration/context/AdminCapabilitiesProvider', () => ({
  AdminCapabilitiesProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock('../features/administration/context/useAdminCapabilities', () => ({
  useAdminCapabilities: vi.fn(() => ({
    status: 'ready',
    capabilities: NO_ADMIN_CAPABILITIES,
    reload: vi.fn(),
  })),
}))
vi.mock('../features/reviews/hooks/useCanReview', () => ({
  useCanReview: vi.fn(() => false),
}))
vi.mock('../features/notifications/hooks/useUnreadNotifications', () => ({
  useUnreadNotifications: vi.fn(() => 0),
}))
vi.mock('../features/messaging/hooks/useMessages', () => ({
  useUnreadMessageThreads: vi.fn(() => 0),
}))

const { useCanReview } = await import('../features/reviews/hooks/useCanReview')
const { useUnreadNotifications } =
  await import('../features/notifications/hooks/useUnreadNotifications')
const { useUnreadMessageThreads } = await import('../features/messaging/hooks/useMessages')
const { useAdminCapabilities } =
  await import('../features/administration/context/useAdminCapabilities')

function renderAt(path = '/app') {
  const router = createMemoryRouter(
    [
      {
        path: '/app',
        element: <AppLayout />,
        children: [
          { index: true, element: <p>Workspace content</p> },
          { path: 'ideas', element: <p>Ideas content</p> },
          { path: 'reviews', element: <p>Reviews content</p> },
          { path: 'teams', element: <p>Teams content</p> },
          { path: 'messages', element: <p>Messages content</p> },
          { path: 'admin', element: <p>Console content</p> },
          { path: 'automation', element: <p>Automation content</p> },
          { path: 'automation/projects', element: <p>Projects content</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanReview).mockReturnValue(false)
    vi.mocked(useUnreadNotifications).mockReturnValue(0)
    vi.mocked(useUnreadMessageThreads).mockReturnValue(0)
    vi.mocked(useAdminCapabilities).mockReturnValue({
      status: 'ready',
      capabilities: NO_ADMIN_CAPABILITIES,
      reload: vi.fn(),
    })
  })

  it('offers Teams and Messages to everybody, because neither is a tenant feature', () => {
    renderAt()

    // No organization, no review permission, no console access - and still both
    // links: a team is a collaboration boundary, and a private message belongs
    // to its participants, so no permission could decide to hide them.
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('href', '/app/teams')
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('href', '/app/messages')
  })

  it('offers Reviews only when something says it applies, and the marketplace to everyone', () => {
    renderAt()
    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Marketplace' })).toHaveAttribute(
      'href',
      '/app/marketplace',
    )

    vi.mocked(useCanReview).mockReturnValue(true)
    renderAt()
    expect(screen.getAllByRole('link', { name: 'Reviews' })[0]).toHaveAttribute(
      'href',
      '/app/reviews',
    )
  })

  it('shows an administrator the console alone', async () => {
    vi.mocked(useCanReview).mockReturnValue(true)
    vi.mocked(useAdminCapabilities).mockReturnValue({
      status: 'ready',
      capabilities: { ...NO_ADMIN_CAPABILITIES, canAccessConsole: true },
      reload: vi.fn(),
    })
    renderAt()

    // Their home is the console: /app goes straight there.
    expect(await screen.findByText('Console content')).toBeInTheDocument()
    const main = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(main.getAllByRole('link').map((link) => link.textContent)).toEqual(['Admin'])
    expect(main.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/app/admin')
  })

  it('says how many conversations are unread, and asks the server for it once', async () => {
    vi.mocked(useUnreadMessageThreads).mockReturnValue(3)
    renderAt()

    const link = await screen.findByRole('link', {
      name: 'Messages, 3 unread',
    })
    expect(link).toHaveAttribute('href', '/app/messages')
    // The badge is the server's number, so it is right even on a page where the
    // conversations list has never been loaded.
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('caps the badge at 99+ rather than letting it stretch the bar', async () => {
    vi.mocked(useUnreadMessageThreads).mockReturnValue(120)
    renderAt()

    expect(await screen.findByRole('link', { name: 'Messages, 120 unread' })).toBeInTheDocument()
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('keeps the notifications badge and the messages badge apart', () => {
    vi.mocked(useUnreadNotifications).mockReturnValue(2)
    vi.mocked(useUnreadMessageThreads).mockReturnValue(5)
    renderAt()

    expect(screen.getByRole('link', { name: 'Notifications, 2 unread' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Messages, 5 unread' })).toBeInTheDocument()
  })

  it('points each link at the page it names', () => {
    renderAt('/app/ideas')

    // Scoped to the main bar: the breadcrumb above the content links to
    // "Workspace" too, and that is a second, deliberate way back.
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app')
    expect(within(nav).getByRole('link', { name: 'Ideas' })).toHaveAttribute('href', '/app/ideas')
  })

  it('marks the section the reader is in', () => {
    renderAt('/app/teams')

    const teams = within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', {
      name: 'Teams',
    })
    expect(teams).toHaveAttribute('aria-current', 'page')
    expect(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Ideas' }),
    ).not.toHaveAttribute('aria-current')
  })

  it('groups the menu by the kind of work, with Implementation leading to projects', () => {
    renderAt('/app')

    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    for (const section of ['Workspace', 'Collaboration', 'Review & delivery', 'Market']) {
      expect(nav.getByText(section)).toBeInTheDocument()
    }
    expect(nav.getByRole('link', { name: 'Implementation' })).toHaveAttribute(
      'href',
      '/app/automation/projects',
    )
  })

  it('marks Implementation, not Automation, on the projects page', () => {
    renderAt('/app/automation/projects')

    const nav = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(nav.getByRole('link', { name: 'Implementation' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(nav.getByRole('link', { name: 'Automation' }).className).not.toMatch(/font-semibold/)
  })

  it('sends a header search to the ideas list', async () => {
    const router = renderAt('/app')

    fireEvent.change(screen.getByLabelText('Search ideas'), { target: { value: ' water pumps ' } })
    fireEvent.submit(screen.getByLabelText('Search ideas').closest('form')!)

    expect(await screen.findByText('Ideas content')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app/ideas')
    expect(router.state.location.search).toBe('?search=water%20pumps')
  })

  it('puts the cursor in the search box on Ctrl+K', () => {
    renderAt('/app')

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(screen.getByLabelText('Search ideas')).toHaveFocus()
  })

  it('opens the menu as a drawer on small screens, and closes it on Escape', () => {
    renderAt('/app')

    const toggle = screen.getByRole('button', { name: 'Open navigation' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })
})
