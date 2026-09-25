import { act, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getAccessToken, setAccessToken } from '../../../graphql/tokenStore'
import { AuthProvider, useAuth } from './AuthContext'
import {
  googleLoginRequest,
  loginRequest,
  logoutRequest,
  meRequest,
  refreshTokenRequest,
} from './authApi'

vi.mock('./authApi', () => ({
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
  meRequest: vi.fn(),
}))

const mockedLogin = vi.mocked(loginRequest)
const mockedGoogleLogin = vi.mocked(googleLoginRequest)
const mockedLogout = vi.mocked(logoutRequest)
const mockedMe = vi.mocked(meRequest)
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

function TestConsumer() {
  const { status, user, login, loginWithGoogle, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="email">{user?.email ?? 'none'}</p>
      <button onClick={() => login('ada@example.com', 'a-strong-unique-pass-1')}>Login</button>
      <button onClick={() => loginWithGoogle('a-google-credential')}>Google Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setAccessToken(null)
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })
    mockedMe.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
    setAccessToken(null)
  })

  it('starts in the loading status while the initial refresh attempt is in flight', () => {
    let resolveRefresh: (value: Awaited<ReturnType<typeof refreshTokenRequest>>) => void = () => {}
    mockedRefresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve
      }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    resolveRefresh({ success: false, message: 'no session', session: null })
  })

  it('becomes unauthenticated when there is no valid refresh session on load', async () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('none')
  })

  it('becomes authenticated when a valid refresh cookie exists on load', async () => {
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'refreshed-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedMe.mockResolvedValue(USER)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com')
    expect(getAccessToken()).toBe('refreshed-token')
  })

  it('authenticates from an existing access token when me succeeds', async () => {
    setAccessToken('existing-token')
    mockedMe.mockResolvedValue(USER)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com')
    expect(getAccessToken()).toBe('existing-token')
    expect(mockedMe).toHaveBeenCalledOnce()
    expect(mockedRefresh).not.toHaveBeenCalled()
  })

  it('refreshes an expired access token once and confirms the new token with me', async () => {
    setAccessToken('expired-token')
    mockedMe.mockResolvedValueOnce(null).mockResolvedValueOnce(USER)
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'refreshed-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(getAccessToken()).toBe('refreshed-token')
    expect(mockedMe).toHaveBeenCalledTimes(2)
    expect(mockedRefresh).toHaveBeenCalledOnce()
  })

  it('does not refresh again when the refreshed token cannot be confirmed', async () => {
    setAccessToken('expired-token')
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'unusable-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    expect(mockedMe).toHaveBeenCalledTimes(2)
    expect(mockedRefresh).toHaveBeenCalledOnce()
    expect(getAccessToken()).toBeNull()
  })

  it('does not start duplicate bootstrap requests in StrictMode', async () => {
    mockedRefresh.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'strict-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedMe.mockResolvedValue(USER)

    render(
      <StrictMode>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(mockedRefresh).toHaveBeenCalledOnce()
    expect(mockedMe).toHaveBeenCalledOnce()
  })

  it('does not let a completed login get overwritten by an earlier bootstrap', async () => {
    let resolveRefresh: (value: Awaited<ReturnType<typeof refreshTokenRequest>>) => void = () => {}
    mockedRefresh.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve
      }),
    )
    mockedLogin.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'login-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('loading')

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(getAccessToken()).toBe('login-token')

    resolveRefresh({ success: false, message: 'no session', session: null })
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(getAccessToken()).toBe('login-token')
  })

  it('login success updates status, user, and the shared access token', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      message: 'Signed in successfully.',
      session: { accessToken: 'login-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com')
    expect(getAccessToken()).toBe('login-token')
  })

  it('never writes the access token (or anything else) to localStorage on login', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'login-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)

    setItemSpy.mockRestore()
  })

  it('login failure leaves the user unauthenticated and clears the token', async () => {
    mockedLogin.mockResolvedValue({
      success: false,
      message: 'Invalid email or password.',
      session: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(getAccessToken()).toBeNull()
  })

  it('google login success updates status, user, and the shared access token', async () => {
    mockedGoogleLogin.mockResolvedValue({
      success: true,
      message: 'Signed in successfully.',
      session: { accessToken: 'google-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Google Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('email')).toHaveTextContent('ada@example.com')
    expect(getAccessToken()).toBe('google-token')
    expect(mockedGoogleLogin).toHaveBeenCalledWith('a-google-credential')
  })

  it('google login never writes the access token (or anything else) to localStorage', async () => {
    mockedGoogleLogin.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'google-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Google Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(setItemSpy).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)

    setItemSpy.mockRestore()
  })

  it('google login failure leaves the user unauthenticated and clears the token', async () => {
    mockedGoogleLogin.mockResolvedValue({
      success: false,
      message: 'Could not sign in with Google.',
      session: null,
    })

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))

    await act(async () => {
      screen.getByRole('button', { name: 'Google Login' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(getAccessToken()).toBeNull()
  })

  it('logout clears status, user, and the shared access token', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'login-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedLogout.mockResolvedValue(undefined)

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('email')).toHaveTextContent('none')
    expect(getAccessToken()).toBeNull()
    expect(mockedLogout).toHaveBeenCalledOnce()
  })

  it('clears local authentication state while logout is still pending', async () => {
    setAccessToken('token')
    mockedMe.mockResolvedValue(USER)
    let resolveLogout: () => void = () => {}
    mockedLogout.mockReturnValue(
      new Promise((resolve) => {
        resolveLogout = resolve
      }),
    )

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))

    act(() => {
      screen.getByRole('button', { name: 'Logout' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(getAccessToken()).toBeNull()
    expect(mockedLogout).toHaveBeenCalledOnce()

    resolveLogout()
  })

  it('logout still clears local state even if the network call fails', async () => {
    mockedLogin.mockResolvedValue({
      success: true,
      message: 'ok',
      session: { accessToken: 'login-token', accessTokenExpiresAt: '2099-01-01', user: USER },
    })
    mockedLogout.mockImplementation(() => Promise.reject(new Error('network error')))

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'))
    await act(async () => {
      screen.getByRole('button', { name: 'Login' }).click()
    })

    await act(async () => {
      screen.getByRole('button', { name: 'Logout' }).click()
    })

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(getAccessToken()).toBeNull()
  })

  it('throws when useAuth is used outside an AuthProvider', () => {
    function Bare() {
      useAuth()
      return null
    }

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider')
    consoleError.mockRestore()
  })
})
