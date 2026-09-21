import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NotFoundPage } from './NotFoundPage'

describe('NotFoundPage', () => {
  it('tells the user the page was not found', () => {
    render(<NotFoundPage />)

    expect(screen.getByRole('heading', { level: 1, name: '404' })).toBeInTheDocument()
    expect(screen.getByText('Page not found.')).toBeInTheDocument()
  })
})
