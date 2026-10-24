import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeIdea } from '../../../test/idea'
import { page } from '../../../test/ideaPage'
import { renderWithRouter } from '../../../test/renderWithRouter'
import { useAuth } from '../../identity/auth/AuthContext'
import { useOrganization } from '../../organizations/context/useOrganization'
import type { IdeaFilters } from '../api/ideasApi'
import { IdeasWorkspace } from './IdeasWorkspace'

vi.mock('../api/ideasApi', async (importOriginal) => ({
  ...(await importOriginal()),
  categoriesRequest: vi.fn(async () => []),
  ideasRequest: vi.fn(),
}))
vi.mock('../../identity/auth/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../organizations/context/useOrganization', () => ({ useOrganization: vi.fn() }))

const { categoriesRequest, ideasRequest } = await import('../api/ideasApi')
const listMock = vi.mocked(ideasRequest)

const IDEA = makeIdea({
  id: '42',
  title: 'Tax collection',
  description: 'Manual tax collection.',
  commentCount: 2,
  attachmentCount: 3,
  voteCount: 1,
  category: { id: '5', name: 'Finance', slug: 'finance', description: '' },
})

function lastFilters(): IdeaFilters {
  return listMock.mock.calls.at(-1)?.[0] ?? {}
}

/**
 * The Ideas page's layout: the count, the filter panel's chips, sorting, the
 * "Filters" panel, the list/grid choice and what each card shows.
 */
describe('IdeasWorkspace layout', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(useAuth).mockReturnValue({
      user: { id: '7', email: 'ada@example.com' },
    } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(useOrganization).mockReturnValue({
      activeOrganization: null,
      status: 'ready',
    } as unknown as ReturnType<typeof useOrganization>)
    vi.mocked(categoriesRequest).mockResolvedValue([
      { id: '5', name: 'Finance', slug: 'finance', description: '' },
    ])
    listMock.mockResolvedValue(page([IDEA], { totalCount: 12 }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('says how many ideas there are beside the heading', async () => {
    renderWithRouter(<IdeasWorkspace />)

    expect(await screen.findByText('12 ideas')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Put a problem forward.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Your ideas' })).toBeInTheDocument()
  })

  it('asks the server for an ordering, from the first page', async () => {
    renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')

    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'MOST_VOTED' } })

    await waitFor(() => expect(lastFilters()).toMatchObject({ sort: 'MOST_VOTED', offset: 0 }))
  })

  it('shows a filter in effect as a chip, and removing the chip removes the filter', async () => {
    renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '5' } })
    await waitFor(() => expect(lastFilters().categoryId).toBe('5'))
    fireEvent.click(await screen.findByRole('button', { name: 'Remove the category filter' }))

    await waitFor(() => expect(lastFilters().categoryId).toBeNull())
  })

  it('keeps the owner, audience and "only mine" behind Filters', async () => {
    renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')
    expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    fireEvent.click(screen.getByLabelText('Only my ideas'))

    await waitFor(() => expect(lastFilters().mine).toBe(true))
    expect(
      await screen.findByRole('button', { name: 'Remove the owner filter' }),
    ).toBeInTheDocument()
  })

  it('keeps the ordering when every filter is cleared', async () => {
    renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'OLDEST' } })
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'REJECTED' } })
    await waitFor(() => expect(lastFilters().status).toBe('REJECTED'))

    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }))

    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ sort: 'OLDEST', status: null, offset: 0 }),
    )
  })

  it("shows each idea's counts and leads to its own page", async () => {
    renderWithRouter(<IdeasWorkspace />)

    const card = within((await screen.findByText('Tax collection')).closest('li')!)
    expect(card.getByRole('button', { name: 'Discussion' })).toHaveTextContent('2')
    expect(card.getByRole('button', { name: 'Supporting evidence' })).toHaveTextContent('3')
    expect(card.getByRole('link', { name: /View details/ })).toHaveAttribute(
      'href',
      '/app/ideas/42',
    )

    fireEvent.click(card.getByRole('button', { name: 'More for Tax collection' }))
    expect(card.getByRole('menuitem', { name: 'View details' })).toHaveAttribute(
      'href',
      '/app/ideas/42',
    )
  })

  it('opens a card section from its count, one at a time', async () => {
    renderWithRouter(<IdeasWorkspace />)
    const card = within((await screen.findByText('Tax collection')).closest('li')!)

    fireEvent.click(card.getByRole('button', { name: 'Discussion' }))

    expect(card.getByRole('button', { name: 'Discussion' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(card.getByRole('button', { name: 'Supporting evidence' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('switches to a grid, and remembers the choice', async () => {
    const { unmount } = renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')

    fireEvent.click(screen.getByRole('button', { name: 'Grid' }))
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')
    unmount()

    renderWithRouter(<IdeasWorkspace />)
    await screen.findByText('Tax collection')
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('reads its filters from the address it was opened at', async () => {
    window.history.replaceState(null, '', '/')
    const { MemoryRouter } = await import('react-router-dom')
    const { render } = await import('@testing-library/react')
    render(
      <MemoryRouter initialEntries={['/app/ideas?status=APPROVED&sort=OLDEST&search=tax']}>
        <IdeasWorkspace />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(lastFilters()).toMatchObject({ status: 'APPROVED', sort: 'OLDEST', search: 'tax' }),
    )
    expect(screen.getByLabelText('Sort by')).toHaveValue('OLDEST')
  })

  it('offers Edit idea in the card menu only when the server allows it', async () => {
    listMock.mockResolvedValue(
      page([IDEA, makeIdea({ id: '43', title: 'My draft', viewerCanEdit: true })]),
    )
    renderWithRouter(<IdeasWorkspace />)

    const locked = within((await screen.findByText('Tax collection')).closest('li')!)
    fireEvent.click(locked.getByRole('button', { name: 'More for Tax collection' }))
    expect(locked.queryByRole('menuitem', { name: 'Edit idea' })).not.toBeInTheDocument()

    const draft = within(screen.getByText('My draft').closest('li')!)
    fireEvent.click(draft.getByRole('button', { name: 'More for My draft' }))
    fireEvent.click(draft.getByRole('menuitem', { name: 'Edit idea' }))
    expect(await screen.findByRole('dialog', { name: 'Edit your draft' })).toBeInTheDocument()
  })
})
