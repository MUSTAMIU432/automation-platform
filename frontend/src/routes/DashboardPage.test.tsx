import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '../graphql/tokenStore'
import { AuthProvider } from '../features/identity/auth/AuthContext'
import { logoutRequest, meRequest, refreshTokenRequest } from '../features/identity/auth/authApi'
import { DashboardPage } from './DashboardPage'

vi.mock('../features/identity/auth/authApi', () => ({
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
  meRequest: vi.fn(),
}))

const mockedRefresh = vi.mocked(refreshTokenRequest)
const mockedMe = vi.mocked(meRequest)
const mockedLogout = vi.mocked(logoutRequest)

const USER = {
  id: '1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '+255712345678',
  isActive: true,
  isVerified: false,
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<p>Sign-in page</p>} />
          <Route path="/app" element={<DashboardPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setAccessToken(null)
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedMe.mockResolvedValue(USER)
    mockedLogout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    setAccessToken(null)
  })

  it('shows the signed-in user email', async () => {
    renderDashboard()

    expect(await screen.findByText(/ada@example.com/)).toBeInTheDocument()
  })

  it('signing out calls the logout API and navigates back to /auth', async () => {
    renderDashboard()
    await screen.findByText(/ada@example.com/)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(screen.getByText('Sign-in page')).toBeInTheDocument())
    expect(mockedLogout).toHaveBeenCalledOnce()
  })
})
