import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderRoutes } from '../test/renderWithRouter'
import { RootLayout } from './RootLayout'

describe('RootLayout', () => {
  it('renders the shell header and the matched child route in the outlet', () => {
    renderRoutes([
      {
        path: '/',
        element: <RootLayout />,
        children: [{ index: true, element: <p>child content</p> }],
      },
    ])

    expect(screen.getByRole('banner')).toHaveTextContent('Automation Platform')
    expect(screen.getByRole('main')).toHaveTextContent('child content')
  })
})
