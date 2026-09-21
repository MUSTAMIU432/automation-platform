import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HomePage } from './HomePage'

describe('HomePage', () => {
  it('renders the platform heading and foundation status', () => {
    render(<HomePage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Automation Platform' })).toBeInTheDocument()
    expect(screen.getByText('Frontend foundation is running.')).toBeInTheDocument()
  })
})
