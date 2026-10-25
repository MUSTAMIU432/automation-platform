import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminOverview } from '../api/administrationApi'
import { renderAdminPage } from '../../../test/renderAdmin'
import { AdminDashboardPage } from './AdminDashboardPage'

vi.mock('../api/administrationApi', async (importOriginal) => ({
  ...(await importOriginal()),
  adminOverviewRequest: vi.fn(),
}))

vi.mock('../../identity/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      email: 'admin@example.com',
      firstName: 'Mustafa',
      lastName: 'Mustamiu',
      phoneNumber: '',
      isActive: true,
      isVerified: true,
      avatarUrl: null,
    },
  }),
}))

const { adminOverviewRequest } = await import('../api/administrationApi')
const overviewMock = vi.mocked(adminOverviewRequest)

const OVERVIEW: AdminOverview = {
  userCount: 42,
  activeUserCount: 40,
  organizationCount: 5,
  ideaCount: 17,
  ideasByStatus: [
    { status: 'DRAFT', count: 3 },
    { status: 'SUBMITTED', count: 4 },
    { status: 'UNDER_REVIEW', count: 2 },
    { status: 'CHANGES_REQUESTED', count: 1 },
    { status: 'REJECTED', count: 2 },
    { status: 'APPROVED', count: 5 },
    { status: 'AUTOMATION_PROPOSAL', count: 0 },
  ],
  openReviewCount: 2,
  completedReviewCount: 9,
  recentActivity: [
    {
      id: '1',
      ideaId: '7',
      ideaTitle: 'Automate the invoice run',
      submissionContext: 'ORGANIZATION',
      organization: { id: '3', name: 'Acme' },
      teamName: null,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'APPROVED',
      actor: { id: '9', email: 'rae@acme.example', name: 'Rae Reviewer' },
      createdAt: '2026-09-01T10:00:00Z',
    },
    {
      id: '2',
      ideaId: '8',
      ideaTitle: null,
      submissionContext: 'ORGANIZATION',
      organization: { id: '3', name: 'Acme' },
      teamName: null,
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      actor: { id: '5', email: 'ada@acme.example', name: 'Ada Author' },
      createdAt: '2026-09-01T09:00:00Z',
    },
  ],
  recentAdminActions: [
    {
      id: '11',
      action: 'USER_DEACTIVATED',
      result: 'SUCCEEDED',
      actor: { id: '1', email: 'admin@platform.example', name: 'Pat Admin' },
      targetType: 'user',
      targetId: '5',
      targetLabel: 'left@acme.example',
      organizationId: null,
      message: '',
      createdAt: '2026-09-02T09:00:00Z',
    },
  ],
}

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    overviewMock.mockReset()
  })

  it('renders the live platform numbers the server returned', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    const figures = within(await screen.findByRole('region', { name: 'Key figures' }))
    const tile = (label: string) => figures.getByText(label).parentElement
    expect(tile('Users')).toHaveTextContent('42')
    expect(tile('Users')).toHaveTextContent('40 active')
    expect(tile('Awaiting review')).toHaveTextContent('4')
    expect(tile('Approved')).toHaveTextContent('5')
    expect(tile('Changes requested')).toHaveTextContent('1')
    expect(tile('Rejected')).toHaveTextContent('2')
    expect(tile('Organizations')).toHaveTextContent('5')
  })

  it('shows who is signed in to the console', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    const account = within(screen.getByRole('region', { name: 'Signed in as' }))
    expect(account.getByText('Mustafa Mustamiu')).toBeInTheDocument()
    expect(account.getByText('admin@example.com')).toBeInTheDocument()
    expect(account.getByText('Platform administrator')).toBeInTheDocument()
    await screen.findByRole('region', { name: 'Key figures' })
  })

  it('links each status count to the filtered idea list', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    const breakdown = await screen.findByRole('list', { name: 'Ideas by status' })
    const links = within(breakdown).getAllByRole('link')
    expect(links[1]).toHaveAttribute('href', '/app/admin/ideas?status=SUBMITTED')
  })

  it('opens the matching section when a card is clicked', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    const figures = within(await screen.findByRole('region', { name: 'Key figures' }))
    const card = (label: string) => figures.getByText(label).closest('a')
    expect(card('Users')).toHaveAttribute('href', '/app/admin/users')
    expect(card('Organizations')).toHaveAttribute('href', '/app/admin/organizations')
    expect(card('Ideas')).toHaveAttribute('href', '/app/admin/ideas')
    expect(card('Reviews in progress')).toHaveAttribute('href', '/app/admin/reviews')
    expect(card('Awaiting review')).toHaveAttribute('href', '/app/admin/ideas?status=SUBMITTED')
    expect(card('Approved')).toHaveAttribute('href', '/app/admin/ideas?status=APPROVED')
    expect(card('Changes requested')).toHaveAttribute(
      'href',
      '/app/admin/ideas?status=CHANGES_REQUESTED',
    )
    expect(card('Rejected')).toHaveAttribute('href', '/app/admin/ideas?status=REJECTED')
  })

  it('leaves the recent activity to the Activity page', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    await screen.findByRole('region', { name: 'Key figures' })
    expect(screen.queryByText('Recent lifecycle activity')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent administrative actions')).not.toBeInTheDocument()
  })

  it('shows a loading state while the overview loads', () => {
    overviewMock.mockReturnValue(new Promise(() => {}))
    renderAdminPage(<AdminDashboardPage />)

    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error with a retry when the overview fails', async () => {
    overviewMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(OVERVIEW)
    renderAdminPage(<AdminDashboardPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not load the platform overview.',
    )
    screen.getByRole('button', { name: 'Try again' }).click()
    await waitFor(() => expect(overviewMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole('region', { name: 'Key figures' })).toBeInTheDocument()
  })
})
