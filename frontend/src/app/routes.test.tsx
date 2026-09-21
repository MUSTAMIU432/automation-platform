import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderRoutes } from '../test/renderWithRouter'
import { router } from './routes'

// Reuse the real route tree with an in-memory router.
describe('route tree', () => {
  it('renders the home page at /', () => {
    renderRoutes(router.routes, '/')

    expect(screen.getByText('Frontend foundation is running.')).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths, inside the layout', () => {
    renderRoutes(router.routes, '/does-not-exist')

    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })
})
