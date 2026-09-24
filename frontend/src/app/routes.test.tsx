import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { refreshTokenRequest } from '../features/identity/auth/authApi'
import { renderRoutes } from '../test/renderWithRouter'
import { router } from './routes'

vi.mock('../features/identity/auth/authApi', () => ({
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
}))

const mockedRefresh = vi.mocked(refreshTokenRequest)

const USER = {
  id: '1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '+255712345678',
  isActive: true,
  isVerified: false,
}

// Reuse the real route tree with an in-memory router.
describe('route tree', () => {
  beforeEach(() => {
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })
  })

  it('renders the home page at /', () => {
    renderRoutes(router.routes, '/')

    expect(screen.getByText('Frontend foundation is running.')).toBeInTheDocument()
  })

  it('renders the not-found page for unknown paths, inside the layout', () => {
    renderRoutes(router.routes, '/does-not-exist')

    expect(screen.getByText('Page not found.')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders the auth page at /auth, defaulting to sign in', () => {
    renderRoutes(router.routes, '/auth')

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument()
  })

  it('renders the reset password page at /reset-password', () => {
    renderRoutes(router.routes, '/reset-password?token=sample-token')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeInTheDocument()
  })

  it('redirects /app to /auth when there is no authenticated session', async () => {
    renderRoutes(router.routes, '/app')

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument(),
    )
  })

  it('renders the dashboard at /app when authenticated', async () => {
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    renderRoutes(router.routes, '/app')

    expect(await screen.findByText(/ada@example.com/)).toBeInTheDocument()
  })
})
