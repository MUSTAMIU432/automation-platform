import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { READ_ONLY_ADMIN, renderAdminPage } from '../../../test/renderAdmin'
import { AssignReviewTeam } from '../components/AssignReviewTeam'
import { AdminReviewersPage } from './AdminReviewersPage'

vi.mock('../api/reviewersApi')
const api = await import('../api/reviewersApi')

const PERSON = { avatarUrl: null, lastName: 'Person' }
const LEAD = {
  ...PERSON,
  id: '1',
  email: 'lead@example.com',
  name: 'Lead Person',
  firstName: 'Lead',
}
const MEMBER = {
  ...PERSON,
  id: '2',
  email: 'member@example.com',
  name: 'Member Person',
  firstName: 'Member',
}
const TEAM = {
  id: '9',
  name: 'Platform Review A',
  isActive: true,
  leadId: '1',
  members: [
    { ...LEAD, isLead: true },
    { ...MEMBER, isLead: false },
  ],
}
const OK = { success: true, message: 'Done.', field: null }

beforeEach(() => {
  vi.mocked(api.reviewersRequest).mockResolvedValue([LEAD, MEMBER])
  vi.mocked(api.reviewTeamsRequest).mockResolvedValue([TEAM])
})

describe('AdminReviewersPage', () => {
  it('lists reviewers and teams, marking the lead', async () => {
    renderAdminPage(<AdminReviewersPage />)

    const teams = within(await screen.findByRole('list', { name: 'Review teams' }))
    expect(teams.getByText('Platform Review A')).toBeInTheDocument()
    expect(teams.getByText('PR')).toBeInTheDocument()
    expect(teams.getByText('Led by Lead Person · 2 members')).toBeInTheDocument()
    expect(teams.getByText('Active')).toBeInTheDocument()

    const members = within(screen.getByRole('list', { name: 'Platform Review A members' }))
    const [first, second] = members.getAllByRole('listitem')
    expect(within(first).getByText('Lead Person')).toBeInTheDocument()
    expect(within(first).getByText('LP')).toBeInTheDocument()
    expect(within(first).getByText('Lead')).toBeInTheDocument()
    expect(within(second).getByText('Member Person')).toBeInTheDocument()
    expect(within(second).queryByText('Lead')).not.toBeInTheDocument()
  })

  it('shows every reviewer in a table with their email, teams and lead role', async () => {
    renderAdminPage(<AdminReviewersPage />)

    const table = await screen.findByRole('table', { name: 'Reviewers' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(screen.getByText('2 reviewers')).toBeInTheDocument()

    const lead = within(rows[0])
    expect(lead.getByRole('link', { name: 'Lead Person' })).toHaveAttribute(
      'href',
      '/app/admin/users/1',
    )
    expect(lead.getByText('LP')).toBeInTheDocument()
    expect(lead.getByText('lead@example.com')).toBeInTheDocument()
    expect(lead.getByText('Platform Review A')).toBeInTheDocument()
    expect(lead.getByText('Lead')).toBeInTheDocument()

    const member = within(rows[1])
    expect(member.getByText('Platform Review A')).toBeInTheDocument()
    expect(member.queryByText('Lead')).not.toBeInTheDocument()
  })

  it('says when a reviewer is not on any team', async () => {
    vi.mocked(api.reviewTeamsRequest).mockResolvedValue([])
    renderAdminPage(<AdminReviewersPage />)

    const table = await screen.findByRole('table', { name: 'Reviewers' })
    await waitFor(() => expect(within(table).getAllByText('Not on a team')).toHaveLength(2))
  })

  it('removes a reviewer from their row', async () => {
    vi.mocked(api.revokeReviewerRequest).mockResolvedValue(OK)
    renderAdminPage(<AdminReviewersPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Member Person as reviewer' }))

    await waitFor(() => expect(api.revokeReviewerRequest).toHaveBeenCalledWith('2'))
  })

  it('makes a reviewer from an email and shows the server’s own words on a refusal', async () => {
    vi.mocked(api.grantReviewerRequest).mockResolvedValue({
      success: false,
      message: 'No account uses this email address.',
      field: 'email',
    })
    renderAdminPage(<AdminReviewersPage />)

    const form = await screen.findByRole('form', { name: 'Make a reviewer' })
    fireEvent.change(within(form).getByLabelText('Account email'), {
      target: { value: 'nobody@example.com' },
    })
    fireEvent.click(within(form).getByRole('button', { name: 'Make reviewer' }))

    await waitFor(() => expect(api.grantReviewerRequest).toHaveBeenCalledWith('nobody@example.com'))
    expect(await screen.findByText('No account uses this email address.')).toBeInTheDocument()
  })

  it('forms a team with a lead and members', async () => {
    vi.mocked(api.createReviewTeamRequest).mockResolvedValue(OK)
    renderAdminPage(<AdminReviewersPage />)

    const form = await screen.findByRole('form', { name: 'Form a review team' })
    fireEvent.change(within(form).getByLabelText('Team name'), { target: { value: 'Team B' } })
    fireEvent.change(within(form).getByLabelText('Lead'), { target: { value: '1' } })
    fireEvent.click(within(form).getByLabelText('Member Person'))
    fireEvent.click(within(form).getByRole('button', { name: 'Create team' }))

    await waitFor(() =>
      expect(api.createReviewTeamRequest).toHaveBeenCalledWith('Team B', '1', ['2']),
    )
  })

  it('retires a team', async () => {
    vi.mocked(api.updateReviewTeamRequest).mockResolvedValue(OK)
    renderAdminPage(<AdminReviewersPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Retire' }))

    await waitFor(() =>
      expect(api.updateReviewTeamRequest).toHaveBeenCalledWith('9', { isActive: false }),
    )
  })

  it('offers no forms to an administrator who cannot manage reviewers', async () => {
    renderAdminPage(<AdminReviewersPage />, { capabilities: READ_ONLY_ADMIN })

    await screen.findByRole('list', { name: 'Review teams' })
    expect(screen.queryByRole('form', { name: 'Make a reviewer' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Form a review team' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /as reviewer/ })).not.toBeInTheDocument()
  })
})

describe('AssignReviewTeam', () => {
  it('assigns an idea to an active team', async () => {
    vi.mocked(api.assignIdeaToReviewTeamRequest).mockResolvedValue(OK)
    renderAdminPage(<AssignReviewTeam ideaId="31" status="SUBMITTED" />)

    fireEvent.change(await screen.findByLabelText('Review team'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))

    await waitFor(() => expect(api.assignIdeaToReviewTeamRequest).toHaveBeenCalledWith('31', '9'))
  })

  it('is not drawn for an idea that has not reached the platform, or for someone who cannot route', () => {
    const { container } = renderAdminPage(<AssignReviewTeam ideaId="31" status="DRAFT" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('is not drawn for an administrator who cannot route work', () => {
    const { container } = renderAdminPage(<AssignReviewTeam ideaId="31" status="SUBMITTED" />, {
      capabilities: READ_ONLY_ADMIN,
    })
    expect(container).toBeEmptyDOMElement()
  })

  it('reports a refusal in the server’s words', async () => {
    vi.mocked(api.assignIdeaToReviewTeamRequest).mockResolvedValue({
      success: false,
      message: 'This idea is already being reviewed.',
      field: null,
    })
    renderAdminPage(<AssignReviewTeam ideaId="31" status="UNDER_REVIEW" />)

    fireEvent.change(await screen.findByLabelText('Review team'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }))

    expect(await screen.findByText('This idea is already being reviewed.')).toBeInTheDocument()
  })
})
