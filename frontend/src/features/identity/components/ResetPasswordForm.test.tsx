import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderRoutes } from '../../../test/renderWithRouter'
import {
  ResetPasswordErrorView,
  ResetPasswordForm,
  ResetPasswordSuccessView,
} from './ResetPasswordForm'

function renderWithToken(token: string | null) {
  const path = token ? `/reset-password?token=${token}` : '/reset-password'
  return renderRoutes([{ path: '/reset-password', element: <ResetPasswordForm /> }], path)
}

describe('ResetPasswordForm', () => {
  it('shows the invalid-link state when no token is present in the URL', () => {
    renderWithToken(null)

    expect(screen.getByRole('heading', { name: 'Link invalid' })).toBeInTheDocument()
    expect(
      screen.getByText('This password reset link is invalid or has expired.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
      'href',
      '/auth',
    )
  })

  it('renders the reset password fields when a token is present', () => {
    renderWithToken('sample-token')

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    expect(screen.getByLabelText('New password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reset Password' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to Sign In/ })).toHaveAttribute('href', '/auth')
  })

  it('requires both password fields', () => {
    renderWithToken('sample-token')

    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument()
  })

  it('requires a minimum password length', () => {
    renderWithToken('sample-token')

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
  })

  it('detects a confirm-password mismatch', () => {
    renderWithToken('sample-token')

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'correct-horse' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'different-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
  })

  it('toggles password visibility independently for both fields', () => {
    renderWithToken('sample-token')

    const newPassword = screen.getByLabelText('New password') as HTMLInputElement
    const confirmPassword = screen.getByLabelText('Confirm new password') as HTMLInputElement

    fireEvent.change(newPassword, { target: { value: 'correct-horse' } })
    expect(newPassword.type).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }))

    expect(newPassword.type).toBe('text')
    expect(confirmPassword.type).toBe('password')
  })

  it('shows a loading state on submit and returns to the form afterwards', async () => {
    renderWithToken('sample-token')

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'correct-horse' },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'correct-horse' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reset Password' }))

    expect(screen.getByRole('button', { name: 'Resetting…' })).toBeDisabled()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Reset Password' })).not.toBeDisabled(),
    )
  })
})

describe('ResetPasswordSuccessView', () => {
  it('renders the success copy and a link back to sign in', () => {
    renderRoutes(
      [{ path: '/reset-password', element: <ResetPasswordSuccessView /> }],
      '/reset-password',
    )

    expect(screen.getByRole('heading', { name: 'Password reset' })).toBeInTheDocument()
    expect(screen.getByText('Your password has been reset successfully.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign In' })).toHaveAttribute('href', '/auth')
  })
})

describe('ResetPasswordErrorView', () => {
  it('renders the error copy and calls onRetry', () => {
    const onRetry = vi.fn()
    render(<ResetPasswordErrorView onRetry={onRetry} />)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledOnce()
  })
})
