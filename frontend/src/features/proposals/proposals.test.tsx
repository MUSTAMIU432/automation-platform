import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { READ_ONLY_ADMIN, renderAdminPage } from '../../test/renderAdmin'
import { AdminProposalsPage } from '../administration/pages/AdminProposalsPage'
import type { IdeaProposal, ProposalProgress, ProposalState, SectionKey } from './api/proposalsApi'
import { IdeaProposalPanel } from './components/IdeaProposalPanel'
import { ProposalReadPage } from './components/ProposalReadPage'
import { ProtectedView } from './components/ProtectedView'

vi.mock('./api/proposalsApi', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  proposalStateRequest: vi.fn(),
  proposalProgressRequest: vi.fn(),
  recordProposalViewRequest: vi.fn(),
  startProposalRequest: vi.fn(),
  updateProposalRequest: vi.fn(),
  submitProposalRequest: vi.fn(),
  releaseProposalRequest: vi.fn(),
  requestProposalChangesRequest: vi.fn(),
  declineProposalRequest: vi.fn(),
  proposalAnswerRequest: vi.fn(async () => null),
  answerProposalRequest: vi.fn(),
  draftProposalSectionRequest: vi.fn(),
  downloadProposalPdfRequest: vi.fn(),
}))

const api = await import('./api/proposalsApi')

function proposal(overrides: Partial<IdeaProposal> = {}): IdeaProposal {
  return {
    ideaId: '3',
    ideaTitle: 'Automate hostel payments',
    teamName: 'Team A',
    title: 'Payments dashboard',
    executiveSummary: 'Stop re-typing payments.',
    problem: 'Finance re-types every payment.',
    proposedSolution: '',
    requirementsSummary: '',
    scope: 'Import, match, report.',
    deliverables: '',
    risks: '',
    assumptions: '',
    estimatedEffort: '',
    estimatedTimeline: '6 weeks',
    acceptanceCriteria: '',
    feasibility: 'Feasible: the bank exports a CSV.',
    milestones: '',
    financialRequirements: 'Hosting at 40 USD a month.',
    paymentRequired: 'no',
    paymentPlan: 'Should never show: there is no charge.',
    plannedStart: null,
    plannedEnd: null,
    status: 'released',
    reviewFeedback: '',
    startedAt: '2026-09-20T09:00:00Z',
    submittedAt: null,
    decidedAt: null,
    updatedAt: '2026-10-01T00:00:00Z',
    ...overrides,
  }
}

function progress(overrides: Partial<ProposalProgress> = {}): ProposalProgress {
  return {
    ideaId: '3',
    ideaTitle: 'Automate hostel payments',
    status: 'submitted',
    teamName: 'Team A',
    participants: [
      {
        name: 'Lena Lead',
        email: 'lead@example.com',
        role: 'lead',
        contributions: 1,
        sections: [],
        lastContributedAt: '2026-10-02T09:00:00Z',
      },
      {
        name: 'Max Member',
        email: 'member@example.com',
        role: 'member',
        contributions: 3,
        sections: ['scope', 'estimatedTimeline'],
        lastContributedAt: '2026-10-01T12:00:00Z',
      },
      {
        name: 'Quiet Quinn',
        email: 'quinn@example.com',
        role: 'member',
        contributions: 0,
        sections: [],
        lastContributedAt: null,
      },
    ],
    filledSections: ['title', 'executiveSummary', 'problem', 'scope', 'estimatedTimeline'],
    totalSections: 12,
    missingRequired: [],
    activity: [
      { name: 'Lena Lead', action: 'submitted', sections: [], at: '2026-10-02T09:00:00Z' },
      { name: 'Max Member', action: 'edited', sections: ['scope'], at: '2026-10-01T12:00:00Z' },
    ],
    proposal: proposal({ status: 'submitted' }),
    ...overrides,
  }
}

function state(overrides: Partial<ProposalState> = {}): ProposalState {
  return {
    viewerRole: 'owner',
    canStart: false,
    waitingForAdmin: false,
    canEdit: false,
    canSubmit: false,
    canDecide: false,
    proposal: proposal(),
    ...overrides,
  }
}

