import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { renderWithRouter } from '../../../test/renderWithRouter'
import { AuthPage } from './AuthPage'

describe('AuthPage', () => {
  it('renders with sign in as the default mode', () => {
    renderWithRouter(<AuthPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'false')
  })

  it('renders a Google button ready for future OAuth integration', () => {
    renderWithRouter(<AuthPage />)

    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  it('does not expose internal implementation status to the user', () => {
    renderWithRouter(<AuthPage />)

    expect(screen.queryByText(/backend/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/mutation/i)).not.toBeInTheDocument()
  })

  it('switches to sign up via the tab and shows the registration fields', () => {
    renderWithRouter(<AuthPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('First name')).toBeInTheDocument()
    expect(screen.getByLabelText('Last name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Country code')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Phone number' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(
      screen.getByLabelText('I agree to the Terms of Service and Privacy Policy.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  it('switches from sign up back to sign in via the "Sign in" link', () => {
    renderWithRouter(<AuthPage />)

    fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
  })

  it('switches from sign in to sign up via the "Create account" link', () => {
    renderWithRouter(<AuthPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Sign Up' })).toHaveAttribute('aria-selected', 'true')
  })

  describe('forgot password', () => {
    it('replaces the tabs and sign in form with the forgot-password form in place, not a popup', () => {
      renderWithRouter(<AuthPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))

      expect(
        screen.getByRole('heading', { level: 1, name: 'Reset your password' }),
      ).toBeInTheDocument()
      // No modal/dialog and no leftover Sign In tabs — this is a view swap
      // within the same card, exactly like Sign In <-> Sign Up.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument()
    })

    it('returns to the Sign In tab (with tabs restored) via "Back to Sign In"', () => {
      renderWithRouter(<AuthPage />)

      fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
      fireEvent.click(screen.getByRole('button', { name: /Back to Sign In/ }))

      expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Sign In' })).toHaveAttribute('aria-selected', 'true')
    })
  })
})
