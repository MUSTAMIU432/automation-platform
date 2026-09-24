import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../../../test/renderWithRouter'
import { loginRequest, refreshTokenRequest } from '../auth/authApi'
import { SignInForm } from './SignInForm'

vi.mock('../auth/authApi', () => ({
  loginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
}))

const mockedLogin = vi.mocked(loginRequest)
const mockedRefresh = vi.mocked(refreshTokenRequest)

describe('SignInForm', () => {
  beforeEach(() => {
    // No pre-existing session: every test starts from the sign-in form,
    // not redirected/pre-authenticated by the mount-time silent refresh.
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })
  })

  it('shows required-field errors when submitted empty', async () => {
    renderWithProviders(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(mockedLogin).not.toHaveBeenCalled()
  })

  it('validates email format', async () => {
    renderWithProviders(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('calls onSwitchToSignUp when "Create account" is clicked', async () => {
    const onSwitchToSignUp = vi.fn()
    renderWithProviders(
      <SignInForm onSwitchToSignUp={onSwitchToSignUp} onForgotPassword={() => {}} />,
    )
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(onSwitchToSignUp).toHaveBeenCalledOnce()
  })

  it('shows a "Forgot password?" link that calls onForgotPassword when clicked', async () => {
    const onForgotPassword = vi.fn()
    renderWithProviders(
      <SignInForm onSwitchToSignUp={() => {}} onForgotPassword={onForgotPassword} />,
    )
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    const link = screen.getByRole('button', { name: 'Forgot password?' })
    expect(link).toBeInTheDocument()

    fireEvent.click(link)

    expect(onForgotPassword).toHaveBeenCalledOnce()
  })

  it('submits valid credentials and shows a loading state', async () => {
    let resolveLogin: (value: Awaited<ReturnType<typeof loginRequest>>) => void = () => {}
    mockedLogin.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )

    renderWithProviders(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'a-strong-unique-pass-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled()
    expect(mockedLogin).toHaveBeenCalledWith('ada@example.com', 'a-strong-unique-pass-1')

    resolveLogin({ success: false, message: 'Invalid email or password.', session: null })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled())
  })

  it('shows the generic auth error message on invalid credentials, without navigating', async () => {
    mockedLogin.mockResolvedValue({
      success: false,
      message: 'Invalid email or password.',
      session: null,
    })

    renderWithProviders(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    // Still on the sign-in form - a failed login must not be treated as one.
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
  })

  it('clears the auth error once the user edits a field again', async () => {
    mockedLogin.mockResolvedValue({
      success: false,
      message: 'Invalid email or password.',
      session: null,
    })

    renderWithProviders(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'trying-again-1' } })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