const RECEIPT = {
  viewerName: 'Ada Lovelace',
  viewerEmail: 'ada@example.com',
  viewedAt: '2026-10-07T09:30:00Z',
}
const OK = { success: true, message: 'Done.', field: null, proposal: null }

function readPage() {
  return render(
    <MemoryRouter initialEntries={['/app/ideas/3/proposal']}>
      <Routes>
        <Route path="/app/ideas/:ideaId/proposal" element={<ProposalReadPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(api.proposalStateRequest).mockResolvedValue(state())
  vi.mocked(api.recordProposalViewRequest).mockResolvedValue({
    success: true,
    message: 'Recorded.',
    receipt: RECEIPT,
  })
})

describe('the owner reading a released proposal', () => {
  it('shows the proposal watermarked, records the reading, and is honest about the limits', async () => {
    readPage()

    expect(await screen.findByRole('heading', { name: 'Payments dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Import, match, report.')).toBeInTheDocument()
    expect(screen.getByTestId('watermark')).toBeInTheDocument()
    expect(api.recordProposalViewRequest).toHaveBeenCalledWith('3')
    expect(screen.getByText(/A photo of the screen cannot be prevented/)).toBeInTheDocument()
  })

  it('shows the feasibility and the money, and no payment plan when there is no charge', async () => {
    readPage()

    await screen.findByRole('heading', { name: 'Payments dashboard' })
    expect(screen.getByText('Feasible: the bank exports a CSV.')).toBeInTheDocument()
    expect(screen.getByText('Hosting at 40 USD a month.')).toBeInTheDocument()
    expect(screen.getByText('No - no charge to the owner')).toBeInTheDocument()
    expect(screen.queryByText(/Should never show/)).toBeNull()
  })

  it('offers no download, print or copy, and blocks copying and the context menu', async () => {
    readPage()
    await screen.findByRole('heading', { name: 'Payments dashboard' })

    expect(screen.queryByRole('link', { name: /download/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /download|print|copy/i })).toBeNull()
    const protectedArea = document.querySelector('[data-protected="true"]') as HTMLElement
    expect(fireEvent.copy(protectedArea)).toBe(false)
    expect(fireEvent.contextMenu(protectedArea)).toBe(false)
  })

  it('asks whether to go ahead, and on what terms, and sends the answers', async () => {
    vi.mocked(api.answerProposalRequest).mockResolvedValue({
      success: false,
      message: 'Only the person who submitted this idea can give the go-ahead.',
      field: null,
    })
    readPage()

    fireEvent.click(await screen.findByLabelText('Yes, go ahead'))
    const send = screen.getByRole('button', { name: 'Give the go-ahead' })
    expect(send).toBeDisabled() // the timeline is not answered yet
    fireEvent.click(
      within(screen.getByRole('group', { name: /accept the proposed timeline/ })).getByLabelText(
        'Yes, I agree',
      ),
    )
    fireEvent.click(send)

    expect(await screen.findByRole('alert')).toHaveTextContent('Only the person')
    expect(api.answerProposalRequest).toHaveBeenCalledWith(
      expect.objectContaining({ ideaId: '3', decision: 'proceed', timeline: 'yes' }),
    )
  })

  it('asks why when the owner does not want to go ahead', async () => {
    vi.mocked(api.answerProposalRequest).mockResolvedValue({
      success: true,
      message: 'Thank you - your decision is recorded and the team has been told.',
      field: null,
    })
    readPage()

    fireEvent.click(await screen.findByLabelText('No, not now'))
    const send = screen.getByRole('button', { name: 'Send my decision' })
    expect(send).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Why not/), { target: { value: 'Too costly.' } })
    fireEvent.click(send)

    await waitFor(() =>
      expect(api.answerProposalRequest).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'decline', declineReason: 'Too costly.' }),
      ),
    )
    expect(await screen.findByText(/your decision is recorded/)).toBeInTheDocument()
  })

  it('shows the answers instead of the questions once the owner has answered', async () => {
    vi.mocked(api.proposalAnswerRequest).mockResolvedValueOnce({
      decision: 'proceed',
      timeline: 'discuss',
      payment: '',
      preferredStart: null,
      conditions: 'Avoid month end.',
      declineReason: '',
      answeredByName: 'Amina Owner',
      answeredAt: '2026-10-08T09:00:00Z',
    })
    readPage()

    expect(await screen.findByText('The owner wants to go ahead')).toBeInTheDocument()
    expect(screen.getByText('Needs discussion')).toBeInTheDocument()
    expect(screen.getByText('Avoid month end.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Yes, go ahead')).toBeNull()
  })

  it('says there is nothing to read when the proposal is not released to them', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({ proposal: proposal({ status: 'submitted' }) }),
    )
    readPage()

    expect(await screen.findByText('There is no proposal for you to read.')).toBeInTheDocument()
    expect(api.recordProposalViewRequest).not.toHaveBeenCalled()
  })

  it('does not show the proposal to anyone who is not the owner', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(state({ viewerRole: 'writer' }))
    readPage()

    expect(await screen.findByText('There is no proposal for you to read.')).toBeInTheDocument()
  })
})

