import { Navigate, useLocation, useSearchParams } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import type { AuthView } from '../types/auth'
import { AuthShell } from './AuthShell'
import { AuthTabs } from './AuthTabs'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { SignInForm } from './SignInForm'
import { SignUpForm } from './SignUpForm'

function getReturnTo(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return '/app'

  const from = state.from
  if (typeof from !== 'object' || from === null || !('pathname' in from)) return '/app'

  const pathname = from.pathname
  if (typeof pathname !== 'string' || (pathname !== '/app' && !pathname.startsWith('/app/'))) {
    return '/app'
  }

  const search = 'search' in from && typeof from.search === 'string' ? from.search : ''
  const hash = 'hash' in from && typeof from.hash === 'string' ? from.hash : ''
  return `${pathname}${search}${hash}`
}

const VIEWS: readonly AuthView[] = ['sign-in', 'sign-up', 'forgot-password']

function getView(mode: string | null): AuthView {
  return VIEWS.find((view) => view === mode) ?? 'sign-in'
}

/**
 * Combined sign in / sign up / forgot-password experience at /auth. All
 * three are views of the same card, not separate routes — switching between
 * them never navigates away from /auth.
 *
 * The view is the `?mode=` query parameter (`sign-up`, `forgot-password`;
 * anything else is sign in), so the website's "Sign Up" and "Get Started"
 * links open the right one directly. Switching replaces the history entry
 * and carries the router state along, so the page a visitor was sent here
 * from (`state.from`) still decides where signing in lands.
 *
 * Someone already signed in has nothing to do here and goes straight on to
 * that destination - the app, by default.
 */
export function AuthPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { status } = useAuth()
  const view = getView(searchParams.get('mode'))
  const returnTo = getReturnTo(location.state)

  function setView(next: AuthView) {
    setSearchParams(next === 'sign-in' ? {} : { mode: next }, {
      replace: true,
      state: location.state,
    })
  }

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />
  }

  if (view === 'forgot-password') {
    return (
      <AuthShell>
        <ForgotPasswordForm onBackToSignIn={() => setView('sign-in')} />
      </AuthShell>
    )
  }

  return (
    <AuthShell tabs={<AuthTabs mode={view} onChange={setView} />}>
      <div
        key={view}
        role="tabpanel"
        id={`auth-panel-${view}`}
        aria-labelledby={`auth-tab-${view}`}
        tabIndex={-1}
        className="motion-safe:animate-[fade-in_150ms_ease-out]"
      >
        {view === 'sign-in' ? (
          <SignInForm
            returnTo={returnTo}
            onSwitchToSignUp={() => setView('sign-up')}
            onForgotPassword={() => setView('forgot-password')}
          />
        ) : (
          <SignUpForm returnTo={returnTo} onSwitchToSignIn={() => setView('sign-in')} />
        )}
      </div>
    </AuthShell>
  )
}
