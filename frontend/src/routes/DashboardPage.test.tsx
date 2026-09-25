import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setAccessToken } from '../graphql/tokenStore'
import { AuthProvider } from '../features/identity/auth/AuthContext'
import { OrganizationProvider } from '../features/organizations/context/OrganizationProvider'
import {
  createOrganizationRequest,
  organizationsRequest,
} from '../features/organizations/api/organizationApi'
import { logoutRequest, meRequest, refreshTokenRequest } from '../features/identity/auth/authApi'
import { DashboardPage } from './DashboardPage'

vi.mock('../features/organizations/api/organizationApi', () => ({
  organizationsRequest: vi.fn(),
  createOrganizationRequest: vi.fn(),
}))

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
const mockedOrganizations = vi.mocked(organizationsRequest)
const mockedCreateOrganization = vi.mocked(createOrganizationRequest)

const USER = {
  id: '1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '+255712345678',
  isActive: true,
  isVerified: false,
}

const ORGANIZATION = {
  id: '10',
  name: 'Acme Labs',
  slug: 'acme-labs',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const OWNER_ROLE = {
  id: '30',
  name: 'Owner',
  slug: 'owner',
  description: 'Owner role',
  isSystem: true,
  createdAt: ORGANIZATION.createdAt,
  updatedAt: ORGANIZATION.updatedAt,
  organization: ORGANIZATION,
  permissions: [
    {
      id: '40',
      code: 'organization.view',
      name: 'View organization',
      description: 'View the organization.',
      createdAt: ORGANIZATION.createdAt,
      updatedAt: ORGANIZATION.updatedAt,
    },
  ],
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <AuthProvider>
        <OrganizationProvider>
          <Routes>
            <Route path="/auth" element={<p>Sign-in page</p>} />
            <Route path="/app" element={<DashboardPage />} />
          </Routes>
        </OrganizationProvider>
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
    mockedOrganizations.mockResolvedValue([
      {
        organization: ORGANIZATION,
        membership: {
          id: '20',
          status: 'active',
          createdAt: ORGANIZATION.createdAt,
          updatedAt: ORGANIZATION.updatedAt,
          user: USER,
          organization: ORGANIZATION,
          roles: [OWNER_ROLE],
        },
      },
    ])
    mockedCreateOrganization.mockResolvedValue({
      success: true,
      message: 'Organization created successfully.',
      field: null,
      organization: ORGANIZATION,
      membership: {
        id: '20',
        status: 'active',
        createdAt: ORGANIZATION.createdAt,
        updatedAt: ORGANIZATION.updatedAt,
        user: USER,
        organization: ORGANIZATION,
        roles: [OWNER_ROLE],
      },
    })
  })

  afterEach(() => {
    setAccessToken(null)
  })

  it('shows the signed-in user email and current organization role', async () => {
    renderDashboard()

    expect(await screen.findByText(/ada@example.com/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Acme Labs/ })).toHaveTextContent('Owner')
  })

  it('signing out calls the logout API and navigates back to /auth', async () => {
    renderDashboard()
    await screen.findByText(/ada@example.com/)

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))

    await waitFor(() => expect(screen.getByText('Sign-in page')).toBeInTheDocument())
    expect(mockedLogout).toHaveBeenCalledOnce()
  })
})
