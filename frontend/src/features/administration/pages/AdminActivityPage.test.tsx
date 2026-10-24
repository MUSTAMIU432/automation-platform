import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AdminAuditEntry, AdminOverview } from '../api/administrationApi'
import { renderAdminPage } from '../../../test/renderAdmin'
import { AdminActivityPage } from './AdminActivityPage'

vi.mock('../api/administrationApi', async (importOriginal) => ({
  ...(await importOriginal()),
  adminOverviewRequest: vi.fn(),
}))

const { adminOverviewRequest } = await import('../api/administrationApi')
const overviewMock = vi.mocked(adminOverviewRequest)

const ADMIN = { id: '1', email: 'admin@platform.example', name: 'Pat Admin' }

function action(
  id: string,
  entry: Pick<AdminAuditEntry, 'action' | 'targetType' | 'targetId' | 'targetLabel'> &
    Partial<AdminAuditEntry>,
): AdminAuditEntry {
  return {
    id,
    result: 'SUCCEEDED',
    actor: ADMIN,
    organizationId: null,
    message: '',
    createdAt: '2026-09-02T09:00:00Z',
    ...entry,
  }
}

const OVERVIEW: AdminOverview = {
  userCount: 3,
  activeUserCount: 3,
  organizationCount: 1,
  ideaCount: 2,
  ideasByStatus: [],
  openReviewCount: 0,
  completedReviewCount: 0,
  recentActivity: [
    {
      id: '1',
      ideaId: '7',
      ideaTitle: 'Tax collection',
      submissionContext: 'INDIVIDUAL',
      organization: null,
      teamName: null,
      fromStatus: 'UNDER_REVIEW',
      toStatus: 'APPROVED',
      actor: { id: '9', email: 'helper@example.com', name: 'Helper Test' },
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
    action('11', {
      action: 'DECISION_LETTER_SENT',
      targetType: 'idea',
      targetId: '7',
      targetLabel: 'Tax collection',
    }),
    action('12', {
      action: 'REVIEW_TEAM_CREATED',
      targetType: 'review_team',
      targetId: '2',
      targetLabel: 'Team1',
    }),
    action('13', {
      action: 'USER_DEACTIVATED',
      targetType: 'user',
      targetId: '5',
      targetLabel: 'left@acme.example',
    }),
    action('14', {
      action: 'MEMBERSHIP_ROLE_ASSIGNED',
      targetType: 'membership',
      targetId: '40',
      targetLabel: 'ada@acme.example',
      organizationId: '3',
    }),
    action('15', {
      action: 'CATEGORY_CREATED',
      targetType: 'category',
      targetId: '6',
      targetLabel: 'Finance',
    }),
    action('16', {
      action: 'ATTACHMENT_DOWNLOADED',
      targetType: 'attachment',
      targetId: '90',
      targetLabel: 'invoice.pdf',
    }),
  ],
}

describe('AdminActivityPage', () => {
  beforeEach(() => {
    overviewMock.mockReset()
  })

  it('opens the idea from a lifecycle move, withholding a restricted title', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminActivityPage />)

    const moves = within(await screen.findByRole('list', { name: 'Recent lifecycle activity' }))
    expect(moves.getByText('Tax collection').closest('a')).toHaveAttribute(
      'href',
      '/app/admin/ideas/7',
    )
    expect(moves.getByText('Restricted idea').closest('a')).toHaveAttribute(
      'href',
      '/app/admin/ideas/8',
    )
  })

  it('names each administrative action and opens what it was done to', async () => {
    overviewMock.mockResolvedValue(OVERVIEW)
    renderAdminPage(<AdminActivityPage />)

    const actions = within(
      await screen.findByRole('list', { name: 'Recent administrative actions' }),
    )
    const row = (label: string) => actions.getByText(label).closest('a')
    expect(row('Decision letter sent')).toHaveAttribute('href', '/app/admin/ideas/7')
    expect(row('Review team created')).toHaveAttribute('href', '/app/admin/reviewers')
    expect(row('Account deactivated')).toHaveAttribute('href', '/app/admin/users/5')
    expect(row('Organization role assigned')).toHaveAttribute('href', '/app/admin/organizations/3')
    expect(row('Category created')).toHaveAttribute('href', '/app/admin/categories')
    // A download is a record of a read: there is nothing to open.
    expect(row('Evidence downloaded')).toBeNull()
    expect(actions.queryByText('DECISION_LETTER_SENT')).not.toBeInTheDocument()
  })

  it('says so when nothing has happened yet', async () => {
    overviewMock.mockResolvedValue({ ...OVERVIEW, recentActivity: [], recentAdminActions: [] })
    renderAdminPage(<AdminActivityPage />)

    expect(await screen.findByText('No lifecycle activity yet.')).toBeInTheDocument()
    expect(screen.getByText('No administrative actions yet.')).toBeInTheDocument()
  })
})
