import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '../graphql/tokenStore'
import { AuthProvider } from '../features/identity/auth/AuthContext'
import {
  createOrganizationRequest,
  organizationsRequest,
} from '../features/organizations/api/organizationApi'
import { logoutRequest, meRequest, refreshTokenRequest } from '../features/identity/auth/authApi'
import { viewerCanReviewInRequest } from '../features/reviews/api/reviewsApi'
import { dashboardCountsRequest } from '../features/dashboard/api/dashboardApi'
import { AppLayout } from '../layouts/AppLayout'
import { useOrganization } from '../features/organizations/context/useOrganization'
import { DashboardPage } from './DashboardPage'

vi.mock('../features/organizations/api/organizationApi', () => ({
  organizationsRequest: vi.fn(),
  createOrganizationRequest: vi.fn(),
}))

vi.mock('../features/ideas/api/ideasApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ideasRequest: () =>
    Promise.resolve({
      items: [],
      pageInfo: {
        offset: 0,
        limit: 5,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    }),
}))
vi.mock('../features/dashboard/api/dashboardApi', () => ({
  dashboardCountsRequest: vi.fn(),
}))
vi.mock('../features/reviews/api/reviewsApi', () => ({
  viewerCanReviewInRequest: vi.fn(),
}))

vi.mock('../features/identity/auth/authApi', () => ({
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
  meRequest: vi.fn(),
}))

const mockedRefresh = vi.mocked(refreshTokenRequest)
const mockedMe = vi.mocked(meRequest)
const mockedLogout = vi.mocked(logoutRequest)
const mockedOrganizations = vi.mocked(organizationsRequest)
const mockedCreateOrganization = vi.mocked(createOrganizationRequest)
const mockedCanReview = vi.mocked(viewerCanReviewInRequest)
const mockedCounts = vi.mocked(dashboardCountsRequest)

const COUNTS = { ideas: 14, reviewQueue: 3, myIdeasInReview: 2, opportunities: 1, projects: 5 }

const USER = {
  id: '1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '+255712345678',
  isActive: true,
  isVerified: false,
}

