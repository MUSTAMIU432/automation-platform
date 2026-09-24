import { useState } from 'react'

import type { AuthView } from '../types/auth'
import { AuthShell } from './AuthShell'
import { AuthTabs } from './AuthTabs'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'

/**
 * Combined sign in / sign up / forgot-password experience at /auth. All
 * three are views of the same card, not separate routes — switching between
 * them never navigates away from /auth.
 */
export function AuthPage() {
  const [view, setView] = useState<AuthView>('sign-in')

  if (view === 'forgot-password') {
    return (
      <AuthShell>
        <ForgotPasswordForm onBackToSignIn={() => setView('sign-in')} />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthTabs mode={view} onChange={setView} />

      <div
        role="tabpanel"
        id={`auth-panel-${view}`}
        aria-labelledby={`auth-tab-${view}`}
        tabIndex={-1}
        className="mt-8 motion-safe:animate-[fade-in_150ms_ease-out]"
      >
        {view === 'sign-in' ? (
          <SignInForm
            onSwitchToSignUp={() => setView('sign-up')}
            onForgotPassword={() => setView('forgot-password')}
          />
        ) : (
          <SignUpForm onSwitchToSignIn={() => setView('sign-in')} />
        )}
      </div>
    </AuthShell>
  )
}
