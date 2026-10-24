import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { readReturnTo, useReturnHere } from './returnTo'

describe('readReturnTo', () => {
  it('reads a way back this app made', () => {
    expect(
      readReturnTo({ returnTo: { path: '/app/automation/workspace/9', label: 'Back' } }),
    ).toEqual({ path: '/app/automation/workspace/9', label: 'Back', state: undefined })
  })

  it.each([
    null,
    'text',
    {},
    { returnTo: null },
    { returnTo: { path: '/app/x' } },
    { returnTo: { path: 'https://evil.example', label: 'Back' } },
    { returnTo: { path: '//evil.example/app', label: 'Back' } },
    { returnTo: { path: '/auth', label: 'Back' } },
  ])('refuses anything else: %o', (state) => {
    expect(readReturnTo(state)).toBeNull()
  })
})

/** Shows the way back the current page was opened with. */
function Destination() {
  const back = readReturnTo(useLocation().state)
  return (
    <p>
      {back ? `${back.label} -> ${back.path}` : 'no way back'}
      {back && (
        <Link to={back.path} state={back.state}>
          go back
        </Link>
      )}
    </p>
  )
}

function Origin({ label }: { label: string }) {
  const returnHere = useReturnHere()
  const back = readReturnTo(useLocation().state)
  return (
    <>
      <p>{back ? `origin remembers: ${back.label}` : 'origin has no way back'}</p>
      <Link to="/app/next" state={returnHere(label)}>
        open
      </Link>
    </>
  )
}

describe('useReturnHere', () => {
  it('sends the reader back here, and back here restores this page’s own way back', () => {
    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: '/app/automation/opportunities/7',
            search: '?tab=proposal',
            state: {
              returnTo: { path: '/app/automation/workspace/9', label: 'Back to your workspace' },
            },
          },
        ]}
      >
        <Routes>
          <Route
            path="/app/automation/opportunities/7"
            element={<Origin label="Back to the opportunity" />}
          />
          <Route path="/app/next" element={<Destination />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('link', { name: 'open' }))
    expect(
      screen.getByText('Back to the opportunity -> /app/automation/opportunities/7?tab=proposal'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: 'go back' }))
    expect(screen.getByText('origin remembers: Back to your workspace')).toBeInTheDocument()
  })
})
