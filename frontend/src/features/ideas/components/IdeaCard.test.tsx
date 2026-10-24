import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as automation from '../../automation/api/automationApi'
import { useAuth } from '../../identity/auth/AuthContext'
import { makeIdea } from '../../../test/idea'
import type { Idea } from '../api/ideasApi'
import { IdeaCard } from './IdeaCard'

vi.mock('../../automation/api/automationApi')
vi.mock('../../identity/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const mocked = vi.mocked(automation)

function opportunity(overrides: Partial<automation.Opportunity> = {}): automation.Opportunity {
  return {
    id: '7',
    ideaId: '3',
    ideaTitle: 'Automate hostel payments',
    title: 'Automate hostel payments',
    summary: 'A payments register.',
    problemStatement: '',
    automationGoal: '',
    expectedBenefit: '',
    priority: 'high',
    status: 'ready_for_assignment',
    submissionContext: 'organization',
    ownerName: 'Ada Lovelace',
    tenantName: 'MUNA',
    approvedAt: null,
    readyAt: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    capabilities: { canManageRequirements: true, canEditSolution: false, canTransition: false },
    ...overrides,
  }
}

function renderCard(idea: Idea) {
  return render(
    <MemoryRouter>
      <ul>
        <IdeaCard
          idea={idea}
          layout="list"
          viewerId="7"
          highlighted={false}
          vote={{ voteCount: 0, viewerHasVoted: false, pending: false, error: null }}
          onToggleVote={vi.fn()}
          onDismissVoteError={vi.fn()}
          openSection={null}
          onToggleSection={vi.fn()}
          onEdit={vi.fn()}
          onTransition={vi.fn()}
          submittingIdeaId={null}
          submittingTarget={null}
        />
      </ul>
    </MemoryRouter>,
  )
}

const ready = () =>
  makeIdea({ id: '3', title: 'Hostel payments', status: 'READY_FOR_IMPLEMENTATION' })

describe('IdeaCard menu - Edit opportunity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ user: { id: '7' } } as unknown as ReturnType<
      typeof useAuth
    >)
  })

  it('opens the opportunity form as a pop-up and saves it', async () => {
    mocked.opportunityForIdeaRequest.mockResolvedValue(opportunity())
    mocked.updateOpportunity.mockResolvedValue({
      success: true,
      message: '',
      field: null,
      opportunity: opportunity({ title: 'Hostel payments register' }),
    })
    renderCard(ready())

    fireEvent.click(screen.getByRole('button', { name: 'More for Hostel payments' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit opportunity' }))
    expect(mocked.opportunityForIdeaRequest).toHaveBeenCalledWith('3')

    const dialog = screen.getByRole('dialog')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    const name = within(dialog).getByLabelText('Opportunity name')
    expect(name).toHaveValue('Automate hostel payments')
    fireEvent.change(name, { target: { value: 'Hostel payments register' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocked.updateOpportunity).toHaveBeenCalledWith({
      input: {
        id: '7',
        title: 'Hostel payments register',
        summary: 'A payments register.',
        priority: 'high',
      },
    })
    expect(screen.getByText('Opportunity saved')).toBeInTheDocument()
  })

  it('keeps the pop-up open with the server message when the save is refused', async () => {
    mocked.opportunityForIdeaRequest.mockResolvedValue(opportunity())
    mocked.updateOpportunity.mockResolvedValue({
      success: false,
      message: 'Give the opportunity a name.',
      field: 'title',
      opportunity: null,
    })
    renderCard(ready())

    fireEvent.click(screen.getByRole('button', { name: 'More for Hostel payments' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit opportunity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Give the opportunity a name.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('closes on Cancel without saving', async () => {
    mocked.opportunityForIdeaRequest.mockResolvedValue(opportunity())
    renderCard(ready())

    fireEvent.click(screen.getByRole('button', { name: 'More for Hostel payments' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Edit opportunity' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocked.updateOpportunity).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the viewer may not manage it',
      opportunity({
        capabilities: {
          canManageRequirements: false,
          canEditSolution: false,
          canTransition: false,
        },
      }),
    ],
    ['it is closed', opportunity({ status: 'completed' })],
    ['the viewer cannot see it', null],
  ])('does not offer it when %s', async (_, found) => {
    mocked.opportunityForIdeaRequest.mockResolvedValue(found)
    renderCard(ready())

    fireEvent.click(screen.getByRole('button', { name: 'More for Hostel payments' }))
    await waitFor(() => expect(mocked.opportunityForIdeaRequest).toHaveBeenCalled())
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Edit opportunity' })).not.toBeInTheDocument()
  })

  it('does not ask for an opportunity before the idea is in delivery', () => {
    renderCard(makeIdea({ id: '3', title: 'Hostel payments', status: 'APPROVED' }))

    fireEvent.click(screen.getByRole('button', { name: 'More for Hostel payments' }))
    expect(screen.queryByRole('menuitem', { name: 'Edit opportunity' })).not.toBeInTheDocument()
    expect(mocked.opportunityForIdeaRequest).not.toHaveBeenCalled()
  })
})
