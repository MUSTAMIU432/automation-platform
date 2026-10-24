import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeApprovedIdea, makeIdea } from '../../../test/idea'
import { useAuth } from '../../identity/auth/AuthContext'
import { IdeaDetailPage } from './IdeaDetailPage'

vi.mock('../../ideas/api/ideasApi', async (importOriginal) => ({
  ...(await importOriginal()),
  ideaRequest: vi.fn(),
}))
vi.mock('../../identity/auth/AuthContext', () => ({ useAuth: vi.fn() }))
// The two panels are stubbed at the *hook* rather than at the component, so
// their real code - headings, empty states - is still rendered and asserted
// against. `importOriginal` keeps the modules' constants, which the components
// read for their limits.
vi.mock('../../ideas/hooks/useComments', async (importOriginal) => ({
  ...(await importOriginal()),
  useComments: () => ({
    comments: [],
    loading: false,
    error: null,
    reload: vi.fn(),
    post: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    // The composer's own error slot, which the component reads unconditionally.
    writeError: null,
    clearWriteError: vi.fn(),
  }),
}))
vi.mock('../../ideas/hooks/useAttachments', async (importOriginal) => ({
  ...(await importOriginal()),
  useAttachments: () => ({
    attachments: [],
    loading: false,
    error: null,
    reload: vi.fn(),
    upload: vi.fn(),
    remove: vi.fn(),
    // The uploader's own error slot, read unconditionally by the component.
    writeError: null,
    clearWriteError: vi.fn(),
  }),
}))
vi.mock('../../reviews/api/reviewsApi', () => ({
  ideaReviewsRequest: vi.fn(async () => []),
}))
vi.mock('../../notifications/hooks/useNotifications', () => ({
  useUnreadNotifications: () => 0,
}))
vi.mock('../../messaging/hooks/useMessages', () => ({
  useUnreadMessageThreads: () => 0,
}))

const { ideaRequest } = await import('../../ideas/api/ideasApi')

function renderPage(ideaId = '1') {
  return render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/app/ideas/:ideaId', element: <IdeaDetailPage /> }], {
        initialEntries: [`/app/ideas/${ideaId}`],
      })}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAuth).mockReturnValue({
    user: { id: '7', email: 'ada@example.com' },
  } as unknown as ReturnType<typeof useAuth>)
})

/**
 * The page's job is to answer four questions before anything else: what is this,
 * **who owns it**, who created it, and where is it. Each test below asks one of
 * them, because a page that answered three of the four would pass a test that
 * checked one.
 */
