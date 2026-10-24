import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PageErrorPage } from './PageErrorPage'

function Broken(): never {
  throw new Error('can\'t access property "length", stages is undefined')
}

describe('PageErrorPage', () => {
  it('replaces a page that fails to render with a plain way to recover', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const router = createMemoryRouter(
      [
        {
          path: '/',
          errorElement: <PageErrorPage />,
          children: [{ index: true, element: <Broken /> }],
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', { name: 'This page could not be shown.' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/app')
    expect(screen.queryByText(/stages is undefined/)).toBeNull()
  })
})