const ORGANIZATION = {
  id: '10',
  name: 'Acme Labs',
  slug: 'acme-labs',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const OWNER_ROLE = {
  id: '30',
  name: 'Owner',
  slug: 'owner',
  description: 'Owner role',
  isSystem: true,
  createdAt: ORGANIZATION.createdAt,
  updatedAt: ORGANIZATION.updatedAt,
  organization: ORGANIZATION,
  permissions: [
    {
      id: '40',
      code: 'organization.view',
      name: 'View organization',
      description: 'View the organization.',
      createdAt: ORGANIZATION.createdAt,
      updatedAt: ORGANIZATION.updatedAt,
    },
  ],
}

const MEMBERSHIP = {
  organization: ORGANIZATION,
  membership: {
    id: '20',
    status: 'active' as const,
    createdAt: ORGANIZATION.createdAt,
    updatedAt: ORGANIZATION.updatedAt,
    user: USER,
    organization: ORGANIZATION,
    roles: [OWNER_ROLE],
  },
}

/** Stands in for a real app page: shows which organization the layout hands it. */
function OrganizationProbe({ label }: { label: string }) {
  const { activeOrganization } = useOrganization()
  return (
    <p>
      {label} for {activeOrganization?.name ?? 'none'}
    </p>
  )
}

function renderDashboard(path: string | { pathname: string; state?: unknown } = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<p>Sign-in page</p>} />
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="ideas" element={<OrganizationProbe label="Ideas page" />} />
            <Route path="ideas/new" element={<OrganizationProbe label="New idea page" />} />
            <Route path="reviews" element={<OrganizationProbe label="Reviews page" />} />
            <Route path="ideas/:ideaId" element={<p>Idea page</p>} />
            <Route path="ideas/:ideaId/proposal" element={<p>Proposal page</p>} />
            <Route path="automation/workspace/:projectId" element={<p>Workspace page</p>} />
            <Route path="teams/:teamId" element={<p>Team page</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setAccessToken(null)
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: {
        accessToken: 'token',
        accessTokenExpiresAt: '2099-01-01',
        user: USER,
      },
    })
    mockedMe.mockResolvedValue(USER)
    mockedCanReview.mockResolvedValue(false)
    mockedCounts.mockResolvedValue(COUNTS)
    mockedLogout.mockResolvedValue(undefined)
    mockedOrganizations.mockResolvedValue([MEMBERSHIP])
    mockedCreateOrganization.mockResolvedValue({
      success: true,
      message: 'Organization created successfully.',
      field: null,
      organization: ORGANIZATION,
      membership: {
        id: '20',
        status: 'active',
        createdAt: ORGANIZATION.createdAt,
        updatedAt: ORGANIZATION.updatedAt,
        user: USER,
        organization: ORGANIZATION,
        roles: [OWNER_ROLE],
      },
    })
  })

  afterEach(() => {
    setAccessToken(null)
  })

  it('shows the brand logo, without the user email', async () => {
    renderDashboard()

    expect(await screen.findByRole('link', { name: 'MUSTANET home' })).toHaveAttribute(
      'href',
      '/app',
    )
    expect(screen.queryByText(/ada@example.com/)).not.toBeInTheDocument()
  })

  it('signing out calls the logout API and navigates back to /auth', async () => {
    renderDashboard()
    await screen.findByText('Welcome back, Ada')

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => expect(screen.getByText('Sign-in page')).toBeInTheDocument())
    expect(mockedLogout).toHaveBeenCalledOnce()
  })

  it('links to the ideas area from the navigation and the dashboard', async () => {
    renderDashboard()
    await screen.findByText('Welcome back, Ada')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/app')
    expect(within(nav).getByRole('link', { name: 'Ideas' })).toHaveAttribute('href', '/app/ideas')
    expect(await screen.findByRole('link', { name: /Existing ideas/ })).toHaveAttribute(
      'href',
      '/app/ideas',
    )
  })

  it('offers the review queue only to reviewers', async () => {
    mockedCanReview.mockResolvedValue(true)
    renderDashboard()

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(await within(nav).findByRole('link', { name: 'Reviews' })).toHaveAttribute(
      'href',
      '/app/reviews',
    )
    expect(await screen.findByRole('link', { name: /Pending review/ })).toHaveAttribute(
      'href',
      '/app/reviews',
    )
  })

  it('hides the review queue from non-reviewers', async () => {
    renderDashboard()
    await screen.findByRole('link', { name: /Existing ideas/ })
    await waitFor(() => expect(mockedCanReview).toHaveBeenCalledWith('10'))

    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument()
    // The card is always there; for somebody who cannot review it is about their own
    // ideas in review, and it says plainly that they are not a reviewer.
    expect(await screen.findByText(/You are not a reviewer in Acme Labs yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Pending review/ })).toHaveAttribute(
      'href',
      '/app/ideas',
    )
    expect(await screen.findByText('of your ideas in review')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Existing ideas/ })).toHaveAttribute(
      'href',
      '/app/ideas',
    )
  })

  it('leads each dashboard card to a real page', async () => {
    renderDashboard()
    await screen.findByText('Welcome back, Ada')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Ideas & opportunities' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Approved ideas/ })).toHaveAttribute(
      'href',
      '/app/automation/opportunities',
    )
    expect(screen.getByRole('link', { name: /Follow implementation/ })).toHaveAttribute(
      'href',
      '/app/automation/projects',
    )
    expect(screen.getByRole('heading', { name: 'From idea to implementation' })).toBeInTheDocument()
  })

  it("shows each card's count for the active organization", async () => {
    renderDashboard()
    // Asked again once the switcher's organization is known; read the cards after that.
    await waitFor(() => expect(mockedCounts).toHaveBeenLastCalledWith('10'))

    const card = (name: RegExp) => within(screen.getByRole('link', { name }))
    await waitFor(() => expect(card(/Existing ideas/).getByText('14')).toBeInTheDocument())
    expect(card(/Existing ideas/).getByText('ideas you can read')).toBeInTheDocument()
    expect(card(/Approved ideas/).getByText('1')).toBeInTheDocument()
    expect(card(/Approved ideas/).getByText('approved idea')).toBeInTheDocument()
    expect(card(/Follow implementation/).getByText('5')).toBeInTheDocument()
    expect(card(/Follow implementation/).getByText('projects underway')).toBeInTheDocument()
  })

  it('shows a reviewer what is waiting for them', async () => {
    mockedCanReview.mockResolvedValue(true)
    renderDashboard()

    const pending = await screen.findByRole('link', { name: /Pending review/ })
    await waitFor(() => expect(pending).toHaveAttribute('href', '/app/reviews'))
    expect(await within(pending).findByText('3')).toBeInTheDocument()
    expect(within(pending).getByText('waiting for you')).toBeInTheDocument()
  })

  it('says a count is unavailable rather than showing a zero', async () => {
    mockedCounts.mockRejectedValue(new TypeError('Failed to fetch'))
    renderDashboard()

    expect(await screen.findAllByText('Count unavailable right now')).toHaveLength(4)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('offers a back arrow from app sub-pages only, with no breadcrumb trail', async () => {
    renderDashboard()
    await screen.findByText('Welcome back, Ada')
    expect(screen.queryByRole('link', { name: /^Back to / })).not.toBeInTheDocument()

    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'Ideas' }),
    )
    const back = await screen.findByRole('link', { name: 'Back to home' })
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument()

    fireEvent.click(back)
    expect(await screen.findByText('Welcome back, Ada')).toBeInTheDocument()
  })

  it('leads from the new-idea page back to the ideas list', async () => {
    renderDashboard('/app/ideas/new')

    // One step up, not home.
    const back = await screen.findByRole('link', { name: 'Back to ideas' })
    expect(back).toHaveAttribute('href', '/app/ideas')

    fireEvent.click(back)
    expect(await screen.findByText(/^Ideas page/)).toBeInTheDocument()
  })

  it('leads back to where the reader came from when the page was opened as a detour', async () => {
    renderDashboard({
      pathname: '/app/ideas/4',
      state: {
        returnTo: {
          path: '/app/automation/workspace/9?tab=overview',
          label: 'Back to your workspace',
        },
      },
    })

    const back = await screen.findByRole('link', { name: 'Back to your workspace' })
    expect(back).toHaveAttribute('href', '/app/automation/workspace/9?tab=overview')

    fireEvent.click(back)
    expect(await screen.findByText('Workspace page')).toBeInTheDocument()
  })

  it('ignores a way back that leads off the platform, and goes up to Ideas instead', async () => {
    renderDashboard({
      pathname: '/app/ideas/4',
      state: { returnTo: { path: 'https://evil.example/phish', label: 'Back to your workspace' } },
    })

    expect(await screen.findByRole('link', { name: 'Back to ideas' })).toHaveAttribute(
      'href',
      '/app/ideas',
    )
    expect(screen.queryByRole('link', { name: /evil|Back to your workspace/i })).toBeNull()
  })

  it("leads from an idea's proposal back to that idea", async () => {
    renderDashboard('/app/ideas/4/proposal')

    expect(await screen.findByRole('link', { name: 'Back to idea' })).toHaveAttribute(
      'href',
      '/app/ideas/4',
    )
  })

  it('leads from an idea back to Ideas, however the idea was opened', async () => {
    renderDashboard('/app/ideas/4')

    fireEvent.click(await screen.findByRole('link', { name: 'Back to ideas' }))
    expect(await screen.findByText(/^Ideas page/)).toBeInTheDocument()
  })

  it('leads from a team back to Teams', async () => {
    renderDashboard('/app/teams/3')

    expect(await screen.findByRole('link', { name: 'Back to teams' })).toHaveAttribute(
      'href',
      '/app/teams',
    )
  })

  it('collapses the sidebar to a rail of icons, keeps its links named, and remembers it', async () => {
    window.localStorage.removeItem('collapse:app.sidebar')
    renderDashboard()
    await screen.findByText('Welcome back, Ada')
    const sidebar = document.getElementById('app-sidebar') as HTMLElement

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar).toHaveAttribute('data-collapsed', 'true')
    const main = within(screen.getByRole('navigation', { name: 'Main' }))
    expect(main.getByRole('link', { name: 'Ideas' })).toHaveAttribute('title', 'Ideas')
    expect(window.localStorage.getItem('collapse:app.sidebar')).toBe('closed')

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(sidebar).toHaveAttribute('data-collapsed', 'false')
    window.localStorage.removeItem('collapse:app.sidebar')
  })

  it('shows the account menu from the avatar, and closes it on Escape', async () => {
    renderDashboard()
    await screen.findByText('Welcome back, Ada')

    const avatar = screen.getByRole('button', { name: 'Account menu' })
    expect(avatar).toHaveTextContent('AL')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(avatar)
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(avatar).toHaveAttribute('aria-expanded', 'true')
    expect(within(menu).getByText('Ada Lovelace')).toBeInTheDocument()
    expect(within(menu).getByText('ada@example.com')).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Profile' })).toHaveFocus()
    expect(within(menu).getByRole('menuitem', { name: 'Security' })).toHaveAttribute(
      'href',
      '/app/settings/security',
    )
    expect(within(menu).getByRole('menuitem', { name: 'Change password' })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(avatar).toHaveFocus()
  })
})
