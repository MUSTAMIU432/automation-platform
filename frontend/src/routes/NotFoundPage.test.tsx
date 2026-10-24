import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithRouter } from '../test/renderWithRouter'
import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('tells the user the page was not found', () => {
    renderWithRouter(<NotFoundPage />)

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the homepage' })).toHaveAttribute('href', '/')
  })
})