describe('ProtectedView', () => {
  it('carries the reader’s name and the time', () => {
    render(
      <ProtectedView receipt={RECEIPT}>
        <p>Secret</p>
      </ProtectedView>,
    )

    const style = screen.getByTestId('watermark').getAttribute('style') ?? ''
    expect(decodeURIComponent(style)).toContain('Ada Lovelace')
    expect(decodeURIComponent(style)).toContain('ada@example.com')
  })
})

describe('IdeaProposalPanel', () => {
  const panel = () =>
    render(
      <MemoryRouter>
        <IdeaProposalPanel ideaId="3" status="APPROVED" />
      </MemoryRouter>,
    )

  it('lets the review team start the proposal', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({ viewerRole: 'writer', canStart: true, proposal: null }),
    )
    vi.mocked(api.startProposalRequest).mockResolvedValue(OK)
    panel()

    fireEvent.click(await screen.findByRole('button', { name: 'Start the proposal' }))

    await waitFor(() => expect(api.startProposalRequest).toHaveBeenCalledWith({ ideaId: '3' }))
  })

  it('tells the team to wait while the admin has not confirmed the approval', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({ viewerRole: 'writer', waitingForAdmin: true, proposal: null }),
    )
    panel()

    expect(await screen.findByText('Approved - waiting for the platform admin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Start the proposal' })).toBeNull()
  })

  it('lets any member edit, but only the lead send it to the admin', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({
        viewerRole: 'writer',
        canEdit: true,
        canSubmit: false,
        proposal: proposal({ status: 'draft' }),
      }),
    )
    panel()

    expect(await screen.findByRole('form', { name: 'Proposal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preview and send' })).toBeNull()
    expect(screen.getByText(/Only the team’s lead sends the proposal/)).toBeInTheDocument()
  })

  it('folds written sections, and opens or closes them all at once', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({
        viewerRole: 'writer',
        canEdit: true,
        proposal: proposal({ status: 'draft', feasibility: '' }),
      }),
    )
    panel()

    // An empty section is open where the writer has work to do; a written one is folded.
    expect(await screen.findByLabelText(/^Feasibility/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Executive summary/)).toBeNull()
    expect(screen.getByText(/sections written/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(screen.queryByLabelText(/^Feasibility/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(screen.getByLabelText(/^Executive summary/)).toBeInTheDocument()
  })

  it('guides each section and counts the words written in it', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({
        viewerRole: 'writer',
        canEdit: true,
        proposal: proposal({ status: 'draft', feasibility: '' }),
      }),
    )
    panel()

    const field = await screen.findByLabelText(/^Feasibility/)
    expect(field).toHaveAccessibleDescription('Whether this can be built, and what it depends on.')
    const surface = within(field.parentElement as HTMLElement)
    expect(surface.getByText('0 words')).toBeInTheDocument()

    fireEvent.change(field, { target: { value: 'It can be built.' } })
    expect(surface.getByText('4 words')).toBeInTheDocument()
  })

  describe('writing a section yourself, or generating it with AI', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      vi.mocked(api.proposalStateRequest).mockResolvedValue(
        state({
          viewerRole: 'writer',
          canEdit: true,
          proposal: proposal({ status: 'draft', feasibility: '' }),
        }),
      )
    })

    const drafted = (text: string) =>
      vi.mocked(api.draftProposalSectionRequest).mockResolvedValue({
        success: true,
        message: 'Drafted.',
        field: null,
        text,
      })

    async function generateFeasibility(instructions = '') {
      const modes = within(await screen.findByRole('group', { name: 'How to write Feasibility' }))
      fireEvent.click(modes.getByRole('button', { name: 'Generate with AI' }))
      if (instructions) {
        fireEvent.change(screen.getByLabelText(/^Instructions for the AI/), {
          target: { value: instructions },
        })
      }
      fireEvent.click(screen.getByRole('button', { name: 'Generate Feasibility with AI' }))
    }

    it('starts in Write mode, with the writer’s own field', async () => {
      panel()

      const modes = within(await screen.findByRole('group', { name: 'How to write Feasibility' }))
      expect(modes.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByLabelText(/^Feasibility/)).toBeInTheDocument()
    })

    it('shows the AI draft on its own, and uses it only when asked', async () => {
      drafted('- It can be built with the bank export.')
      panel()

      fireEvent.change(await screen.findByLabelText(/^Feasibility/), {
        target: { value: 'My own words.' },
      })
      await generateFeasibility('Be brief.')

      const card = await screen.findByRole('region', { name: 'AI draft of Feasibility' })
      expect(within(card).getByText('It can be built with the bank export.')).toBeInTheDocument()
      expect(api.draftProposalSectionRequest).toHaveBeenCalledWith(
        '3',
        'feasibility',
        expect.objectContaining({ feasibility: 'My own words.' }),
        'Be brief.',
      )
      expect(api.updateProposalRequest).not.toHaveBeenCalled() // a draft is never saved

      fireEvent.click(within(card).getByRole('button', { name: 'Replace my text with this' }))

      const field = screen.getByLabelText(/^Feasibility/) // back in Write mode
      expect(field).toHaveValue('- It can be built with the bank export.')
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
      expect(field).toHaveValue('My own words.')
    })

    it('adds the AI draft after the writer’s own text', async () => {
      drafted('Second paragraph.')
      panel()

      fireEvent.change(await screen.findByLabelText(/^Feasibility/), {
        target: { value: 'First paragraph.' },
      })
      await generateFeasibility()
      fireEvent.click(await screen.findByRole('button', { name: 'Add to my text' }))

      expect(screen.getByLabelText(/^Feasibility/)).toHaveValue(
        'First paragraph.\n\nSecond paragraph.',
      )
    })

    it('keeps the writer’s text when the draft is discarded', async () => {
      drafted('Not wanted.')
      panel()

      fireEvent.change(await screen.findByLabelText(/^Feasibility/), {
        target: { value: 'Mine.' },
      })
      await generateFeasibility()
      fireEvent.click(await screen.findByRole('button', { name: 'Discard' }))
      expect(screen.queryByRole('region', { name: 'AI draft of Feasibility' })).toBeNull()

      fireEvent.click(
        within(screen.getByRole('group', { name: 'How to write Feasibility' })).getByRole(
          'button',
          { name: 'Write' },
        ),
      )
      expect(screen.getByLabelText(/^Feasibility/)).toHaveValue('Mine.')
    })

    it('shows the AI service’s refusal and changes nothing', async () => {
      vi.mocked(api.draftProposalSectionRequest).mockResolvedValue({
        success: false,
        message: 'The AI service quota is used up for now. Please try again later.',
        field: 'feasibility',
        text: null,
      })
      panel()

      await generateFeasibility()

      expect(await screen.findByRole('alert')).toHaveTextContent('quota is used up')
      expect(screen.queryByRole('region', { name: 'AI draft of Feasibility' })).toBeNull()
    })
  })

  it('sets the planned dates in the Schedule, and flags an end before the start', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({ viewerRole: 'writer', canEdit: true, proposal: proposal({ status: 'draft' }) }),
    )
    vi.mocked(api.updateProposalRequest).mockResolvedValue(OK)
    panel()

    const schedule = within(await screen.findByRole('group', { name: 'Schedule' }))
    fireEvent.change(schedule.getByLabelText('Planned start'), { target: { value: '2026-11-02' } })
    fireEvent.change(schedule.getByLabelText('Planned end'), { target: { value: '2026-10-01' } })
    expect(
      schedule.getByText('The planned end date cannot be before the start date.'),
    ).toBeInTheDocument()

    fireEvent.change(schedule.getByLabelText('Planned end'), { target: { value: '2027-01-29' } })
    expect(schedule.queryByText(/cannot be before/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(api.updateProposalRequest).toHaveBeenCalledWith(
        '3',
        expect.objectContaining({ plannedStart: '2026-11-02', plannedEnd: '2027-01-29' }),
      ),
    )
  })

  it('asks for the payment plan only once the team says the owner pays', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({
        viewerRole: 'writer',
        canEdit: true,
        proposal: proposal({ status: 'draft', paymentRequired: '', paymentPlan: '' }),
      }),
    )
    vi.mocked(api.updateProposalRequest).mockResolvedValue(OK)
    panel()
    // Written sections start folded; open them all to read every field.
    fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }))

    // Each required section is marked with a "*" after its name.
    for (const label of [/^Feasibility\*$/, /^Requirements\*$/, /^Timeline and milestones\*$/]) {
      expect(await screen.findByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.getByLabelText(/^Financial requirements/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^Payment plan/)).toBeNull()

    fireEvent.change(screen.getByLabelText(/^Does the owner pay\?/), { target: { value: 'yes' } })
    fireEvent.change(screen.getByLabelText(/^Payment plan\*$/), {
      target: { value: 'Half on start, half on acceptance.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() =>
      expect(api.updateProposalRequest).toHaveBeenCalledWith(
        '3',
        expect.objectContaining({
          paymentRequired: 'yes',
          paymentPlan: 'Half on start, half on acceptance.',
        }),
      ),
    )
  })

  describe('the preview before sending', () => {
    // Calls only - the responses each test sets stay in place.
    beforeEach(() => vi.clearAllMocks())

    const COMPLETE = {
      status: 'draft',
      proposedSolution: 'A dashboard.',
      requirementsSummary: 'Bank export.',
      deliverables: 'Dashboard.',
      milestones: 'Weeks 1-6.',
      acceptanceCriteria: 'Finance stops re-typing.',
    } as const

    function lead(overrides: Partial<IdeaProposal> = {}) {
      vi.mocked(api.proposalStateRequest).mockResolvedValue(
        state({
          viewerRole: 'writer',
          canEdit: true,
          canSubmit: true,
          proposal: proposal({ ...COMPLETE, ...overrides }),
        }),
      )
      panel()
    }

    async function openPreview() {
      fireEvent.click(await screen.findByRole('button', { name: 'Preview and send' }))
      return within(screen.getByRole('dialog', { name: 'Payments dashboard' }))
    }

    it('shows the whole proposal, and sends it only from the preview', async () => {
      vi.mocked(api.submitProposalRequest).mockResolvedValue({
        success: true,
        message: 'Done.',
        field: null,
        proposal: null,
      })
      lead()

      const preview = await openPreview()
      expect(preview.getByText('Automate hostel payments')).toBeInTheDocument()
      expect(preview.getByText('Team A')).toBeInTheDocument()
      expect(preview.getByText('Finance stops re-typing.')).toBeInTheDocument()
      expect(api.submitProposalRequest).not.toHaveBeenCalled()

      fireEvent.click(preview.getByRole('button', { name: 'Send to the admin' }))

      await waitFor(() => expect(api.submitProposalRequest).toHaveBeenCalledWith({ ideaId: '3' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    })

    it('reports a refusal inside the preview', async () => {
      vi.mocked(api.submitProposalRequest).mockResolvedValue({
        success: false,
        message: 'Fill in the timeline before sending it.',
        field: 'estimated_timeline',
        proposal: null,
      })
      lead()

      const preview = await openPreview()
      fireEvent.click(preview.getByRole('button', { name: 'Send to the admin' }))

      expect(await preview.findByRole('alert')).toHaveTextContent('Fill in the timeline')
    })

    it('lists what is still missing and will not send it', async () => {
      lead({ acceptanceCriteria: '', deliverables: '' })

      const preview = await openPreview()

      expect(
        preview.getByText(
          '2 required sections are still to write: Deliverables, Acceptance criteria.',
        ),
      ).toBeInTheDocument()
      // Each gap is marked where the section belongs in the document.
      expect(preview.getAllByText(/^Not written yet/)).toHaveLength(2)
      expect(preview.getByRole('button', { name: 'Send to the admin' })).toBeDisabled()
    })

    it('shows unsaved changes, and saves them before sending', async () => {
      vi.mocked(api.updateProposalRequest).mockResolvedValue({
        success: true,
        message: 'Done.',
        field: null,
        proposal: null,
      })
      vi.mocked(api.submitProposalRequest).mockResolvedValue({
        success: true,
        message: 'Done.',
        field: null,
        proposal: null,
      })
      lead()

      fireEvent.change(await screen.findByLabelText(/^Risks/), {
        target: { value: '- The bank changes its export.\n- Finance is busy at year end.' },
      })
      const preview = await openPreview()

      expect(preview.getByText(/Includes unsaved changes/)).toBeInTheDocument()
      // Lines starting "- " read as a list.
      expect(preview.getByText('The bank changes its export.').tagName).toBe('LI')
      fireEvent.click(preview.getByRole('button', { name: 'Send to the admin' }))

      await waitFor(() => expect(api.submitProposalRequest).toHaveBeenCalledWith({ ideaId: '3' }))
      expect(api.updateProposalRequest).toHaveBeenCalledWith(
        '3',
        expect.objectContaining({ risks: expect.stringContaining('The bank changes') }),
      )
      expect(vi.mocked(api.updateProposalRequest).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(api.submitProposalRequest).mock.invocationCallOrder[0],
      )
    })

    it('does not send when saving the changes is refused', async () => {
      vi.mocked(api.updateProposalRequest).mockResolvedValue({
        success: false,
        message: 'Title is required.',
        field: 'title',
        proposal: null,
      })
      lead()

      fireEvent.change(await screen.findByLabelText(/^Risks/), { target: { value: 'One.' } })
      const preview = await openPreview()
      fireEvent.click(preview.getByRole('button', { name: 'Send to the admin' }))

      expect(await preview.findByRole('alert')).toHaveTextContent('Title is required.')
      expect(api.submitProposalRequest).not.toHaveBeenCalled()
    })

    it('lets any writer preview it, but only the lead send it', async () => {
      vi.mocked(api.proposalStateRequest).mockResolvedValue(
        state({
          viewerRole: 'writer',
          canEdit: true,
          canSubmit: false,
          proposal: proposal({ ...COMPLETE }),
        }),
      )
      panel()

      fireEvent.click(await screen.findByRole('button', { name: 'Preview the proposal' }))
      const preview = within(screen.getByRole('dialog', { name: 'Payments dashboard' }))

      expect(preview.getByText('Finance stops re-typing.')).toBeInTheDocument()
      expect(preview.queryByRole('button', { name: 'Send to the admin' })).toBeNull()
    })

    it('goes back to editing without sending', async () => {
      lead()

      const preview = await openPreview()
      fireEvent.click(preview.getAllByRole('button', { name: 'Back to editing' })[0])

      expect(screen.queryByRole('dialog')).toBeNull()
      expect(api.submitProposalRequest).not.toHaveBeenCalled()
    })
  })

  it('shows the admin’s feedback when the proposal was sent back', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({
        viewerRole: 'writer',
        canEdit: true,
        proposal: proposal({
          status: 'changes_requested',
          reviewFeedback: 'The timeline is too optimistic.',
        }),
      }),
    )
    panel()

    expect(await screen.findByText('The timeline is too optimistic.')).toBeInTheDocument()
  })

  it('points the owner to the reading page once released, and never shows the text here', async () => {
    panel()

    expect(await screen.findByRole('link', { name: /Read the proposal/ })).toHaveAttribute(
      'href',
      '/app/ideas/3/proposal',
    )
    expect(screen.queryByText('Import, match, report.')).toBeNull()
  })

  it('tells the owner it is being prepared before then', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(state({ proposal: null }))
    panel()

    expect(await screen.findByText(/The platform is preparing a proposal/)).toBeInTheDocument()
  })

  it('is silent for everyone else', async () => {
    vi.mocked(api.proposalStateRequest).mockResolvedValue(
      state({ viewerRole: null, proposal: null }),
    )
    const { container } = panel()

    await waitFor(() => expect(api.proposalStateRequest).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

describe('AdminProposalsPage', () => {
  beforeEach(() => {
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([progress()])
  })

  it('shows how far each proposal has got and who is taking part', async () => {
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([
      progress({
        status: 'draft',
        missingRequired: ['proposedSolution', 'acceptanceCriteria'],
        proposal: proposal({ status: 'draft' }),
      }),
    ])
    renderAdminPage(<AdminProposalsPage />)

    expect(await screen.findByText('Being written')).toBeInTheDocument()
    expect(screen.getByText('5 of 12 sections written')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Still needed before it can be sent: Proposed solution, Acceptance criteria.',
      ),
    ).toBeInTheDocument()
    const people = screen.getByRole('list', { name: 'Participants' })
    expect(people).toHaveTextContent('Lena Lead')
    expect(people).toHaveTextContent('Lead')
    expect(people).toHaveTextContent('3 contributions · Scope, Overall timeline')
    expect(people).toHaveTextContent('Has not contributed yet')

    // The cover says who did what and when; there is no separate activity list.
    const cover = screen.getByLabelText('About the proposal for Automate hostel payments')
    expect(cover).toHaveTextContent('Review teamTeam A')
    expect(cover).toHaveTextContent('LeadLena Lead')
    expect(cover).toHaveTextContent('Last updated')
    expect(cover).toHaveTextContent('· Lena Lead') // the newest activity is hers
    expect(cover).toHaveTextContent('Planned startTo be confirmed')
    expect(screen.queryByRole('list', { name: 'Recent activity' })).toBeNull()

    // Readable while it is written, but nothing to decide until the lead sends it.
    fireEvent.click(screen.getByRole('button', { name: 'Read' }))
    expect(screen.queryByRole('button', { name: 'Release to the owner' })).toBeNull()
  })

  it('shortens long section lists, keeping the whole list on hover', async () => {
    const many: SectionKey[] = ['executiveSummary', 'problem', 'feasibility', 'scope', 'risks']
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([
      progress({
        participants: [
          {
            name: 'Lena Lead',
            email: 'lena@example.com',
            role: 'lead',
            contributions: 3,
            sections: many,
            lastContributedAt: '2026-10-16T10:00:00Z',
          },
        ],
        activity: [
          { name: 'Lena Lead', action: 'edited', sections: many, at: '2026-10-16T10:00:00Z' },
        ],
        proposal: proposal({ status: 'submitted' }),
      }),
    ])
    renderAdminPage(<AdminProposalsPage />)

    const people = await screen.findByRole('list', { name: 'Participants' })
    const summary = within(people).getByText(/Executive summary, Problem, Feasibility and 2 more/)
    expect(summary).toHaveAttribute(
      'title',
      'Executive summary, Problem, Feasibility, Scope, Risks',
    )
  })

  it('shows the planned dates and how long they span on the cover', async () => {
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([
      progress({
        proposal: proposal({
          status: 'submitted',
          plannedStart: '2026-11-02',
          plannedEnd: '2027-01-29',
          submittedAt: '2026-10-16T10:00:00Z',
        }),
      }),
    ])
    renderAdminPage(<AdminProposalsPage />)

    const cover = await screen.findByLabelText('About the proposal for Automate hostel payments')
    expect(cover).toHaveTextContent('Duration12 weeks 5 days')
    expect(cover).toHaveTextContent('Sent to the admin')
    expect(cover).not.toHaveTextContent('To be confirmed')
  })

  it('shows an approved idea whose team has not started, and filters by stage', async () => {
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([
      progress(),
      progress({
        ideaId: '9',
        ideaTitle: 'Automate the rota',
        status: 'not_started',
        filledSections: [],
        activity: [],
        proposal: null,
      }),
    ])
    renderAdminPage(<AdminProposalsPage />)

    expect(await screen.findByText('Not started')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Waiting for you (1)' }))
    expect(screen.queryByText('Automate the rota')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Being prepared (1)' }))
    expect(screen.getByText('Automate the rota')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Read' })).toBeNull()
  })

  it('lets an admin download the proposal as a PDF', async () => {
    vi.mocked(api.downloadProposalPdfRequest).mockResolvedValue(undefined)
    renderAdminPage(<AdminProposalsPage />)

    fireEvent.click(
      await screen.findByRole('button', { name: /^Download the proposal .* as a PDF$/ }),
    )

    await waitFor(() => expect(api.downloadProposalPdfRequest).toHaveBeenCalledWith('3'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('says so when the PDF cannot be downloaded', async () => {
    vi.mocked(api.downloadProposalPdfRequest).mockRejectedValue(new Error('404'))
    renderAdminPage(<AdminProposalsPage />)

    fireEvent.click(await screen.findByRole('button', { name: /^Download the proposal/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not download the PDF.')
  })

  it('offers no download to an admin who cannot release proposals', async () => {
    renderAdminPage(<AdminProposalsPage />, { capabilities: READ_ONLY_ADMIN })

    await screen.findByRole('button', { name: 'Read' })
    expect(screen.queryByRole('button', { name: /^Download the proposal/ })).toBeNull()
  })

  it('lets an admin read a proposal and release it', async () => {
    vi.mocked(api.releaseProposalRequest).mockResolvedValue(OK)
    renderAdminPage(<AdminProposalsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
    expect(await screen.findByText('Import, match, report.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Release to the owner' }))

    await waitFor(() => expect(api.releaseProposalRequest).toHaveBeenCalledWith({ ideaId: '3' }))
  })

  it('sends it back with the reason typed', async () => {
    vi.mocked(api.requestProposalChangesRequest).mockResolvedValue(OK)
    renderAdminPage(<AdminProposalsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
    fireEvent.change(await screen.findByLabelText('Reason or feedback'), {
      target: { value: 'Too optimistic.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send back to the team' }))

    await waitFor(() =>
      expect(api.requestProposalChangesRequest).toHaveBeenCalledWith({
        ideaId: '3',
        feedback: 'Too optimistic.',
      }),
    )
  })

  it('shows the server’s refusal, for instance for somebody who helped write it', async () => {
    vi.mocked(api.releaseProposalRequest).mockResolvedValue({
      success: false,
      message: 'You helped write this proposal, so somebody else has to decide it.',
      field: null,
      proposal: null,
    })
    renderAdminPage(<AdminProposalsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Release to the owner' }))

    expect(await screen.findByText(/You helped write this proposal/)).toBeInTheDocument()
  })

  it('offers no decision to an administrator without the permission', async () => {
    renderAdminPage(<AdminProposalsPage />, { capabilities: READ_ONLY_ADMIN })

    fireEvent.click(await screen.findByRole('button', { name: 'Read' }))
    await screen.findByText('Import, match, report.')
    expect(screen.queryByRole('button', { name: 'Release to the owner' })).toBeNull()
  })

  it('says plainly when there is nothing to follow yet', async () => {
    vi.mocked(api.proposalProgressRequest).mockResolvedValue([])
    renderAdminPage(<AdminProposalsPage />)

    expect(await screen.findByText('No approved ideas yet.')).toBeInTheDocument()
  })
})
