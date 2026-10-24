import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { opportunityForIdeaRequest, traceabilityRequest } from '../../automation/api/automationApi'
import { ProposalPageNav } from './ProposalPageNav'

vi.mock('../../automation/api/automationApi', () => ({
  opportunityForIdeaRequest: vi.fn(),
  traceabilityRequest: vi.fn(),
}))

function renderNav() {
  render(
    <MemoryRouter initialEntries={['/app/ideas/4/proposal']}>
      <ProposalPageNav ideaId="4" />
    </MemoryRouter>,
  )
}

describe('ProposalPageNav', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('leads back to the idea, and offers no next step before delivery has started', async () => {
    vi.mocked(opportunityForIdeaRequest).mockResolvedValue(null)
    vi.mocked(traceabilityRequest).mockResolvedValue(null as never)
    renderNav()

    expect(screen.getByRole('link', { name: /Back to the idea/ })).toHaveAttribute(
      'href',
      '/app/ideas/4',
    )
    await vi.waitFor(() => expect(opportunityForIdeaRequest).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: /Automation delivery/ })).not.toBeInTheDocument()
  })

  it('goes on to the project once there is one, else to the opportunity', async () => {
    vi.mocked(opportunityForIdeaRequest).mockResolvedValue({ id: '7' } as never)
    vi.mocked(traceabilityRequest).mockResolvedValue({ projectId: '12' } as never)
    renderNav()

    expect(await screen.findByRole('link', { name: /Next: Automation delivery/ })).toHaveAttribute(
      'href',
      '/app/automation/projects/12',
    )
  })
})
