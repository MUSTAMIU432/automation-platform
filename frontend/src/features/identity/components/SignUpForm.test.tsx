import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderWithProviders } from '../../../test/renderWithRouter'
import { refreshTokenRequest } from '../auth/authApi'
import { SignUpForm } from './SignUpForm'

vi.mock('../auth/authApi', () => ({
  loginRequest: vi.fn(),
  googleLoginRequest: vi.fn(),
  logoutRequest: vi.fn(),
  refreshTokenRequest: vi.fn(),
}))

const mockedRefresh = vi.mocked(refreshTokenRequest)

function fillMinimumValidFields() {
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lovelace' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Phone number' }), {
    target: { value: '712345678' },
  })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } })
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'correct-horse' },
  })
}

const TERMS_LABEL = 'I agree to the Terms of Service and Privacy Policy.'

describe('SignUpForm', () => {
  beforeEach(() => {
    // No pre-existing session: every test starts unauthenticated, not
    // redirected/pre-authenticated by the mount-time silent refresh.
    mockedRefresh.mockResolvedValue({ success: false, message: 'no session', session: null })
  })

  it('shows required-field errors when submitted empty', async () => {
    renderWithProviders(<SignUpForm onSwitchToSignIn={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText('First name is required.')).toBeInTheDocument()
    expect(screen.getByText('Last name is required.')).toBeInTheDocument()
    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Phone number is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument()
    expect(screen.getByText('You must accept the Terms and Privacy Policy.')).toBeInTheDocument()
  })

  it('detects a confirm-password mismatch', async () => {
    renderWithProviders(<SignUpForm onSwitchToSignIn={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fillMinimumValidFields()
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'different-password' },
    })
    fireEvent.click(screen.getByLabelText(TERMS_LABEL))
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('requires the terms checkbox to be accepted', async () => {
    renderWithProviders(<SignUpForm onSwitchToSignIn={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fillMinimumValidFields()
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByText('You must accept the Terms and Privacy Policy.')).toBeInTheDocument()
  })

  it('links to the Terms of Service and Privacy Policy routes', async () => {
    renderWithProviders(<SignUpForm onSwitchToSignIn={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
      'href',
      '/legal/terms',
    )
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
      'href',
      '/legal/privacy',
    )
  })

  it('shows a loading state on submit and returns to normal without exposing backend status', async () => {
    renderWithProviders(<SignUpForm onSwitchToSignIn={() => {}} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fillMinimumValidFields()
    fireEvent.click(screen.getByLabelText(TERMS_LABEL))
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))

    expect(screen.getByRole('button', { name: 'Creating account…' })).toBeDisabled()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create Account' })).not.toBeDisabled(),
    )
    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/mutation/i)).not.toBeInTheDocument()
  })

  it('calls onSwitchToSignIn when "Sign in" is clicked', async () => {
    const onSwitchToSignIn = vi.fn()
    renderWithProviders(<SignUpForm onSwitchToSignIn={onSwitchToSignIn} />)
    await waitFor(() => expect(mockedRefresh).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(onSwitchToSignIn).toHaveBeenCalledOnce()
  })
})
