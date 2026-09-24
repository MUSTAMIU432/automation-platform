import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SignInForm } from './SignInForm'

describe('SignInForm', () => {
  it('shows required-field errors when submitted empty', () => {
    render(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Email is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })

  it('validates email format', () => {
    render(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={() => {}} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument()
  })

  it('calls onSwitchToSignUp when "Create account" is clicked', () => {
    const onSwitchToSignUp = vi.fn()
    render(<SignInForm onSwitchToSignUp={onSwitchToSignUp} onForgotPassword={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(onSwitchToSignUp).toHaveBeenCalledOnce()
  })

  it('shows a "Forgot password?" link that calls onForgotPassword when clicked', () => {
    const onForgotPassword = vi.fn()
    render(<SignInForm onSwitchToSignUp={() => {}} onForgotPassword={onForgotPassword} />)

    const link = screen.getByRole('button', { name: 'Forgot password?' })
    expect(link).toBeInTheDocument()

    fireEvent.click(link)

    expect(onForgotPassword).toHaveBeenCalledOnce()
  })
})
