import { useCallback, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { useGoogleSignIn } from '../auth/useGoogleSignIn'
import { validateSignIn, hasErrors, type FieldErrors } from '../schemas/authValidation'
import type { SignInFormValues } from '../types/auth'
import { GoogleAuthButton } from './GoogleAuthButton'
import { PasswordField } from './PasswordField'
import { AuthHeading } from './AuthCardParts'
import { LockIcon, MailIcon, SpinnerIcon } from './icons'
import { TextField } from './TextField'
import { primaryButtonClasses } from './fieldStyles'

interface SignInFormProps {
  onSwitchToSignUp: () => void
  onForgotPassword: () => void
  returnTo?: string
}

const INITIAL_VALUES: SignInFormValues = { email: '', password: '' }

/** Sign in form: email/password, Google button, and a switch into sign up. */
export function SignInForm({
  onSwitchToSignUp,
  onForgotPassword,
  returnTo = '/app',
}: SignInFormProps) {
  const navigate = useNavigate()
  const { login, loginWithGoogle } = useAuth()
  const [values, setValues] = useState<SignInFormValues>(INITIAL_VALUES)
  const [errors, setErrors] = useState<FieldErrors<SignInFormValues>>({})
  const [attempted, setAttempted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [authError, setAuthError] = useState<string | null>(null)
  const isSubmitting = status === 'submitting'

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setAuthError(null)
      setStatus('submitting')
      const result = await loginWithGoogle(credential)

      if (result.success) {
        navigate(returnTo, { replace: true })
        return
      }

      setAuthError(result.message)
      setStatus('idle')
    },
    [loginWithGoogle, navigate, returnTo],
  )
  const googleSignIn = useGoogleSignIn(handleGoogleCredential)

  function updateField<K extends keyof SignInFormValues>(field: K, value: SignInFormValues[K]) {
    const next = { ...values, [field]: value }
    setValues(next)
    if (attempted) {
      setErrors(validateSignIn(next))
    }
    if (authError) {
      setAuthError(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAttempted(true)
    setAuthError(null)

    const nextErrors = validateSignIn(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return

    setStatus('submitting')
    const result = await login(values.email, values.password)

    if (result.success) {
      navigate(returnTo, { replace: true })
      return
    }

    // The backend deliberately returns one generic message for every
    // failure (unknown email, wrong password, inactive account) - shown
    // as a single form-level error, not attached to a field, since there
    // is nothing field-specific to say without undermining that.
    setAuthError(result.message)
    setStatus('idle')
  }

  return (
    <div>
      <AuthHeading title="Welcome back" subtitle="Sign in to continue" />

      <form noValidate onSubmit={handleSubmit} aria-busy={isSubmitting} className="mt-7 space-y-5">
        <TextField
          id="signin-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(value) => updateField('email', value)}
          error={errors.email}
          placeholder="Email address"
          disabled={isSubmitting}
          icon={<MailIcon className="h-5 w-5" />}
          hideLabel
        />

        <PasswordField
          id="signin-password"
          label="Password"
          autoComplete="current-password"
          value={values.password}
          onChange={(value) => updateField('password', value)}
          error={errors.password}
          placeholder="Password"
          disabled={isSubmitting}
          icon={<LockIcon className="h-5 w-5" />}
          hideLabel
        />

        {authError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {authError}
          </p>
        )}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClasses}>
          {isSubmitting && <SpinnerIcon className="h-4 w-4 motion-safe:animate-spin" />}
          <span>{isSubmitting ? 'Logging in…' : 'Login'}</span>
        </button>
      </form>

      <div className="mt-5">
        <GoogleAuthButton
          disabled={isSubmitting || !googleSignIn.isConfigured}
          onClick={googleSignIn.trigger}
          googleButtonContainerId={googleSignIn.hiddenButtonContainerId}
        />
      </div>

      <p className="mt-6 text-center text-sm font-semibold text-sage">
        <button
          type="button"
          className="-my-3 py-3 hover:text-jade focus:outline-none focus-visible:underline"
          onClick={onForgotPassword}
        >
          Forgot password?
        </button>{' '}
        <span className="font-bold text-ink">or</span>{' '}
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="-my-3 py-3 hover:text-jade focus:outline-none focus-visible:underline"
        >
          Sign Up
        </button>
      </p>
    </div>
  )
}