describe('IdeaDetailPage', () => {
  it('says who owns it and who can see it, as two separate facts', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        title: 'Automate the invoice run',
        submissionContext: 'ORGANIZATION',
        organizationId: '3',
        tenantName: 'MUNA',
        visibility: 'ORGANIZATION',
      }),
    )
    renderPage()

    expect(
      await screen.findByRole('heading', { name: 'Automate the invoice run' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Owned by')).toBeInTheDocument()
    expect(screen.getByText('MUNA')).toBeInTheDocument()
    expect(screen.getByText('Organization only')).toBeInTheDocument()
    expect(screen.getByText('Organization Idea')).toBeInTheDocument()
  })

  it('keeps the owner visible when the audience is the whole platform', async () => {
    // The case that must never collapse: public audience, organization owner.
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        submissionContext: 'ORGANIZATION',
        organizationId: '3',
        tenantName: 'MUNA',
        visibility: 'PUBLIC',
      }),
    )
    renderPage()

    expect(await screen.findByText('MUNA')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
  })

  it('says an individual idea is the reader’s own', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        submissionContext: 'INDIVIDUAL',
        authorId: '7',
        visibility: 'PRIVATE',
      }),
    )
    renderPage()

    expect(await screen.findByText('Individual Idea')).toBeInTheDocument()
    expect(screen.getByText('Owned by')).toBeInTheDocument()
    expect(screen.getAllByText('you').length).toBeGreaterThan(0)
    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('says when an idea belongs to somebody else', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        submissionContext: 'INDIVIDUAL',
        authorId: '8',
        visibility: 'PUBLIC',
      }),
    )
    renderPage()

    expect(await screen.findByText('the person who filed it')).toBeInTheDocument()
    expect(screen.getByText('Another member of this platform')).toBeInTheDocument()
  })

  it('offers Edit only when the server says this viewer may edit', async () => {
    // Author-only, from `viewerCanEdit` - the field the backend computes by
    // running `updateIdea`'s own checks.
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({ authorId: '7', status: 'DRAFT', viewerCanEdit: true }),
    )
    renderPage()

    expect(await screen.findByRole('link', { name: 'Edit draft' })).toHaveAttribute(
      'href',
      '/app/ideas/1/edit',
    )
  })

  it('offers no Edit when the server says this viewer may not', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({ authorId: '8', status: 'DRAFT', viewerCanEdit: false }),
    )
    renderPage()

    await screen.findByRole('heading', { name: /Automate/ })
    expect(screen.queryByRole('link', { name: 'Edit draft' })).not.toBeInTheDocument()
  })

  it('labels a resubmission as a revision, not an edit', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        authorId: '7',
        status: 'CHANGES_REQUESTED',
        viewerCanEdit: true,
      }),
    )
    renderPage()

    // The header's button, and step 1 of the response panel: both open the same form.
    const links = await screen.findAllByRole('link', { name: 'Revise idea' })
    expect(links.length).toBeGreaterThanOrEqual(1)
    for (const link of links) expect(link).toHaveAttribute('href', expect.stringMatching(/\/edit$/))
  })

  it('says an unavailable idea without choosing between the two reasons', async () => {
    // `null` is the server's answer for "may not read" and for "does not exist",
    // and this page must not guess which - an id must not reveal what exists.
    vi.mocked(ideaRequest).mockResolvedValue(null)
    renderPage()

    expect(
      await screen.findByText(/It may not exist, or it may not be one you are allowed to read/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to your ideas' })).toHaveAttribute(
      'href',
      '/app/ideas',
    )
  })

  it('reports a failed load as a failure and offers a retry', async () => {
    vi.mocked(ideaRequest).mockRejectedValue(new Error('offline'))
    renderPage()

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument()

    vi.mocked(ideaRequest).mockResolvedValue(makeApprovedIdea({ title: 'Second try' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Second try' })).toBeInTheDocument()
  })

  it('shows the lifecycle position, with what the state means', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({
        status: 'UNDER_REVIEW',
        state: { ...makeIdea().state, label: 'Under review' },
      }),
    )
    renderPage()

    // The state in the header, and what it means in the journey beneath it.
    expect(await screen.findByRole('region', { name: "Your idea's journey" })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('Under review').length).toBeGreaterThan(0))
  })

  it('keeps the review report and the link to the idea in its menu', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({ id: '1', title: 'Automate the invoice run' }),
    )
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'More about this idea' }))

    expect(screen.getByRole('menuitem', { name: 'Review report' })).toHaveAttribute(
      'href',
      '/app/ideas/1/report',
    )
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toBeInTheDocument()
  })

  it('says how far along the way the idea has come', async () => {
    const idea = makeIdea({
      id: '1',
      title: 'Automate the invoice run',
      status: 'UNDER_REVIEW',
      submissionContext: 'INDIVIDUAL',
    })
    vi.mocked(ideaRequest).mockResolvedValue({
      ...idea,
      state: { ...idea.state, stageIndex: 2, stageCount: 4 },
    })
    renderPage()

    expect(await screen.findByText('Stage 2 of 4')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: "Your idea's journey" })).toHaveTextContent(
      'Under review (where it is now)',
    )
  })

  it('shows the journey and the project details, not the discussion or the review', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({ id: '1', title: 'Automate the invoice run', status: 'SUBMITTED' }),
    )
    renderPage()

    expect(await screen.findByRole('region', { name: "Your idea's journey" })).toBeInTheDocument()
    const details = screen.getByRole('region', { name: 'Project details' })
    expect(details).toHaveTextContent('Decision letter — sent to you when the review team decides.')
    expect(details).toHaveTextContent('Automation delivery — starts once you give your go-ahead.')
    expect(screen.queryByLabelText('Add a comment')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Evidence/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /Review history/ })).not.toBeInTheDocument()
  })

  it('offers the evidence while changes are requested, for the answer', async () => {
    vi.mocked(ideaRequest).mockResolvedValue(
      makeIdea({ id: '1', title: 'Automate the invoice run', status: 'CHANGES_REQUESTED' }),
    )
    renderPage()

    expect(
      await screen.findByRole('region', { name: 'Evidence & attachments' }),
    ).toBeInTheDocument()
  })
})
