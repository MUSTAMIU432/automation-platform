import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ForgotPasswordForm } from './ForgotPasswordForm'

describe('ForgotPasswordForm', () => {
  it('renders the email field and submit button', () => {
    render(<ForgotPasswordForm onBackToSignIn={() => {}} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send reset link' })).toBeInTheDocument()
  })

  it('requires an email', () => {
    render(<ForgotPasswordForm onBackToSignIn={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
  })

  it('validates the email format', () => {
    render(<ForgotPasswordForm onBackToSignIn={() => {}} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('shows a loading state, then the generic "Check your email" state', async () => {
    render(<ForgotPasswordForm onBackToSignIn={() => {}} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(
      screen.getByText(
        "If an account exists for that email, we've sent instructions to reset your password.",
      ),
    ).toBeInTheDocument()
  })

  it('calls onBackToSignIn from the form view', () => {
    const onBackToSignIn = vi.fn()
    render(<ForgotPasswordForm onBackToSignIn={onBackToSignIn} />)

    fireEvent.click(screen.getByRole('button', { name: /Back to Sign In/ }))

    expect(onBackToSignIn).toHaveBeenCalledOnce()
  })

  it('calls onBackToSignIn from the success view', async () => {
    const onBackToSignIn = vi.fn()
    render(<ForgotPasswordForm onBackToSignIn={onBackToSignIn} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back to Sign In' }))

    expect(onBackToSignIn).toHaveBeenCalledOnce()
  })
})
