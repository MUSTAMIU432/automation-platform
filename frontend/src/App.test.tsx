import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App', () => {
  it('mounts the router and renders the home route', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Automation Platform' })).toBeInTheDocument()
  })
})
