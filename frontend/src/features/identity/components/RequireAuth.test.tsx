import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../auth/AuthContext'
import { refreshTokenRequest } from '../auth/authApi'
import { RequireAuth } from './RequireAuth'

vi.mock('../auth/authApi', () => ({
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
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

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<p>Sign-in page</p>} />
          <Route path="/app" element={<RequireAuth />}>
            <Route index element={<p>Protected content</p>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RequireAuth', () => {
  it('shows a non-committal loading state before the session check resolves', () => {
    mockedRefresh.mockReturnValue(new Promise(() => {})) // never resolves in this test

    renderProtectedRoute()

    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(screen.queryByText('Sign-in page')).not.toBeInTheDocument()
  })

  it('redirects to /auth when there is no authenticated session', async () => {
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })

    renderProtectedRoute()

    expect(await screen.findByText('Sign-in page')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders the protected content when authenticated', async () => {
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    renderProtectedRoute()

    expect(await screen.findByText('Protected content')).toBeInTheDocument()
    expect(screen.queryByText('Sign-in page')).not.toBeInTheDocument()
  })
})
